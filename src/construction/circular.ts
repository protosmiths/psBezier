import { affineTransform } from "../affine/index.js";
import type { CubicBezier } from "../bezier/index.js";
import { cubicBezier, subcurve, transformCubic } from "../bezier/index.js";
import type { Point } from "../numeric/index.js";
import { point } from "../numeric/index.js";
import type { BezierPath } from "../path/index.js";
import { BezierPathBuilder } from "../path/index.js";

/** Steve Graves's established control distance for the canonical unit quarter. */
export const CANONICAL_CIRCLE_CONTROL_FACTOR = 0.551915;

const QUARTER_TURN = Math.PI / 2;
const FULL_TURN = 2 * Math.PI;

function requireFinite(value: number, name: string): void {
  if (!Number.isFinite(value)) throw new RangeError(`${name} must be finite`);
}

function requireRadius(radius: number): void {
  requireFinite(radius, "radius");
  if (radius <= 0) throw new RangeError("radius must be greater than zero");
}

/** The canonical positive quarter from (1,0) to (0,1). */
export function canonicalQuarterCircle(): CubicBezier {
  const factor = CANONICAL_CIRCLE_CONTROL_FACTOR;
  return cubicBezier(point(1, 0), point(1, factor), point(factor, 1), point(0, 1));
}

function placeQuarter(
  curve: CubicBezier,
  center: Point,
  radius: number,
  angle: number,
  direction: 1 | -1,
): CubicBezier {
  const cosine = Math.cos(angle);
  const sine = Math.sin(angle);
  return transformCubic(
    affineTransform(
      radius * cosine,
      radius * sine,
      -direction * radius * sine,
      direction * radius * cosine,
      center.x,
      center.y,
    ),
    curve,
  );
}

function pathFromPieces(pieces: readonly CubicBezier[], closed: boolean): BezierPath {
  const first = pieces[0];
  if (first === undefined) throw new Error("circular construction produced no pieces");
  const builder = new BezierPathBuilder(first.start);
  for (const piece of pieces) {
    builder.appendCubic(piece.control1, piece.control2, piece.end);
  }
  if (closed) builder.close();
  return builder.build();
}

function circularPieces(
  center: Point,
  radius: number,
  startAngle: number,
  sweepAngle: number,
): readonly CubicBezier[] {
  const direction: 1 | -1 = sweepAngle > 0 ? 1 : -1;
  const magnitude = Math.abs(sweepAngle);
  const fullQuarters = Math.floor(magnitude / QUARTER_TURN);
  const remainder = magnitude - fullQuarters * QUARTER_TURN;
  const canonical = canonicalQuarterCircle();
  const pieces: CubicBezier[] = [];

  for (let index = 0; index < fullQuarters; index += 1) {
    pieces.push(
      placeQuarter(
        canonical,
        center,
        radius,
        startAngle + direction * index * QUARTER_TURN,
        direction,
      ),
    );
  }

  if (remainder > 0) {
    const fraction = remainder / QUARTER_TURN;
    pieces.push(
      placeQuarter(
        subcurve(canonical, 0, fraction),
        center,
        radius,
        startAngle + direction * fullQuarters * QUARTER_TURN,
        direction,
      ),
    );
  }

  return Object.freeze(pieces);
}

/**
 * Construct a circular arc as transformed canonical quarters and exact subdivisions.
 * Positive sweep follows increasing mathematical angle; negative sweep reverses it.
 */
export function circularArc(
  center: Point,
  radius: number,
  startAngle: number,
  sweepAngle: number,
): BezierPath {
  requireRadius(radius);
  requireFinite(startAngle, "startAngle");
  requireFinite(sweepAngle, "sweepAngle");
  if (sweepAngle === 0 || Math.abs(sweepAngle) > FULL_TURN) {
    throw new RangeError("sweepAngle must be nonzero and no greater than one full turn");
  }
  const closed = Math.abs(sweepAngle) === FULL_TURN;
  return pathFromPieces(circularPieces(center, radius, startAngle, sweepAngle), closed);
}

/** Construct a four-segment canonical circle, optionally with reversed traversal. */
export function circle(center: Point, radius: number, direction: 1 | -1 = 1): BezierPath {
  requireRadius(radius);
  if (direction !== 1 && direction !== -1) throw new RangeError("direction must be 1 or -1");
  return pathFromPieces(circularPieces(center, radius, 0, direction * FULL_TURN), true);
}
