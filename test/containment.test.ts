import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  BezierPathBuilder,
  createToleranceContext,
  point,
  pointLoopRelation,
  pointLoopRelationDetailed,
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

function square(reverse = false): BezierPath {
  const points = reverse
    ? [point(0, 0), point(0, 1), point(1, 1), point(1, 0)]
    : [point(0, 0), point(1, 0), point(1, 1), point(0, 1)];
  const builder = new BezierPathBuilder(points[0]!);
  for (let index = 1; index < points.length; index += 1)
    lineTo(builder, points[index - 1]!, points[index]!);
  lineTo(builder, points.at(-1)!, points[0]!);
  return builder.close().build();
}

describe("point relative to a closed loop", () => {
  it("classifies clear inside, outside, and boundary points", () => {
    const path = square();
    assert.equal(pointLoopRelation(path, point(0.5, 0.5), tolerance), "inside");
    assert.equal(pointLoopRelation(path, point(2, 0.5), tolerance), "outside");
    assert.equal(pointLoopRelation(path, point(0, 0.5), tolerance), "boundary");
  });

  it("rejects a knot ray wholesale and succeeds with another deterministic candidate", () => {
    const report = pointLoopRelationDetailed(square(), point(0.5, 0.5), tolerance, {
      externalPoints: [point(2, 2), point(2, 0.7)],
    });
    assert.equal(report.attempts[0]!.status, "loop-knot");
    assert.equal(report.attempts[1]!.status, "accepted");
    assert.equal(report.relation, "inside");
  });

  it("rejects an overlapping ray wholesale and uses a clean alternative", () => {
    const report = pointLoopRelationDetailed(square(), point(-1, 0), tolerance, {
      externalPoints: [point(2, 0), point(-2, -1)],
    });
    assert.equal(report.attempts[0]!.status, "overlap");
    assert.equal(report.attempts[1]!.status, "accepted");
    assert.equal(report.relation, "outside");
  });

  it("keeps inside/outside invariant while loop reversal changes winding sign", () => {
    const query = point(0.5, 0.5);
    const externalPoints = [point(2, 0.7)];
    const forward = pointLoopRelationDetailed(square(), query, tolerance, { externalPoints });
    const reverse = pointLoopRelationDetailed(square(true), query, tolerance, { externalPoints });
    assert.equal(forward.relation, "inside");
    assert.equal(reverse.relation, "inside");
    assert.equal(forward.winding, -reverse.winding!);
  });

  it("classifies a point just beyond boundary tolerance with a clean ray", () => {
    const report = pointLoopRelationDetailed(square(), point(-2e-8, 0.5), tolerance, {
      externalPoints: [point(-2, 0.7)],
    });
    assert.equal(report.distance.thresholdRelation, "beyond");
    assert.equal(report.relation, "outside");
  });

  it("rejects open paths", () => {
    const open = new BezierPathBuilder(point(0, 0))
      .appendCubic(point(1 / 3, 0), point(2 / 3, 0), point(1, 0))
      .build();
    assert.throws(() => pointLoopRelation(open, point(0.5, 1), tolerance), RangeError);
  });
});
