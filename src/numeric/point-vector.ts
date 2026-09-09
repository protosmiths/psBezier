/** A position in the active 2-D coordinate system. */
export interface Point {
  readonly x: number;
  readonly y: number;
}

/** A displacement in the active 2-D coordinate system. */
export interface Vector {
  readonly x: number;
  readonly y: number;
}

function requireFinite(value: number, name: string): void {
  if (!Number.isFinite(value)) {
    throw new RangeError(`${name} must be finite`);
  }
}

export function point(x: number, y: number): Point {
  requireFinite(x, "x");
  requireFinite(y, "y");
  return Object.freeze({ x, y });
}

export function vector(x: number, y: number): Vector {
  requireFinite(x, "x");
  requireFinite(y, "y");
  return Object.freeze({ x, y });
}

export function addVectorToPoint(value: Point, displacement: Vector): Point {
  return point(value.x + displacement.x, value.y + displacement.y);
}

export function subtractPoints(end: Point, start: Point): Vector {
  return vector(end.x - start.x, end.y - start.y);
}

export function addVectors(left: Vector, right: Vector): Vector {
  return vector(left.x + right.x, left.y + right.y);
}

export function subtractVectors(left: Vector, right: Vector): Vector {
  return vector(left.x - right.x, left.y - right.y);
}

export function scaleVector(value: Vector, factor: number): Vector {
  requireFinite(factor, "factor");
  return vector(value.x * factor, value.y * factor);
}

export function negateVector(value: Vector): Vector {
  return vector(-value.x, -value.y);
}

export function dot(left: Vector, right: Vector): number {
  return left.x * right.x + left.y * right.y;
}

export function cross(left: Vector, right: Vector): number {
  return left.x * right.y - left.y * right.x;
}

export function lengthSquared(value: Vector): number {
  return dot(value, value);
}

export function distanceSquared(left: Point, right: Point): number {
  const dx = left.x - right.x;
  const dy = left.y - right.y;
  return dx * dx + dy * dy;
}

/** Twice the signed area of triangle abc. */
export function orientationDeterminant(a: Point, b: Point, c: Point): number {
  return cross(subtractPoints(b, a), subtractPoints(c, a));
}

export function midpoint(left: Point, right: Point): Point {
  return point((left.x + right.x) / 2, (left.y + right.y) / 2);
}

export function lerpPoint(start: Point, end: Point, amount: number): Point {
  requireFinite(amount, "amount");
  return point(start.x + (end.x - start.x) * amount, start.y + (end.y - start.y) * amount);
}
