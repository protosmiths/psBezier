import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  compose,
  createToleranceContext,
  cubicBezier,
  cubicBoundingBox,
  cubicDerivative,
  cubicSecondDerivative,
  cubicThirdDerivative,
  evaluateCubic,
  extremaParameters,
  isLinearCubic,
  point,
  reflectionAcrossY,
  reverseCubic,
  rotation,
  scale,
  shear,
  splitCubic,
  subcurve,
  transformCubic,
  transformPoint,
  translation,
  unitNormal,
  unitTangent,
  vector,
} from "../src/index.js";
import type { Point, Vector } from "../src/index.js";

const tolerance = createToleranceContext({
  coordinate: 1e-10,
  discovery: 1e-6,
  intersection: 1e-10,
  parameter: 1e-12,
  relative: 1e-14,
});

function assertNear(actual: number, expected: number, epsilon = 1e-10): void {
  assert.ok(Math.abs(actual - expected) <= epsilon, `${actual} is not near ${expected}`);
}

function assertPointNear(actual: Point, expected: Point, epsilon = 1e-10): void {
  assertNear(actual.x, expected.x, epsilon);
  assertNear(actual.y, expected.y, epsilon);
}

function assertVectorNear(actual: Vector, expected: Vector, epsilon = 1e-10): void {
  assertNear(actual.x, expected.x, epsilon);
  assertNear(actual.y, expected.y, epsilon);
}

function requireVector(value: Vector | null, message: string): Vector {
  if (value === null) assert.fail(message);
  return value;
}

const sampleCurve = cubicBezier(point(-2, 1), point(3, 7), point(8, -5), point(11, 4));

describe("immutable free cubic Bézier", () => {
  it("snapshots all input points", () => {
    const mutableStart = { x: 1, y: 2 };
    const curve = cubicBezier(mutableStart, point(3, 4), point(5, 6), point(7, 8));
    mutableStart.x = 100;

    assert.deepEqual(curve.start, point(1, 2));
    assert.equal(Object.isFrozen(curve), true);
    assert.equal(Object.isFrozen(curve.start), true);
  });

  it("evaluates exact endpoints and a known midpoint", () => {
    const curve = cubicBezier(point(0, 0), point(0, 2), point(2, 2), point(2, 0));
    assert.equal(evaluateCubic(curve, 0), curve.start);
    assert.equal(evaluateCubic(curve, 1), curve.end);
    assertPointNear(evaluateCubic(curve, 0.5), point(1, 1.5));
  });

  it("rejects parameters outside the curve domain", () => {
    assert.throws(() => evaluateCubic(sampleCurve, -Number.EPSILON), RangeError);
    assert.throws(() => splitCubic(sampleCurve, 1 + Number.EPSILON), RangeError);
  });
});

describe("cubic differential geometry", () => {
  it("computes first, second, and third derivatives", () => {
    const curve = cubicBezier(point(0, 0), point(1, 2), point(3, 4), point(6, 8));
    assertVectorNear(cubicDerivative(curve, 0), vector(3, 6));
    assertVectorNear(cubicDerivative(curve, 1), vector(9, 12));
    assertVectorNear(cubicSecondDerivative(curve, 0), vector(6, 0));
    assertVectorNear(cubicSecondDerivative(curve, 1), vector(6, 12));
    assertVectorNear(cubicThirdDerivative(curve), vector(0, 12));
  });

  it("returns normalized tangents and determinant-signed normals", () => {
    const curve = cubicBezier(point(0, 0), point(1, 0), point(2, 0), point(3, 0));
    const tangent = unitTangent(curve, 0.5, tolerance);
    const positiveNormal = unitNormal(curve, 0.5, "positive", tolerance);
    const negativeNormal = unitNormal(curve, 0.5, "negative", tolerance);

    assertVectorNear(requireVector(tangent, "expected tangent"), vector(1, 0));
    assertVectorNear(requireVector(positiveNormal, "expected positive normal"), vector(0, 1));
    assertVectorNear(requireVector(negativeNormal, "expected negative normal"), vector(0, -1));
  });

  it("uses a one-sided higher derivative at a stationary endpoint", () => {
    const startStationary = cubicBezier(point(0, 0), point(0, 0), point(1, 0), point(2, 0));
    const endStationary = cubicBezier(point(0, 0), point(1, 0), point(2, 0), point(2, 0));

    assertVectorNear(
      requireVector(unitTangent(startStationary, 0, tolerance), "expected start tangent"),
      vector(1, 0),
    );
    assertVectorNear(
      requireVector(unitTangent(endStationary, 1, tolerance), "expected end tangent"),
      vector(1, 0),
    );
  });

  it("distinguishes a direction-reversing stationary point from a stationary inflection", () => {
    const reversing = cubicBezier(
      point(1 / 4, 0),
      point(-1 / 12, 0),
      point(-1 / 12, 0),
      point(1 / 4, 0),
    );
    const stationaryInflection = cubicBezier(
      point(-1 / 8, 0),
      point(1 / 8, 0),
      point(-1 / 8, 0),
      point(1 / 8, 0),
    );

    assert.equal(unitTangent(reversing, 0.5, tolerance), null);
    assertVectorNear(
      requireVector(
        unitTangent(stationaryInflection, 0.5, tolerance),
        "expected stationary-inflection tangent",
      ),
      vector(1, 0),
    );
  });
});

