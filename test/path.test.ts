import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  BezierPathBuilder,
  evaluateCubic,
  evaluatePath,
  evaluatePathIntervalAtFraction,
  extractPathInterval,
  locateGlobalT,
  normalizeGlobalT,
  pathIntervalGlobalTAtFraction,
  pathBezierAsCubic,
  point,
} from "../src/index.js";
import type { BezierPath, CubicBezier, Point } from "../src/index.js";

function assertNear(actual: number, expected: number, epsilon = 1e-12): void {
  assert.ok(Math.abs(actual - expected) <= epsilon, `${actual} is not near ${expected}`);
}

function assertPointNear(actual: Point, expected: Point, epsilon = 1e-12): void {
  assertNear(actual.x, expected.x, epsilon);
  assertNear(actual.y, expected.y, epsilon);
}

function openHorizontalPath(): BezierPath {
  return new BezierPathBuilder(point(0, 0))
    .appendCubic(point(1 / 3, 0), point(2 / 3, 0), point(1, 0))
    .appendCubic(point(4 / 3, 0), point(5 / 3, 0), point(2, 0))
    .appendCubic(point(7 / 3, 0), point(8 / 3, 0), point(3, 0))
    .build();
}

function closedTrianglePath(): BezierPath {
  return new BezierPathBuilder(point(0, 0))
    .appendCubic(point(1 / 3, 0), point(2 / 3, 0), point(1, 0))
    .appendCubic(point(1, 1 / 3), point(1, 2 / 3), point(1, 1))
    .appendCubic(point(2 / 3, 2 / 3), point(1 / 3, 1 / 3), point(0, 0))
    .close()
    .build();
}

function assertPiecesContiguous(pieces: readonly CubicBezier[]): void {
  for (let index = 1; index < pieces.length; index += 1) {
    const previous = pieces[index - 1];
    const current = pieces[index];
    if (previous === undefined || current === undefined) assert.fail("missing interval piece");
    assertPointNear(previous.end, current.start);
  }
}

describe("BezierPath immutable topology", () => {
  it("uses linked nodes as topology and the array as an index", () => {
    const path = openHorizontalPath();
    assert.equal(path.segmentCount, 3);
    assert.equal(path.isClosed, false);
    assert.equal(path.first.prev, null);
    assert.equal(path.last.next, null);
    assert.equal(path.first.next, path.segments[1]);
    assert.equal(path.segments[1]?.prev, path.first);
    assert.equal(path.segments[1]?.next, path.last);
    assert.equal(path.first.index, 0);
    assert.equal(path.last.index, 2);
  });

  it("derives every endpoint instead of duplicating adjacent storage", () => {
    const open = openHorizontalPath();
    assert.equal(open.first.end, open.segments[1]?.start);
    assert.equal(open.last.end, open.terminalPoint);

    const closed = closedTrianglePath();
    assert.equal(closed.terminalPoint, null);
    assert.equal(closed.first.prev, closed.last);
    assert.equal(closed.last.next, closed.first);
    assert.equal(closed.last.end, closed.first.start);
  });

  it("freezes the completed path, index, nodes, and point snapshots", () => {
    const path = closedTrianglePath();
    assert.equal(Object.isFrozen(path), true);
    assert.equal(Object.isFrozen(path.segments), true);
    assert.equal(Object.isFrozen(path.first), true);
    assert.equal(Object.isFrozen(path.first.start), true);
  });

  it("converts a path node to an independent free cubic", () => {
    const path = openHorizontalPath();
    const cubic = pathBezierAsCubic(path.first);
    assert.deepEqual(cubic.start, path.first.start);
    assert.deepEqual(cubic.end, path.first.end);
    assert.notEqual(cubic.start, path.first.start);
  });
});

describe("BezierPathBuilder editing and snapshots", () => {
  it("does not mutate an earlier built snapshot", () => {
    const builder = new BezierPathBuilder(point(0, 0)).appendCubic(
      point(1 / 3, 0),
      point(2 / 3, 0),
      point(1, 0),
    );
    const firstSnapshot = builder.build();
    builder.appendCubic(point(4 / 3, 0), point(5 / 3, 0), point(2, 0));
    const secondSnapshot = builder.build();

    assert.equal(firstSnapshot.segmentCount, 1);
    assert.equal(firstSnapshot.last.end.x, 1);
    assert.equal(secondSnapshot.segmentCount, 2);
  });

  it("copies a path into an editor and reindexes insertions and removals", () => {
    const original = openHorizontalPath();
    const editor = BezierPathBuilder.from(original);
    editor.insertSegment(1, point(0.5, 0), point(2 / 3, 0), point(5 / 6, 0));
    const inserted = editor.build();
    assert.deepEqual(
      inserted.segments.map((segment) => segment.index),
      [0, 1, 2, 3],
    );
    assert.equal(inserted.first.end.x, 0.5);
    assert.equal(inserted.segments[1]?.end.x, 1);

    editor.removeSegment(1);
    const restored = editor.build();
    assert.deepEqual(
      restored.segments.map((segment) => segment.index),
      [0, 1, 2],
    );
    assertPointNear(evaluatePath(restored, 1.5), evaluatePath(original, 1.5));
    assert.equal(original.segmentCount, 3);
  });

  it("can reopen a closed editor without altering the closed source", () => {
    const source = closedTrianglePath();
    const editor = BezierPathBuilder.from(source).reopen(point(4, 5));
    const open = editor.build();
    assert.equal(source.isClosed, true);
    assert.equal(open.isClosed, false);
    assert.deepEqual(open.terminalPoint, point(4, 5));
  });
});

