import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  IDENTITY_TRANSFORM,
  affineTransform,
  aroundPivot,
  compose,
  createToleranceContext,
  determinant,
  point,
  reflectionAcrossX,
  rotation,
  scale,
  shear,
  transformPoint,
  transformVector,
  translation,
  tryInverse,
  vector,
} from "../src/index.js";
import type { AffineTransform, Point } from "../src/index.js";

const tolerance = createToleranceContext({
  coordinate: 1e-10,
  discovery: 1e-6,
  intersection: 1e-10,
  parameter: 1e-12,
  relative: 1e-14,
});

function assertNear(actual: number, expected: number, epsilon = 1e-11): void {
  assert.ok(Math.abs(actual - expected) <= epsilon, `${actual} is not near ${expected}`);
}

function assertPointNear(actual: Point, expected: Point, epsilon = 1e-11): void {
  assertNear(actual.x, expected.x, epsilon);
  assertNear(actual.y, expected.y, epsilon);
}

function assertTransformNear(
  actual: AffineTransform,
  expected: AffineTransform,
  epsilon = 1e-11,
): void {
  assertNear(actual.a, expected.a, epsilon);
  assertNear(actual.b, expected.b, epsilon);
  assertNear(actual.c, expected.c, epsilon);
  assertNear(actual.d, expected.d, epsilon);
  assertNear(actual.e, expected.e, epsilon);
  assertNear(actual.f, expected.f, epsilon);
}

describe("affine construction and application", () => {
  it("uses the documented SVG/Canvas coefficient layout", () => {
    const transform = affineTransform(2, 3, 5, 7, 11, 13);
    assert.deepEqual(transformPoint(transform, point(17, 19)), point(140, 197));
    assert.deepEqual(transformVector(transform, vector(17, 19)), vector(129, 184));
  });

  it("keeps identity neutral on both sides of composition", () => {
    const transform = affineTransform(2, 3, 5, 7, 11, 13);
    assert.deepEqual(compose(IDENTITY_TRANSFORM, transform), transform);
    assert.deepEqual(compose(transform, IDENTITY_TRANSFORM), transform);
  });

  it("defines composition as applying right first, then left", () => {
    const move = translation(vector(10, 20));
    const double = scale(2);
    const value = point(3, 4);

    assert.deepEqual(transformPoint(compose(move, double), value), point(16, 28));
    assert.deepEqual(transformPoint(compose(double, move), value), point(26, 48));
  });

  it("constructs an operation around an explicit fixed pivot", () => {
    const pivot = point(10, -4);
    const transform = aroundPivot(rotation(Math.PI / 2), pivot);

    assertPointNear(transformPoint(transform, pivot), pivot);
    assertPointNear(transformPoint(transform, point(12, -4)), point(10, -2));
  });

  it("does not translate displacement vectors", () => {
    assert.deepEqual(transformVector(translation(vector(100, -50)), vector(3, 4)), vector(3, 4));
  });

  it("represents reflection in the determinant sign", () => {
    assert.equal(determinant(reflectionAcrossX()), -1);
    assert.equal(determinant(rotation(0.75)), 1);
  });

  it("creates immutable transforms without mutating operands", () => {
    const left = translation(vector(2, 3));
    const right = shear(0.25);
    const leftBefore = { ...left };
    const rightBefore = { ...right };

    const result = compose(left, right);

    assert.equal(Object.isFrozen(result), true);
    assert.deepEqual(left, leftBefore);
    assert.deepEqual(right, rightBefore);
  });
});

describe("affine inversion", () => {
  it("round-trips representative composed transforms", () => {
    const transforms = [
      translation(vector(12, -7)),
      rotation(1.25),
      scale(3, 0.5),
      shear(0.25, -0.1),
      compose(
        translation(vector(12, -7)),
        compose(rotation(1.25), compose(shear(0.25), scale(3, 0.5))),
      ),
    ];

    for (const transform of transforms) {
      const inverse = tryInverse(transform, tolerance);
      if (inverse === null) {
        assert.fail("representative transform should be invertible");
      }
      assertTransformNear(compose(inverse, transform), IDENTITY_TRANSFORM);
      assertTransformNear(compose(transform, inverse), IDENTITY_TRANSFORM);
      assertPointNear(
        transformPoint(inverse, transformPoint(transform, point(31, -17))),
        point(31, -17),
      );
    }
  });

  it("rejects singular and relatively near-singular linear parts", () => {
    assert.equal(tryInverse(scale(1, 0), tolerance), null);
    assert.equal(tryInverse(scale(1, 1e-16), tolerance), null);
  });

  it("uses a scale-independent relative conditioning test", () => {
    for (const transform of [scale(1e-200), scale(1e200)]) {
      const inverse = tryInverse(transform, tolerance);

      if (inverse === null) {
        assert.fail("uniformly scaled transform should remain relatively well-conditioned");
      }
      assertTransformNear(compose(inverse, transform), IDENTITY_TRANSFORM);
    }
  });
});