describe("exact subdivision and directed subcurves", () => {
  it("reconstructs the source parameterization across many split locations", () => {
    for (const splitAt of [0, 0.01, 0.2, 0.5, 0.9, 1]) {
      const [left, right] = splitCubic(sampleCurve, splitAt);
      for (const localT of [0, 0.1, 0.33, 0.75, 1]) {
        assertPointNear(evaluateCubic(left, localT), evaluateCubic(sampleCurve, splitAt * localT));
        assertPointNear(
          evaluateCubic(right, localT),
          evaluateCubic(sampleCurve, splitAt + (1 - splitAt) * localT),
        );
      }
    }
  });

  it("extracts ascending and descending directed intervals", () => {
    const intervals: ReadonlyArray<readonly [number, number]> = [
      [0.2, 0.8],
      [0.8, 0.2],
      [0.35, 0.35],
    ];
    for (const [t0, t1] of intervals) {
      const extracted = subcurve(sampleCurve, t0, t1);
      for (const localT of [0, 0.2, 0.5, 1]) {
        assertPointNear(
          evaluateCubic(extracted, localT),
          evaluateCubic(sampleCurve, t0 + (t1 - t0) * localT),
        );
      }
    }
  });

  it("reversal maps t to one minus t", () => {
    const reversed = reverseCubic(sampleCurve);
    for (const t of [0, 0.1, 0.5, 0.9, 1]) {
      assertPointNear(evaluateCubic(reversed, t), evaluateCubic(sampleCurve, 1 - t));
    }
  });
});

describe("cubic extrema and bounding box", () => {
  it("finds tight interior extrema instead of using control-point bounds", () => {
    const arch = cubicBezier(point(0, 0), point(0, 1), point(1, 1), point(1, 0));
    assert.ok(extremaParameters(arch).some((value) => Math.abs(value - 0.5) < 1e-12));
    assert.deepEqual(cubicBoundingBox(arch), {
      min: point(0, 0),
      max: point(1, 0.75),
    });
  });

  it("bounds every sampled point", () => {
    const bounds = cubicBoundingBox(sampleCurve);
    for (let index = 0; index <= 100; index += 1) {
      const value = evaluateCubic(sampleCurve, index / 100);
      assert.ok(value.x >= bounds.min.x - 1e-12 && value.x <= bounds.max.x + 1e-12);
      assert.ok(value.y >= bounds.min.y - 1e-12 && value.y <= bounds.max.y + 1e-12);
    }
  });
});

describe("cubic linear recognition", () => {
  it("uses perpendicular distance to the endpoint baseline", () => {
    const linear = cubicBezier(point(0, 0), point(2, 0), point(-1, 0), point(4, 0));
    const near = cubicBezier(point(0, 0), point(1, 0.5e-10), point(3, -0.5e-10), point(4, 0));
    const curved = cubicBezier(point(0, 0), point(1, 2e-10), point(3, 0), point(4, 0));

    assert.equal(isLinearCubic(linear, tolerance), true);
    assert.equal(isLinearCubic(near, tolerance), true);
    assert.equal(isLinearCubic(curved, tolerance), false);
  });

  it("handles a degenerate endpoint baseline explicitly", () => {
    assert.equal(
      isLinearCubic(cubicBezier(point(1, 1), point(1, 1), point(1, 1), point(1, 1)), tolerance),
      true,
    );
    assert.equal(
      isLinearCubic(cubicBezier(point(1, 1), point(2, 1), point(1, 1), point(1, 1)), tolerance),
      false,
    );
  });
});

describe("affine transformation of a cubic", () => {
  it("commutes with evaluation", () => {
    const transform = compose(
      translation(vector(7, -11)),
      compose(rotation(0.73), compose(shear(0.2, -0.15), scale(3, 0.4))),
    );
    const transformed = transformCubic(transform, sampleCurve);

    for (const t of [0, 0.01, 0.2, 0.5, 0.87, 1]) {
      assertPointNear(
        evaluateCubic(transformed, t),
        transformPoint(transform, evaluateCubic(sampleCurve, t)),
      );
    }
  });

  it("preserves exact linearity under nonsingular affine transforms", () => {
    const line = cubicBezier(point(0, 0), point(1, 0), point(2, 0), point(3, 0));
    const transform = compose(reflectionAcrossY(), compose(rotation(0.3), shear(0.4)));
    assert.equal(isLinearCubic(transformCubic(transform, line), tolerance), true);
  });
});
