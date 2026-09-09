import type { Point, ToleranceContext, Vector } from "../numeric/index.js";
import { point, vector } from "../numeric/index.js";

/**
 * Immutable SVG/Canvas-compatible 2-D affine transform.
 *
 * x' = a*x + c*y + e
 * y' = b*x + d*y + f
 */
export interface AffineTransform {
  readonly a: number;
  readonly b: number;
  readonly c: number;
  readonly d: number;
  readonly e: number;
  readonly f: number;
}

function requireFinite(value: number, name: string): void {
  if (!Number.isFinite(value)) {
    throw new RangeError(`${name} must be finite`);
  }
}

export function affineTransform(
  a: number,
  b: number,
  c: number,
  d: number,
  e: number,
  f: number,
): AffineTransform {
  requireFinite(a, "a");
  requireFinite(b, "b");
  requireFinite(c, "c");
  requireFinite(d, "d");
  requireFinite(e, "e");
  requireFinite(f, "f");
  return Object.freeze({ a, b, c, d, e, f });
}

export const IDENTITY_TRANSFORM: AffineTransform = affineTransform(1, 0, 0, 1, 0, 0);

export function translation(displacement: Vector): AffineTransform {
  return affineTransform(1, 0, 0, 1, displacement.x, displacement.y);
}

export function scale(scaleX: number, scaleY: number = scaleX): AffineTransform {
  return affineTransform(scaleX, 0, 0, scaleY, 0, 0);
}

export function rotation(radians: number): AffineTransform {
  requireFinite(radians, "radians");
  const cosine = Math.cos(radians);
  const sine = Math.sin(radians);
  return affineTransform(cosine, sine, -sine, cosine, 0, 0);
}

/** x' = x + shearX*y; y' = shearY*x + y. */
export function shear(shearX: number, shearY: number = 0): AffineTransform {
  return affineTransform(1, shearY, shearX, 1, 0, 0);
}

/** Reflect across the X axis. */
export function reflectionAcrossX(): AffineTransform {
  return scale(1, -1);
}

/** Reflect across the Y axis. */
export function reflectionAcrossY(): AffineTransform {
  return scale(-1, 1);
}

/**
 * Return left * right. The returned transform applies right first, then left.
 */
export function compose(left: AffineTransform, right: AffineTransform): AffineTransform {
  return affineTransform(
    left.a * right.a + left.c * right.b,
    left.b * right.a + left.d * right.b,
    left.a * right.c + left.c * right.d,
    left.b * right.c + left.d * right.d,
    left.a * right.e + left.c * right.f + left.e,
    left.b * right.e + left.d * right.f + left.f,
  );
}

/** Apply an operation around a fixed point rather than around the origin. */
export function aroundPivot(operation: AffineTransform, pivot: Point): AffineTransform {
  return compose(
    translation(vector(pivot.x, pivot.y)),
    compose(operation, translation(vector(-pivot.x, -pivot.y))),
  );
}

export function transformPoint(transform: AffineTransform, value: Point): Point {
  return point(
    transform.a * value.x + transform.c * value.y + transform.e,
    transform.b * value.x + transform.d * value.y + transform.f,
  );
}

/** Transform a displacement; translation intentionally has no effect. */
export function transformVector(transform: AffineTransform, value: Vector): Vector {
  return vector(
    transform.a * value.x + transform.c * value.y,
    transform.b * value.x + transform.d * value.y,
  );
}

export function determinant(transform: AffineTransform): number {
  return transform.a * transform.d - transform.b * transform.c;
}

/**
 * Invert a sufficiently well-conditioned transform.
 *
 * The relative test compares |determinant| with the squared Frobenius norm of
 * the linear 2x2 part, so a uniform change of scale does not change the result.
 */
export function tryInverse(
  transform: AffineTransform,
  tolerance: ToleranceContext,
): AffineTransform | null {
  const magnitude = Math.max(
    Math.abs(transform.a),
    Math.abs(transform.b),
    Math.abs(transform.c),
    Math.abs(transform.d),
  );

  if (magnitude === 0) {
    return null;
  }

  const a = transform.a / magnitude;
  const b = transform.b / magnitude;
  const c = transform.c / magnitude;
  const d = transform.d / magnitude;
  const normalizedDeterminant = a * d - b * c;
  const normalizedNormSquared = a * a + b * b + c * c + d * d;

  if (Math.abs(normalizedDeterminant) <= tolerance.relative * normalizedNormSquared) {
    return null;
  }

  const inverseA = d / normalizedDeterminant / magnitude;
  const inverseB = -b / normalizedDeterminant / magnitude;
  const inverseC = -c / normalizedDeterminant / magnitude;
  const inverseD = a / normalizedDeterminant / magnitude;

  return affineTransform(
    inverseA,
    inverseB,
    inverseC,
    inverseD,
    -(inverseA * transform.e + inverseC * transform.f),
    -(inverseB * transform.e + inverseD * transform.f),
  );
}
