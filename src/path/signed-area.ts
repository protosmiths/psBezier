import { cubicSignedArea } from "../bezier/index.js";
import type { ToleranceContext } from "../numeric/index.js";
import { distanceSquared } from "../numeric/index.js";
import { pathBezierAsCubic, type BezierPath } from "./bezier-path.js";

export type PathOrientation = "counter-clockwise" | "clockwise" | "degenerate";
export type PathOrientationSign = -1 | 1;

export interface PathOrientationReport {
  readonly signedArea: number;
  readonly areaTolerance: number;
  readonly orientation: PathOrientation;
  readonly orientationSign: PathOrientationSign | null;
}

function requireClosed(path: BezierPath): void {
  if (!path.isClosed) throw new RangeError("signed path area requires a closed path");
}

/** Sum exact cubic polynomial integrals around a closed path with compensated addition. */
export function signedPathArea(path: BezierPath): number {
  requireClosed(path);
  let sum = 0;
  let compensation = 0;
  for (const segment of path.segments) {
    const contribution = cubicSignedArea(pathBezierAsCubic(segment));
    const adjusted = contribution - compensation;
    const next = sum + adjusted;
    compensation = next - sum - adjusted;
    sum = next;
  }
  return sum;
}

function boundaryLengthUpperBound(path: BezierPath): number {
  let result = 0;
  for (const segment of path.segments) {
    result += Math.sqrt(distanceSquared(segment.start, segment.control1));
    result += Math.sqrt(distanceSquared(segment.control1, segment.control2));
    result += Math.sqrt(distanceSquared(segment.control2, segment.end));
  }
  return result;
}

/**
 * Classify closed-path orientation in Cartesian design space.
 *
 * The degeneracy band scales coordinate uncertainty by a conservative control-polygon
 * perimeter bound, preserving the squared units of area.
 */
export function classifyPathOrientation(
  path: BezierPath,
  tolerance: ToleranceContext,
): PathOrientationReport {
  const signedArea = signedPathArea(path);
  const areaTolerance =
    tolerance.coordinate *
    (boundaryLengthUpperBound(path) + path.segmentCount * tolerance.coordinate);
  const orientation: PathOrientation =
    Math.abs(signedArea) <= areaTolerance
      ? "degenerate"
      : signedArea > 0
        ? "counter-clockwise"
        : "clockwise";
  return Object.freeze({
    signedArea,
    areaTolerance,
    orientation,
    orientationSign:
      orientation === "degenerate" ? null : orientation === "counter-clockwise" ? 1 : -1,
  });
}
