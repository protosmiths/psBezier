import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  BezierPathBuilder,
  classifyPathOrientation,
  compose,
  createToleranceContext,
  cubicBezier,
  cubicSignedArea,
  determinant,
  point,
  reflectionAcrossX,
  rotation,
  scale,
  signedPathArea,
  splitCubic,
  transformPoint,
  translation,
  vector,
  type AffineTransform,
  type BezierPath,
  type Point,
} from "../src/index.js";

const tolerance = createToleranceContext({
  coordinate: 1e-10,
  discovery: 1e-6,
  intersection: 1e-10,
  parameter: 1e-12,
  relative: 1e-14,
});

function lineTo(builder: BezierPathBuilder, start: Point, end: Point): Point {
  builder.appendCubic(
    point(start.x + (end.x - start.x) / 3, start.y + (end.y - start.y) / 3),
    point(start.x + (2 * (end.x - start.x)) / 3, start.y + (2 * (end.y - start.y)) / 3),
    end,
  );
  return end;
}

function polygon(points: readonly Point[]): BezierPath {
  if (points.length < 2) throw new RangeError("polygon needs at least two points");
  const builder = new BezierPathBuilder(points[0]!);
  let current = points[0]!;
  for (const next of [...points.slice(1), points[0]!]) current = lineTo(builder, current, next);
  return builder.close().build();
}

function reversePath(path: BezierPath): BezierPath {
  const builder = new BezierPathBuilder(path.first.start);
  for (const segment of [...path.segments].reverse())
    builder.appendCubic(segment.control2, segment.control1, segment.start);
  return builder.close().build();
}

function transformPath(path: BezierPath, transform: AffineTransform): BezierPath {
  const builder = new BezierPathBuilder(transformPoint(transform, path.first.start));
  for (const segment of path.segments)
    builder.appendCubic(
      transformPoint(transform, segment.control1),
      transformPoint(transform, segment.control2),
      transformPoint(transform, segment.end),
    );
  return builder.close().build();
}

function assertNear(actual: number, expected: number, epsilon = 1e-10): void {
  assert.ok(Math.abs(actual - expected) <= epsilon, `${actual} is not near ${expected}`);
}

describe("exact cubic and closed-path signed area", () => {
  it("makes cubic contributions additive under exact subdivision", () => {
    const curve = cubicBezier(point(-2, 1), point(3, 7), point(8, -5), point(11, 4));
    for (const parameter of [0.01, 0.2, 0.5, 0.9]) {
      const [left, right] = splitCubic(curve, parameter);
      assertNear(cubicSignedArea(left) + cubicSignedArea(right), cubicSignedArea(curve), 1e-9);
    }
  });

  it("uses conventional Cartesian orientation signs", () => {
    const ccw = polygon([point(0, 0), point(4, 0), point(4, 3), point(0, 3)]);
    const cw = reversePath(ccw);
    assertNear(signedPathArea(ccw), 12);
    assertNear(signedPathArea(cw), -12);
    assert.deepEqual(classifyPathOrientation(ccw, tolerance).orientationSign, 1);
    assert.deepEqual(classifyPathOrientation(cw, tolerance).orientationSign, -1);
  });

  it("scales signed area by the affine determinant", () => {
    const source = polygon([point(-1, 0), point(2, 0), point(0, 3)]);
    const transforms = [
      translation(vector(1e4, -2e4)),
      rotation(0.73),
      scale(3, 0.4),
      compose(translation(vector(7, -9)), compose(reflectionAcrossX(), scale(2))),
    ];
    for (const transform of transforms)
      assertNear(
        signedPathArea(transformPath(source, transform)),
        signedPathArea(source) * determinant(transform),
        1e-7,
      );
  });

  it("reports near-zero closed geometry as degenerate", () => {
    const collapsed = polygon([point(0, 0), point(1, 0), point(2, 0)]);
    const report = classifyPathOrientation(collapsed, tolerance);
    assert.equal(report.orientation, "degenerate");
    assert.equal(report.orientationSign, null);
  });

  it("rejects signed area for an open path", () => {
    const open = new BezierPathBuilder(point(0, 0))
      .appendCubic(point(1 / 3, 0), point(2 / 3, 0), point(1, 0))
      .build();
    assert.throws(() => signedPathArea(open), RangeError);
  });
});
