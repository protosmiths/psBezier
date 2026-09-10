import type { AffineTransform } from "../affine/index.js";
import { transformPoint } from "../affine/index.js";
import type { Point, ToleranceContext, Vector } from "../numeric/index.js";
import {
  cross,
  distanceSquared,
  lengthSquared,
  point,
  squaredTolerance,
  subtractPoints,
  vector,
} from "../numeric/index.js";

/** An immutable free cubic Bézier with four independently owned points. */
export interface CubicBezier {
  readonly start: Point;
  readonly control1: Point;
  readonly control2: Point;
  readonly end: Point;
}

export interface BoundingBox {
  readonly min: Point;
  readonly max: Point;
}

/**
 * Select a normal by determinant sign rather than assuming a Y-axis direction.
 * A positive normal has cross(tangent, normal) > 0; a negative normal has < 0.
 */
export type NormalDirection = "positive" | "negative";

function snapshot(value: Point): Point {
  return point(value.x, value.y);
}

function requireParameter(value: number, name: string): void {
  if (!Number.isFinite(value) || value < 0 || value > 1) {
    throw new RangeError(`${name} must be finite and in [0, 1]`);
  }
}

function interpolatePoint(start: Point, end: Point, amount: number): Point {
  return point(start.x + (end.x - start.x) * amount, start.y + (end.y - start.y) * amount);
}

function normalizedOrNull(value: Vector, minimumLengthSquared: number): Vector | null {
  const magnitudeSquared = lengthSquared(value);
  if (magnitudeSquared <= minimumLengthSquared) {
    return null;
  }
  const inverseMagnitude = 1 / Math.sqrt(magnitudeSquared);
  return vector(value.x * inverseMagnitude, value.y * inverseMagnitude);
}

export function cubicBezier(
  start: Point,
  control1: Point,
  control2: Point,
  end: Point,
): CubicBezier {
  return Object.freeze({
    start: snapshot(start),
    control1: snapshot(control1),
    control2: snapshot(control2),
    end: snapshot(end),
  });
}

/** Evaluate with de Casteljau interpolation. */
export function evaluateCubic(curve: CubicBezier, t: number): Point {
  requireParameter(t, "t");

  if (t === 0) return curve.start;
  if (t === 1) return curve.end;

  const p01 = interpolatePoint(curve.start, curve.control1, t);
  const p12 = interpolatePoint(curve.control1, curve.control2, t);
  const p23 = interpolatePoint(curve.control2, curve.end, t);
  const p012 = interpolatePoint(p01, p12, t);
  const p123 = interpolatePoint(p12, p23, t);
  return interpolatePoint(p012, p123, t);
}

export function cubicDerivative(curve: CubicBezier, t: number): Vector {
  requireParameter(t, "t");
  const oneMinusT = 1 - t;
  const startLeg = subtractPoints(curve.control1, curve.start);
  const middleLeg = subtractPoints(curve.control2, curve.control1);
  const endLeg = subtractPoints(curve.end, curve.control2);
  return vector(
    3 * (oneMinusT * oneMinusT * startLeg.x + 2 * oneMinusT * t * middleLeg.x + t * t * endLeg.x),
    3 * (oneMinusT * oneMinusT * startLeg.y + 2 * oneMinusT * t * middleLeg.y + t * t * endLeg.y),
  );
}

export function cubicSecondDerivative(curve: CubicBezier, t: number): Vector {
  requireParameter(t, "t");
  const ax = curve.control2.x - 2 * curve.control1.x + curve.start.x;
  const ay = curve.control2.y - 2 * curve.control1.y + curve.start.y;
  const bx = curve.end.x - 2 * curve.control2.x + curve.control1.x;
  const by = curve.end.y - 2 * curve.control2.y + curve.control1.y;
  return vector(6 * ((1 - t) * ax + t * bx), 6 * ((1 - t) * ay + t * by));
}

