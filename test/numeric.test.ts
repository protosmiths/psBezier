import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  addVectorToPoint,
  addVectors,
  createToleranceContext,
  cross,
  distanceSquared,
  dot,
  lengthSquared,
  midpoint,
  orientationDeterminant,
  point,
  scaleVector,
  subtractPoints,
  vector,
} from "../src/index.js";

describe("point and vector primitives", () => {
  it("distinguishes positions from displacements through its operations", () => {
    const start = point(2, 3);
    const displacement = vector(4, -5);
    const end = addVectorToPoint(start, displacement);

    assert.deepEqual(end, point(6, -2));
    assert.deepEqual(subtractPoints(end, start), displacement);
    assert.deepEqual(addVectors(displacement, scaleVector(displacement, -1)), vector(0, 0));
  });

  it("computes vector products and squared measures without trigonometry", () => {
    const xAxis = vector(3, 0);
    const yAxis = vector(0, 4);

    assert.equal(dot(xAxis, yAxis), 0);
    assert.equal(cross(xAxis, yAxis), 12);
    assert.equal(lengthSquared(addVectors(xAxis, yAxis)), 25);
    assert.equal(distanceSquared(point(0, 0), point(3, 4)), 25);
    assert.equal(orientationDeterminant(point(0, 0), point(3, 0), point(0, 4)), 12);
    assert.deepEqual(midpoint(point(-2, 4), point(6, 8)), point(2, 6));
  });

  it("rejects non-finite coordinates and factors", () => {
    assert.throws(() => point(Number.NaN, 0), RangeError);
    assert.throws(() => vector(0, Number.POSITIVE_INFINITY), RangeError);
    assert.throws(() => scaleVector(vector(1, 2), Number.NaN), RangeError);
  });

  it("creates immutable values", () => {
    assert.equal(Object.isFrozen(point(1, 2)), true);
    assert.equal(Object.isFrozen(vector(1, 2)), true);
  });
});

describe("tolerance context", () => {
  it("requires explicit valid tolerances and freezes the result", () => {
    const tolerance = createToleranceContext({
      coordinate: 1e-8,
      discovery: 1e-5,
      intersection: 1e-9,
      parameter: 1e-12,
      relative: 1e-14,
    });

    assert.equal(Object.isFrozen(tolerance), true);
    assert.equal(tolerance.intersection, 1e-9);
  });

  it("rejects non-positive values and inverted discovery/refinement ordering", () => {
    assert.throws(
      () =>
        createToleranceContext({
          coordinate: 0,
          discovery: 1e-5,
          intersection: 1e-9,
          parameter: 1e-12,
          relative: 1e-14,
        }),
      RangeError,
    );
    assert.throws(
      () =>
        createToleranceContext({
          coordinate: 1e-8,
          discovery: 1e-9,
          intersection: 1e-5,
          parameter: 1e-12,
          relative: 1e-14,
        }),
      RangeError,
    );
  });
});
