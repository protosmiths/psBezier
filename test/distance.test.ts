import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  BezierPathBuilder,
  createToleranceContext,
  point,
  pointPathDistanceDetailed,
} from "../src/index.js";

const tolerance = createToleranceContext({
  coordinate: 1e-8,
  discovery: 1e-5,
  intersection: 1e-9,
  parameter: 1e-10,
  relative: 1e-12,
});

describe("point-to-path distance", () => {
  it("proves the distance to a canonical line from an evaluated closest point and box bound", () => {
    const path = new BezierPathBuilder(point(0, 0))
      .appendCubic(point(1 / 3, 0), point(2 / 3, 0), point(1, 0))
      .build();
    const report = pointPathDistanceDetailed(path, point(0.5, 2), tolerance);
    assert.equal(report.complete, true);
    assert.equal(report.distanceSquared, 4);
    assert.equal(report.lowerBoundSquared, 4);
    assert.equal(report.pathGlobalT, 0.5);
  });

  it("finds a known interior point on a curved cubic", () => {
    const path = new BezierPathBuilder(point(0, 0))
      .appendCubic(point(0, 1), point(1, 1), point(1, 0))
      .build();
    const report = pointPathDistanceDetailed(path, point(0.5, 0.75), tolerance);
    assert.equal(report.complete, true);
    assert.equal(report.distanceSquared, 0);
    assert.equal(report.pathGlobalT, 0.5);
  });

  it("retains an upper-bound candidate while reporting budget exhaustion independently", () => {
    const path = new BezierPathBuilder(point(0, 0))
      .appendCubic(point(0, 10), point(10, 10), point(10, 0))
      .build();
    const report = pointPathDistanceDetailed(path, point(3, 4), tolerance, { maxNodes: 1 });
    assert.equal(Number.isFinite(report.distanceSquared), true);
    assert.equal(report.exhausted, true);
    assert.equal(report.complete, false);
    assert.ok(report.lowerBoundSquared <= report.distanceSquared);
  });

  it("reports depth limitation without manufacturing a completed minimum", () => {
    const path = new BezierPathBuilder(point(0, 0))
      .appendCubic(point(0, 10), point(10, 10), point(10, 0))
      .build();
    const report = pointPathDistanceDetailed(path, point(3, 4), tolerance, { maxDepth: 0 });
    assert.equal(report.depthLimited, true);
    assert.equal(report.complete, false);
  });
});
