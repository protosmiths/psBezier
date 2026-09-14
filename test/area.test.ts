import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  BezierPathBuilder,
  createArea,
  createAreaDetailed,
  classifySimpleLoopPairRelationship,
  createToleranceContext,
  extractPathInterval,
  point,
  resolveWholeLoopOperation,
  type AreaTerm,
  type BezierPath,
  type Point,
} from "../src/index.js";

const tolerance = createToleranceContext({
  coordinate: 1e-8,
  discovery: 1e-5,
  intersection: 1e-9,
  parameter: 1e-10,
  relative: 1e-12,
});

function lineTo(builder: BezierPathBuilder, start: Point, end: Point): Point {
  builder.appendCubic(
    point(start.x + (end.x - start.x) / 3, start.y + (end.y - start.y) / 3),
    point(start.x + (2 * (end.x - start.x)) / 3, start.y + (2 * (end.y - start.y)) / 3),
    end,
  );
  return end;
}

function noncanonicalLineTo(builder: BezierPathBuilder, start: Point, end: Point): Point {
  builder.appendCubic(
    point(start.x + 0.3 * (end.x - start.x), start.y + 0.3 * (end.y - start.y)),
    point(start.x + 0.7 * (end.x - start.x), start.y + 0.7 * (end.y - start.y)),
    end,
  );
  return end;
}

function polygon(points: readonly Point[], closed = true): BezierPath {
  const builder = new BezierPathBuilder(points[0]!);
  let current = points[0]!;
  for (const next of points.slice(1)) current = lineTo(builder, current, next);
  if (closed) {
    lineTo(builder, current, points[0]!);
    builder.close();
  }
  return builder.build();
}

function square(x: number, y: number, size = 1): BezierPath {
  return polygon([point(x, y), point(x + size, y), point(x + size, y + size), point(x, y + size)]);
}

function reversePath(path: BezierPath): BezierPath {
  const builder = new BezierPathBuilder(path.first.start);
  for (const segment of [...path.segments].reverse())
    builder.appendCubic(segment.control2, segment.control1, segment.start);
  return builder.close().build();
}

function reseamPath(path: BezierPath, globalT: number): BezierPath {
  const pieces = extractPathInterval(path, globalT, globalT, { fullCycle: true });
  const first = pieces[0]!;
  const builder = new BezierPathBuilder(first.start);
  for (const piece of pieces) builder.appendCubic(piece.control1, piece.control2, piece.end);
  return builder.close().build();
}

describe("immutable signed Area foundation", () => {
  it("preserves path direction and positive multiplicity", () => {
    const ccw = square(0, 0);
    const cw = reversePath(square(3, 0));
    const area = createArea([{ path: ccw, multiplicity: 2 }, { path: cw }], tolerance);
    const positive = area.terms.find((term) => term.path === ccw)!;
    const negative = area.terms.find((term) => term.path === cw)!;
    assert.equal(positive.orientation, "counter-clockwise");
    assert.equal(positive.orientationSign, 1);
    assert.equal(positive.multiplicity, 2);
    assert.equal(positive.signedContribution, 2);
    assert.equal(negative.orientation, "clockwise");
    assert.equal(negative.orientationSign, -1);
    assert.equal(negative.signedContribution, -1);
    assert.ok(Object.isFrozen(area));
    assert.ok(Object.isFrozen(area.terms));
    assert.ok(area.terms.every(Object.isFrozen));
  });

  it("negates every signed AreaTerm property except multiplicity under reversal", () => {
    const forwardPath = square(0, 0, 2);
    const reverse = reversePath(forwardPath);
    const forward = createArea([{ path: forwardPath, multiplicity: 3 }], tolerance).terms[0]!;
    const reversed = createArea([{ path: reverse, multiplicity: 3 }], tolerance).terms[0]!;
    assert.ok(Math.abs(reversed.signedArea + forward.signedArea) <= tolerance.coordinate);
    assert.equal(reversed.orientationSign, -forward.orientationSign);
    assert.equal(reversed.signedContribution, -forward.signedContribution);
    assert.equal(reversed.multiplicity, forward.multiplicity);
  });

  it("preserves disconnected and nested signed terms without normalization", () => {
    const outer = square(0, 0, 10);
    const hole = reversePath(square(2, 2, 3));
    const disconnected = square(20, 0, 2);
    const area = createArea([{ path: hole }, { path: disconnected }, { path: outer }], tolerance);
    assert.equal(area.terms.length, 3);
    assert.equal(
      area.terms.some((term) => term.path === hole && term.signedContribution === -1),
      true,
    );
  });

  it("uses deterministic storage ordering independent of seed order", () => {
    const first = square(0, 0);
    const second = square(3, 0, 2);
    const direct = createArea([{ path: first }, { path: second }], tolerance);
    const reversed = createArea([{ path: second }, { path: first }], tolerance);
    assert.deepEqual(
      direct.terms.map((term) => term.path),
      reversed.terms.map((term) => term.path),
    );
  });

  it("rejects invalid multiplicity, open paths, and degenerate loops", () => {
    const open = polygon([point(0, 0), point(1, 0)], false);
    const degenerate = polygon([point(0, 0), point(1, 0), point(2, 0)]);
    const report = createAreaDetailed(
      [{ path: square(0, 0), multiplicity: 0 }, { path: open }, { path: degenerate }],
      tolerance,
    );
    assert.equal(report.area, null);
    assert.equal(report.valid, false);
    assert.ok(report.issues.some((value) => value.code === "invalid-multiplicity"));
    assert.ok(report.issues.some((value) => value.code === "open-path"));
    assert.ok(report.issues.some((value) => value.code === "degenerate-path"));
  });

  it("rejects a discovered self-intersecting boundary", () => {
    const bowtie = polygon([point(0, 0), point(2, 2), point(0, 2), point(2, 0)]);
    const report = createAreaDetailed([{ path: bowtie }], tolerance);
    assert.equal(report.area, null);
    assert.equal(report.complete, true);
    assert.ok(report.issues.some((value) => value.code === "self-intersecting-path"));
  });

  it("rejects adjacent segments that overlap beyond their shared knot", () => {
    const path = polygon([point(0, 0), point(3, 0), point(1, 0), point(1, 2), point(0, 2)]);
    const report = createAreaDetailed([{ path }], tolerance);
    assert.equal(report.area, null);
    assert.ok(report.issues.some((value) => value.code === "invalid-adjacent-segment-contact"));
  });

  it("does not accept a loop when self-intersection discovery is exhausted", () => {
    const builder = new BezierPathBuilder(point(0, 0));
    let current = noncanonicalLineTo(builder, point(0, 0), point(2, 2));
    current = noncanonicalLineTo(builder, current, point(0, 2));
    current = noncanonicalLineTo(builder, current, point(2, 0));
    noncanonicalLineTo(builder, current, point(0, 0));
    const report = createAreaDetailed([{ path: builder.close().build() }], tolerance, {
      maxCells: 1,
    });
    assert.equal(report.area, null);
    assert.equal(report.complete, false);
    assert.ok(report.issues.some((value) => value.code === "incomplete-self-intersection-search"));
  });
});

