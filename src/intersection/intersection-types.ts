import type { Point } from "../numeric/index.js";
import { point } from "../numeric/index.js";

export interface LineSegment {
  readonly kind: "line";
  readonly start: Point;
  readonly end: Point;
}

/** One geometry's parameter occurrence in a binary intersection event. */
export interface IntersectionOccurrence {
  readonly parameter: number;
  readonly point: Point;
}

/** Data that can later be lifted directly into a two-incidence IntersectionEvent. */
export interface PairedIntersectionPoint {
  readonly occurrences: readonly [IntersectionOccurrence, IntersectionOccurrence];
  readonly point: Point;
  readonly errorSquared: number;
}

export interface PointIntersection extends PairedIntersectionPoint {
  readonly kind: "point";
}

export interface OverlapIntersection {
  readonly kind: "overlap";
  /** Endpoints are ordered by increasing parameter on the first input geometry. */
  readonly start: PairedIntersectionPoint;
  readonly end: PairedIntersectionPoint;
  readonly direction: "same" | "opposite" | "stationary";
}

export type AnalyticIntersection = PointIntersection | OverlapIntersection;

export function lineSegment(start: Point, end: Point): LineSegment {
  return Object.freeze({ kind: "line", start: point(start.x, start.y), end: point(end.x, end.y) });
}

export function pairedPoint(
  firstParameter: number,
  firstPoint: Point,
  secondParameter: number,
  secondPoint: Point,
): PairedIntersectionPoint {
  const canonicalPoint = point(
    (firstPoint.x + secondPoint.x) / 2,
    (firstPoint.y + secondPoint.y) / 2,
  );
  const dx = firstPoint.x - secondPoint.x;
  const dy = firstPoint.y - secondPoint.y;
  const occurrences: readonly [IntersectionOccurrence, IntersectionOccurrence] = Object.freeze([
    Object.freeze({ parameter: firstParameter, point: point(firstPoint.x, firstPoint.y) }),
    Object.freeze({ parameter: secondParameter, point: point(secondPoint.x, secondPoint.y) }),
  ]);
  return Object.freeze({
    occurrences,
    point: canonicalPoint,
    errorSquared: dx * dx + dy * dy,
  });
}

export function pointIntersection(data: PairedIntersectionPoint): PointIntersection {
  return Object.freeze({ kind: "point", ...data });
}

export function overlapIntersection(
  start: PairedIntersectionPoint,
  end: PairedIntersectionPoint,
  direction: OverlapIntersection["direction"],
): OverlapIntersection {
  return Object.freeze({ kind: "overlap", start, end, direction });
}

export function swapIntersectionInputs(result: AnalyticIntersection): AnalyticIntersection {
  const swapPoint = (value: PairedIntersectionPoint): PairedIntersectionPoint =>
    pairedPoint(
      value.occurrences[1].parameter,
      value.occurrences[1].point,
      value.occurrences[0].parameter,
      value.occurrences[0].point,
    );

  if (result.kind === "point") return pointIntersection(swapPoint(result));
  const first = swapPoint(result.start);
  const second = swapPoint(result.end);
  return first.occurrences[0].parameter <= second.occurrences[0].parameter
    ? overlapIntersection(first, second, result.direction)
    : overlapIntersection(second, first, result.direction);
}