export function cubicThirdDerivative(curve: CubicBezier): Vector {
  return vector(
    6 * (-curve.start.x + 3 * curve.control1.x - 3 * curve.control2.x + curve.end.x),
    6 * (-curve.start.y + 3 * curve.control1.y - 3 * curve.control2.y + curve.end.y),
  );
}

/**
 * Return a directed unit tangent, or null where direction is genuinely ambiguous.
 *
 * At a stationary endpoint the first nonzero higher derivative supplies the one-sided
 * tangent. At an interior stationary point a nonzero second derivative means traversal
 * reverses direction, so no single directed tangent is returned. A stationary inflection
 * with vanishing first and second derivatives uses the third derivative.
 */
export function unitTangent(
  curve: CubicBezier,
  t: number,
  tolerance: ToleranceContext,
): Vector | null {
  requireParameter(t, "t");
  const minimumLengthSquared = squaredTolerance(tolerance.coordinate);
  const first = normalizedOrNull(cubicDerivative(curve, t), minimumLengthSquared);
  if (first !== null) return first;

  const secondDerivative = cubicSecondDerivative(curve, t);
  if (t <= tolerance.parameter) {
    const second = normalizedOrNull(secondDerivative, minimumLengthSquared);
    if (second !== null) return second;
  } else if (t >= 1 - tolerance.parameter) {
    const second = normalizedOrNull(
      vector(-secondDerivative.x, -secondDerivative.y),
      minimumLengthSquared,
    );
    if (second !== null) return second;
  } else if (lengthSquared(secondDerivative) > minimumLengthSquared) {
    return null;
  }

  return normalizedOrNull(cubicThirdDerivative(curve), minimumLengthSquared);
}

export function unitNormal(
  curve: CubicBezier,
  t: number,
  direction: NormalDirection,
  tolerance: ToleranceContext,
): Vector | null {
  const tangent = unitTangent(curve, t, tolerance);
  if (tangent === null) return null;
  return direction === "positive" ? vector(-tangent.y, tangent.x) : vector(tangent.y, -tangent.x);
}

/** Exact de Casteljau subdivision relative to the source cubic. */
export function splitCubic(curve: CubicBezier, t: number): readonly [CubicBezier, CubicBezier] {
  requireParameter(t, "t");
  const p01 = interpolatePoint(curve.start, curve.control1, t);
  const p12 = interpolatePoint(curve.control1, curve.control2, t);
  const p23 = interpolatePoint(curve.control2, curve.end, t);
  const p012 = interpolatePoint(p01, p12, t);
  const p123 = interpolatePoint(p12, p23, t);
  const splitPoint = interpolatePoint(p012, p123, t);

  return Object.freeze([
    cubicBezier(curve.start, p01, p012, splitPoint),
    cubicBezier(splitPoint, p123, p23, curve.end),
  ]);
}

/**
 * Extract the directed interval from t0 to t1. Descending intervals return the reversed
 * geometry of the corresponding ascending interval.
 */
export function subcurve(curve: CubicBezier, t0: number, t1: number): CubicBezier {
  requireParameter(t0, "t0");
  requireParameter(t1, "t1");

  if (t0 > t1) return reverseCubic(subcurve(curve, t1, t0));
  if (t0 === 0 && t1 === 1) return curve;
  if (t0 === t1) {
    const value = evaluateCubic(curve, t0);
    return cubicBezier(value, value, value, value);
  }

  const prefix = t1 === 1 ? curve : splitCubic(curve, t1)[0];
  if (t0 === 0) return prefix;
  return splitCubic(prefix, t0 / t1)[1];
}

export function reverseCubic(curve: CubicBezier): CubicBezier {
  return cubicBezier(curve.end, curve.control2, curve.control1, curve.start);
}

export function transformCubic(transform: AffineTransform, curve: CubicBezier): CubicBezier {
  return cubicBezier(
    transformPoint(transform, curve.start),
    transformPoint(transform, curve.control1),
    transformPoint(transform, curve.control2),
    transformPoint(transform, curve.end),
  );
}