describe("globalT canonical addressing", () => {
  it("uses the next segment at internal boundaries and N for the open terminal", () => {
    const path = openHorizontalPath();
    const internal = locateGlobalT(path, 1);
    assert.equal(internal.segment, path.segments[1]);
    assert.equal(internal.localT, 0);

    const terminal = locateGlobalT(path, 3);
    assert.equal(terminal.segment, path.last);
    assert.equal(terminal.localT, 1);
    assert.equal(evaluatePath(path, 3), path.terminalPoint);
  });

  it("wraps every closed-path cycle to the canonical half-open domain", () => {
    const path = closedTrianglePath();
    assert.equal(normalizeGlobalT(path, 3), 0);
    assert.equal(normalizeGlobalT(path, -0.25), 2.75);
    assertPointNear(evaluatePath(path, 3.25), evaluatePath(path, 0.25));
  });

  it("rejects open-path values outside [0,N]", () => {
    const path = openHorizontalPath();
    assert.throws(() => locateGlobalT(path, -0.01), RangeError);
    assert.throws(() => locateGlobalT(path, 3.01), RangeError);
  });
});

describe("directed path interval extraction", () => {
  it("maps fractions through a multi-segment source interval", () => {
    const path = openHorizontalPath();
    assert.equal(pathIntervalGlobalTAtFraction(path, 0.25, 2.75, 0.5), 1.5);
    assertPointNear(evaluatePathIntervalAtFraction(path, 0.25, 2.75, 0.5), point(1.5, 0));
  });

  it("maps fractions across a closed seam and around an explicit full cycle", () => {
    const path = closedTrianglePath();
    assert.equal(pathIntervalGlobalTAtFraction(path, 2.5, 0.5, 0.5), 0);
    assertPointNear(evaluatePathIntervalAtFraction(path, 2.5, 0.5, 0.5), evaluatePath(path, 0));
    assert.equal(pathIntervalGlobalTAtFraction(path, 0.5, 0.5, 0.5, { fullCycle: true }), 2);
  });

  it("supports reverse and very short directed intervals without leaving the source path", () => {
    const open = openHorizontalPath();
    assert.equal(pathIntervalGlobalTAtFraction(open, 2.5, 0.5, 0.25, { direction: "reverse" }), 2);
    const closed = closedTrianglePath();
    const from = 1.25;
    const to = from + 1e-12;
    const sampledT = pathIntervalGlobalTAtFraction(closed, from, to, 0.5);
    assert.ok(sampledT > from && sampledT < to);
    assertPointNear(
      evaluatePathIntervalAtFraction(closed, from, to, 0.5),
      evaluatePath(closed, sampledT),
    );
  });

  it("rejects invalid fractions and contradictory open traversal", () => {
    const path = openHorizontalPath();
    assert.throws(() => pathIntervalGlobalTAtFraction(path, 0, 1, -0.1), RangeError);
    assert.throws(
      () => pathIntervalGlobalTAtFraction(path, 0, 1, 0.5, { direction: "reverse" }),
      RangeError,
    );
  });

  it("extracts an open interval without exposing crossed segment bookkeeping", () => {
    const path = openHorizontalPath();
    const pieces = extractPathInterval(path, 0.5, 2.5);
    assert.equal(pieces.length, 3);
    assertPiecesContiguous(pieces);
    assertPointNear(pieces[0]?.start ?? point(Number.NaN, 0), point(0.5, 0));
    assertPointNear(pieces.at(-1)?.end ?? point(Number.NaN, 0), point(2.5, 0));
  });

  it("crosses a closed seam naturally in forward traversal", () => {
    const path = closedTrianglePath();
    const pieces = extractPathInterval(path, 2.5, 0.5);
    assert.equal(pieces.length, 2);
    assertPiecesContiguous(pieces);
    assertPointNear(pieces[0]?.start ?? point(Number.NaN, 0), evaluatePath(path, 2.5));
    assertPointNear(pieces.at(-1)?.end ?? point(Number.NaN, 0), evaluatePath(path, 0.5));
  });

  it("returns reversed cubics in reverse traversal order", () => {
    const path = openHorizontalPath();
    const pieces = extractPathInterval(path, 2.5, 0.5, { direction: "reverse" });
    assert.equal(pieces.length, 3);
    assertPiecesContiguous(pieces);
    assertPointNear(pieces[0]?.start ?? point(Number.NaN, 0), point(2.5, 0));
    assertPointNear(pieces.at(-1)?.end ?? point(Number.NaN, 0), point(0.5, 0));
  });

  it("makes a closed full cycle explicit when endpoint addresses are equal", () => {
    const path = closedTrianglePath();
    assert.deepEqual(extractPathInterval(path, 0.5, 0.5), []);
    const cycle = extractPathInterval(path, 0.5, 0.5, { fullCycle: true });
    assert.equal(cycle.length, 4);
    assertPiecesContiguous(cycle);
    assertPointNear(cycle[0]?.start ?? point(Number.NaN, 0), evaluatePath(path, 0.5));
    assertPointNear(cycle.at(-1)?.end ?? point(Number.NaN, 0), evaluatePath(path, 0.5));
  });

  it("rejects an open interval that contradicts its traversal direction", () => {
    const path = openHorizontalPath();
    assert.throws(() => extractPathInterval(path, 2, 1), RangeError);
    assert.throws(() => extractPathInterval(path, 1, 2, { direction: "reverse" }), RangeError);
  });

  it("preserves the source curve parameterization within each extracted piece", () => {
    const path = openHorizontalPath();
    const pieces = extractPathInterval(path, 0.25, 0.75);
    const piece = pieces[0];
    if (piece === undefined) assert.fail("expected an extracted piece");
    assertPointNear(evaluateCubic(piece, 0.5), evaluatePath(path, 0.5));
  });
});