describe("simple-loop pair relationship precursor", () => {
  it("classifies disjoint and contained zero-switch pairs", () => {
    assert.equal(
      classifySimpleLoopPairRelationship(square(0, 0), square(3, 0), tolerance).relationship,
      "zero-switch-disjoint",
    );
    assert.equal(
      classifySimpleLoopPairRelationship(square(2, 2), square(0, 0, 10), tolerance).relationship,
      "zero-switch-first-inside-second",
    );
  });

  it("treats an external tangent as zero-switch rather than walk topology", () => {
    const report = classifySimpleLoopPairRelationship(square(0, 0), square(1, 1), tolerance);
    assert.equal(report.relationship, "zero-switch-disjoint");
    assert.ok(report.characterization?.events.every((event) => event.kind === "contact"));
  });

  it("recognizes full coincidence in either direction", () => {
    const first = square(0, 0, 2);
    assert.equal(
      classifySimpleLoopPairRelationship(first, square(0, 0, 2), tolerance).relationship,
      "full-coincidence",
    );
    assert.equal(
      classifySimpleLoopPairRelationship(first, reversePath(square(0, 0, 2)), tolerance)
        .relationship,
      "full-coincidence",
    );
  });

  it("recognizes exact full coincidence across different seams and segmentation", () => {
    const first = square(0, 0, 10);
    const second = reseamPath(first, 1.37);
    assert.notEqual(first.segmentCount, second.segmentCount);
    assert.notDeepEqual(
      first.segments.map((segment) => segment.start),
      second.segments.map((segment) => segment.start),
    );
    assert.equal(
      classifySimpleLoopPairRelationship(first, second, tolerance).relationship,
      "full-coincidence",
    );
    assert.equal(
      classifySimpleLoopPairRelationship(first, reversePath(second), tolerance).relationship,
      "full-coincidence",
    );
  });

  it("preserves a finite overlap across either circular path seam", () => {
    const first = square(0, 0, 2);
    const second = square(2, 0, 2);
    const cases = [
      { label: "neither", first, second },
      { label: "first only", first: reseamPath(first, 1.5), second },
      { label: "second only", first, second: reseamPath(second, 3.5) },
      {
        label: "both",
        first: reseamPath(first, 1.5),
        second: reseamPath(second, 3.5),
      },
    ];

    for (const value of cases) {
      const report = classifySimpleLoopPairRelationship(value.first, value.second, tolerance);
      assert.equal(report.relationship, "switching-topology", value.label);
      assert.equal(report.complete, true, value.label);
      assert.ok((report.intersections.arrangement?.overlaps.length ?? 0) > 0, value.label);
    }
  });

  it("sends genuine crossings to switching topology", () => {
    const report = classifySimpleLoopPairRelationship(square(0, 0, 2), square(1, 1, 2), tolerance);
    assert.equal(report.relationship, "switching-topology");
  });

  it("does not infer a relationship from exhausted discovery", () => {
    const firstBuilder = new BezierPathBuilder(point(0, 0));
    firstBuilder.appendCubic(point(0, 3), point(3, 3), point(3, 0));
    firstBuilder.appendCubic(point(3, -3), point(0, -3), point(0, 0));
    const secondBuilder = new BezierPathBuilder(point(0, 1));
    secondBuilder.appendCubic(point(1, -2), point(2, 4), point(3, 1));
    secondBuilder.appendCubic(point(2, 0), point(1, 2), point(0, 1));
    const report = classifySimpleLoopPairRelationship(
      firstBuilder.close().build(),
      secondBuilder.close().build(),
      tolerance,
      { maxCells: 1 },
    );
    assert.equal(report.relationship, "unresolved");
    assert.equal(report.complete, false);
  });
});

