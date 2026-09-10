import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  CANONICAL_CIRCLE_CONTROL_FACTOR,
  canonicalQuarterCircle,
  circle,
  circularArc,
  evaluateCubic,
  pathBezierAsCubic,
  point,
  subcurve,
} from "../src/index.js";
import type { CubicBezier, Point } from "../src/index.js";

function assertNear(actual: number, expected: number, epsilon = 1e-12): void {
  assert.ok(Math.abs(actual - expected) <= epsilon, `${actual} is not near ${expected}`);
}

function assertPointNear(actual: Point, expected: Point, epsilon = 1e-12): void {
  assertNear(actual.x, expected.x, epsilon);
  assertNear(actual.y, expected.y, epsilon);
}

function assertCubicNear(actual: CubicBezier, expected: CubicBezier): void {
  assertPointNear(actual.start, expected.start);
  assertPointNear(actual.control1, expected.control1);
  assertPointNear(actual.control2, expected.control2);
  assertPointNear(actual.end, expected.end);
}

describe("canonical circular construction", () => {
  it("preserves the established canonical quarter", () => {
    const quarter = canonicalQuarterCircle();
    assert.deepEqual(quarter.start, point(1, 0));
    assert.deepEqual(quarter.control1, point(1, CANONICAL_CIRCLE_CONTROL_FACTOR));
    assert.deepEqual(quarter.control2, point(CANONICAL_CIRCLE_CONTROL_FACTOR, 1));
    assert.deepEqual(quarter.end, point(0, 1));
    assert.ok(Object.isFrozen(quarter));
  });

  it("builds a structurally closed four-quarter circle", () => {
    const result = circle(point(3, -2), 5);
    assert.equal(result.isClosed, true);
    assert.equal(result.segmentCount, 4);
    assert.strictEqual(result.last.end, result.first.start);
    assertPointNear(result.first.start, point(8, -2));
    assertPointNear(result.segments[1]?.start ?? point(NaN, NaN), point(3, 3));
    assertPointNear(result.segments[2]?.start ?? point(NaN, NaN), point(-2, -2));
    assertPointNear(result.segments[3]?.start ?? point(NaN, NaN), point(3, -7));
  });

  it("reverses traversal without changing the represented circle", () => {
    const positive = circle(point(0, 0), 2, 1);
    const negative = circle(point(0, 0), 2, -1);
    assertPointNear(negative.segments[1]?.start ?? point(NaN, NaN), point(0, -2));
    for (const globalT of [0, 0.25, 1, 1.75, 2.5, 3.25]) {
      const positivePoint = evaluateCubic(
        pathBezierAsCubic(positive.segments[Math.floor(globalT)]!),
        globalT % 1,
      );
      const negativePoint = evaluateCubic(
        pathBezierAsCubic(negative.segments[Math.floor(globalT)]!),
        globalT % 1,
      );
      assertNear(positivePoint.x, negativePoint.x);
      assertNear(positivePoint.y, -negativePoint.y);
    }
  });
});

describe("canonical circular arcs", () => {
  it("uses complete quarters plus an exact subdivision of the next quarter", () => {
    const result = circularArc(point(0, 0), 1, 0, (3 * Math.PI) / 4);
    assert.equal(result.isClosed, false);
    assert.equal(result.segmentCount, 2);
    assertCubicNear(pathBezierAsCubic(result.first), canonicalQuarterCircle());
    const expectedPartial = subcurve(canonicalQuarterCircle(), 0, 0.5);
    const actualPartial = pathBezierAsCubic(result.last);
    assertPointNear(actualPartial.start, point(0, 1));
    assertPointNear(
      actualPartial.control1,
      point(-expectedPartial.control1.y, expectedPartial.control1.x),
    );
    assertPointNear(
      actualPartial.control2,
      point(-expectedPartial.control2.y, expectedPartial.control2.x),
    );
    assertPointNear(actualPartial.end, point(-expectedPartial.end.y, expectedPartial.end.x));
  });

  it("makes matching arc portions exactly consistent with a canonical circle", () => {
    const whole = circle(point(0, 0), 1);
    const half = circularArc(point(0, 0), 1, 0, Math.PI);
    assert.deepEqual(pathBezierAsCubic(half.segments[0]!), pathBezierAsCubic(whole.segments[0]!));
    assert.deepEqual(pathBezierAsCubic(half.segments[1]!), pathBezierAsCubic(whole.segments[1]!));
  });

  it("does not discard a finite nonzero sweep", () => {
    const result = circularArc(point(0, 0), 1, 0, Number.EPSILON);
    assert.equal(result.segmentCount, 1);
    assert.notDeepEqual(result.first.start, result.last.end);
  });

  it("supports placement, scale, and negative traversal", () => {
    const result = circularArc(point(10, 20), 3, Math.PI / 2, -Math.PI / 2);
    assert.equal(result.segmentCount, 1);
    assertPointNear(result.first.start, point(10, 23));
    assertPointNear(result.last.end, point(13, 20));
  });

  it("treats a full-turn arc as structurally closed", () => {
    const result = circularArc(point(0, 0), 1, Math.PI / 4, 2 * Math.PI);
    assert.equal(result.isClosed, true);
    assert.equal(result.segmentCount, 4);
    assert.strictEqual(result.last.end, result.first.start);
  });

  it("rejects degenerate or ambiguous inputs", () => {
    assert.throws(() => circle(point(0, 0), 0), RangeError);
    assert.throws(() => circularArc(point(0, 0), 1, 0, 0), RangeError);
    assert.throws(() => circularArc(point(0, 0), 1, 0, 3 * Math.PI), RangeError);
    assert.throws(() => circularArc(point(0, 0), 1, Number.NaN, Math.PI), RangeError);
  });
});
