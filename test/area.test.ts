import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  BezierPathBuilder,
  createArea,
  createAreaDetailed,
  classifySimpleLoopPairRelationship,
  createToleranceContext,
  point,
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