function quadraticRoots(aValue: number, bValue: number, cValue: number): readonly number[] {
  const scale = Math.max(Math.abs(aValue), Math.abs(bValue), Math.abs(cValue));
  if (scale === 0) return Object.freeze([]);

  const a = aValue / scale;
  const b = bValue / scale;
  const c = cValue / scale;
  if (Math.abs(a) <= Number.EPSILON * Math.max(Math.abs(b), Math.abs(c), 1)) {
    return b === 0 ? Object.freeze([]) : Object.freeze([-c / b]);
  }

  const discriminant = b * b - 4 * a * c;
  if (discriminant < 0) return Object.freeze([]);
  if (discriminant === 0) return Object.freeze([-b / (2 * a)]);

  const rootDiscriminant = Math.sqrt(discriminant);
  const q = -0.5 * (b + Math.sign(b || 1) * rootDiscriminant);
  const first = q / a;
  const second = c / q;
  return Object.freeze(first < second ? [first, second] : [second, first]);
}

function derivativeRoots(p0: number, p1: number, p2: number, p3: number): readonly number[] {
  return quadraticRoots(-p0 + 3 * p1 - 3 * p2 + p3, 2 * (p0 - 2 * p1 + p2), p1 - p0);
}

function appendInteriorRoot(target: number[], candidate: number): void {
  if (candidate <= 0 || candidate >= 1 || !Number.isFinite(candidate)) return;
  const duplicateTolerance = 8 * Number.EPSILON * Math.max(1, Math.abs(candidate));
  if (!target.some((existing) => Math.abs(existing - candidate) <= duplicateTolerance)) {
    target.push(candidate);
  }
}

export function extremaParameters(curve: CubicBezier): readonly number[] {
  const result: number[] = [];
  for (const root of derivativeRoots(
    curve.start.x,
    curve.control1.x,
    curve.control2.x,
    curve.end.x,
  )) {
    appendInteriorRoot(result, root);
  }
  for (const root of derivativeRoots(
    curve.start.y,
    curve.control1.y,
    curve.control2.y,
    curve.end.y,
  )) {
    appendInteriorRoot(result, root);
  }
  result.sort((left, right) => left - right);
  return Object.freeze(result);
}

export function cubicBoundingBox(curve: CubicBezier): BoundingBox {
  let minX = Math.min(curve.start.x, curve.end.x);
  let minY = Math.min(curve.start.y, curve.end.y);
  let maxX = Math.max(curve.start.x, curve.end.x);
  let maxY = Math.max(curve.start.y, curve.end.y);

  for (const t of extremaParameters(curve)) {
    const value = evaluateCubic(curve, t);
    minX = Math.min(minX, value.x);
    minY = Math.min(minY, value.y);
    maxX = Math.max(maxX, value.x);
    maxY = Math.max(maxY, value.y);
  }

  return Object.freeze({ min: point(minX, minY), max: point(maxX, maxY) });
}

/** Recognize a cubic whose control points lie on its endpoint baseline within tolerance. */
export function isLinearCubic(curve: CubicBezier, tolerance: ToleranceContext): boolean {
  const baseline = subtractPoints(curve.end, curve.start);
  const baselineLengthSquared = lengthSquared(baseline);
  const coordinateToleranceSquared = squaredTolerance(tolerance.coordinate);

  if (baselineLengthSquared <= coordinateToleranceSquared) {
    return (
      distanceSquared(curve.start, curve.control1) <= coordinateToleranceSquared &&
      distanceSquared(curve.start, curve.control2) <= coordinateToleranceSquared
    );
  }

  const firstOffset = subtractPoints(curve.control1, curve.start);
  const secondOffset = subtractPoints(curve.control2, curve.start);
  return (
    cross(baseline, firstOffset) ** 2 <= coordinateToleranceSquared * baselineLengthSquared &&
    cross(baseline, secondOffset) ** 2 <= coordinateToleranceSquared * baselineLengthSquared
  );
}