describe("whole-loop signed field operation table", () => {
  const operations = ["add", "join", "meet"] as const;
  const relationships = [
    "full-coincidence",
    "zero-switch-disjoint",
    "zero-switch-first-inside-second",
    "zero-switch-second-inside-first",
  ] as const;

  function fieldOperation(operation: (typeof operations)[number], first: number, second: number) {
    return operation === "add"
      ? first + second
      : operation === "join"
        ? Math.max(first, second)
        : Math.min(first, second);
  }

  function term(path: BezierPath, multiplicity: number): AreaTerm {
    return createArea([{ path, multiplicity }], tolerance).terms[0]!;
  }

  it("derives every sign and multiplicity case from field jumps", () => {
    for (const firstSign of [-1, 1] as const) {
      for (const secondSign of [-1, 1] as const) {
        for (const firstMultiplicity of [1, 2, 3]) {
          for (const secondMultiplicity of [1, 2, 3]) {
            const firstPath = firstSign === 1 ? square(2, 2, 2) : reversePath(square(2, 2, 2));
            const secondPath = secondSign === 1 ? square(0, 0, 6) : reversePath(square(0, 0, 6));
            const first = term(firstPath, firstMultiplicity);
            const second = term(secondPath, secondMultiplicity);
            const a = first.signedContribution;
            const b = second.signedContribution;

            for (const operation of operations) {
              for (const relationship of relationships) {
                const report = resolveWholeLoopOperation(first, second, relationship, operation);
                assert.equal(report.complete, true, `${operation} ${relationship} ${a} ${b}`);
                const actualFirst =
                  report.terms.find((value) => value.source === "first")?.fieldJump ?? 0;
                const actualSecond =
                  report.terms.find((value) => value.source === "second")?.fieldJump ?? 0;

                if (relationship === "full-coincidence") {
                  assert.equal(
                    actualFirst + actualSecond,
                    fieldOperation(operation, a, b),
                    `${operation} ${relationship} ${a} ${b}`,
                  );
                  assert.ok(report.terms.length <= 1);
                } else {
                  let expectedFirst: number;
                  let expectedSecond: number;
                  if (relationship === "zero-switch-disjoint") {
                    expectedFirst = fieldOperation(operation, a, 0);
                    expectedSecond = fieldOperation(operation, 0, b);
                  } else if (relationship === "zero-switch-first-inside-second") {
                    const middle = fieldOperation(operation, 0, b);
                    expectedFirst = fieldOperation(operation, a, b) - middle;
                    expectedSecond = middle;
                  } else {
                    const middle = fieldOperation(operation, a, 0);
                    expectedFirst = middle;
                    expectedSecond = fieldOperation(operation, a, b) - middle;
                  }
                  assert.equal(actualFirst, expectedFirst);
                  assert.equal(actualSecond, expectedSecond);
                }
              }
            }
          }
        }
      }
    }
  });

  it("defers switching and unresolved topology without manufacturing geometry", () => {
    const first = term(square(0, 0, 2), 1);
    const second = term(square(1, 1, 2), 1);
    for (const relationship of ["switching-topology", "unresolved"] as const) {
      const report = resolveWholeLoopOperation(first, second, relationship, "join");
      assert.equal(report.complete, false);
      assert.deepEqual(report.terms, []);
      assert.equal(report.issues.length, 1);
    }
  });
});

describe("integer winding level-set algebra", () => {
  function reconstruct(positive: readonly boolean[], negative: readonly boolean[]): number {
    return positive.filter(Boolean).length - negative.filter(Boolean).length;
  }

  it("reconstructs join and meet exactly for every field value from -3 through 3", () => {
    for (let first = -3; first <= 3; first += 1) {
      for (let second = -3; second <= 3; second += 1) {
        const levels = [1, 2, 3];
        const join = reconstruct(
          levels.map((level) => first >= level || second >= level),
          levels.map((level) => first <= -level && second <= -level),
        );
        const meet = reconstruct(
          levels.map((level) => first >= level && second >= level),
          levels.map((level) => first <= -level || second <= -level),
        );
        assert.equal(join, Math.max(first, second), `join(${first}, ${second})`);
        assert.equal(meet, Math.min(first, second), `meet(${first}, ${second})`);
      }
    }
  });
});
