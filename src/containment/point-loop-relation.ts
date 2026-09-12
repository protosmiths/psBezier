import { cubicBoundingBox, cubicDerivative } from "../bezier/index.js";
import {
  cross,
  lengthSquared,
  point,
  subtractPoints,
  type Point,
  type ToleranceContext,
} from "../numeric/index.js";
import { pathBezierAsCubic, type BezierPath } from "../path/index.js";
import {
  pointPathDistanceDetailed,
  type PointPathDistanceOptions,
  type PointPathDistanceReport,
} from "../distance/index.js";
import { intersectAnalytic, lineSegment } from "../intersection/index.js";

export type PointLoopRelation = "inside" | "outside" | "boundary" | "unresolved";
export type ContainmentRayStatus =
  | "accepted"
  | "overlap"
  | "ray-endpoint"
  | "loop-knot"
  | "ill-conditioned";

export interface ContainmentRayAttempt {
  readonly externalPoint: Point;
  readonly status: ContainmentRayStatus;
  readonly winding: number | null;
  readonly crossingCount: number;
}

export interface PointLoopRelationOptions {
  readonly externalPoints?: readonly Point[];
  readonly distance?: PointPathDistanceOptions;
}

export interface PointLoopRelationReport {
  readonly relation: PointLoopRelation;
  readonly winding: number | null;
  readonly distance: PointPathDistanceReport;
  readonly attempts: readonly ContainmentRayAttempt[];
}

function pathBounds(path: BezierPath) {
  let bounds = cubicBoundingBox(pathBezierAsCubic(path.first));
  for (const segment of path.segments.slice(1)) {
    const next = cubicBoundingBox(pathBezierAsCubic(segment));
    bounds = {
      min: point(Math.min(bounds.min.x, next.min.x), Math.min(bounds.min.y, next.min.y)),
      max: point(Math.max(bounds.max.x, next.max.x), Math.max(bounds.max.y, next.max.y)),
    };
  }
  return bounds;
}

export function containmentExternalPoints(
  path: BezierPath,
  tolerance: ToleranceContext,
): readonly Point[] {
  const bounds = pathBounds(path);
  const width = bounds.max.x - bounds.min.x;
  const height = bounds.max.y - bounds.min.y;
  const margin = Math.max(width, height, 1, tolerance.discovery * 16);
  const left = bounds.min.x - margin;
  const right = bounds.max.x + margin;
  const top = bounds.min.y - margin;
  const bottom = bounds.max.y + margin;
  return Object.freeze([
    point(right, bounds.min.y + height * 0.37),
    point(bounds.min.x + width * 0.61, top),
    point(left, bounds.min.y + height * 0.23),
    point(bounds.min.x + width * 0.43, bottom),
    point(right, top),
    point(left, bottom),
    point(right, bottom),
    point(left, top),
  ]);
}

function attemptRay(
  path: BezierPath,
  query: Point,
  externalPoint: Point,
  tolerance: ToleranceContext,
): ContainmentRayAttempt {
  const direction = subtractPoints(externalPoint, query);
  const directionLengthSquared = lengthSquared(direction);
  if (directionLengthSquared <= tolerance.coordinate * tolerance.coordinate)
    return Object.freeze({
      externalPoint,
      status: "ray-endpoint",
      winding: null,
      crossingCount: 0,
    });
  const ray = lineSegment(query, externalPoint);
  let winding = 0;
  let crossingCount = 0;
  for (const segment of path.segments) {
    const curve = pathBezierAsCubic(segment);
    for (const intersection of intersectAnalytic(ray, curve, tolerance)) {
      if (intersection.kind === "overlap")
        return Object.freeze({ externalPoint, status: "overlap", winding: null, crossingCount });
      const rayT = intersection.occurrences[0].parameter;
      const curveT = intersection.occurrences[1].parameter;
      if (rayT <= tolerance.parameter || rayT >= 1 - tolerance.parameter)
        return Object.freeze({
          externalPoint,
          status: "ray-endpoint",
          winding: null,
          crossingCount,
        });
      if (curveT <= tolerance.parameter || curveT >= 1 - tolerance.parameter)
        return Object.freeze({ externalPoint, status: "loop-knot", winding: null, crossingCount });
      const tangent = cubicDerivative(curve, curveT);
      const tangentLengthSquared = lengthSquared(tangent);
      const determinant = cross(direction, tangent);
      if (
        tangentLengthSquared === 0 ||
        determinant * determinant <=
          tolerance.relative * directionLengthSquared * tangentLengthSquared
      )
        return Object.freeze({
          externalPoint,
          status: "ill-conditioned",
          winding: null,
          crossingCount,
        });
      winding += determinant > 0 ? 1 : -1;
      crossingCount += 1;
    }
  }
  return Object.freeze({ externalPoint, status: "accepted", winding, crossingCount });
}

export function pointLoopRelationDetailed(
  path: BezierPath,
  query: Point,
  tolerance: ToleranceContext,
  options: PointLoopRelationOptions = {},
): PointLoopRelationReport {
  if (!path.isClosed) throw new RangeError("point/loop relation requires a closed path");
  const distance = pointPathDistanceDetailed(path, query, tolerance, {
    ...options.distance,
    decisionDistance: tolerance.coordinate,
  });
  if (distance.thresholdRelation === "within")
    return Object.freeze({
      relation: "boundary",
      winding: null,
      distance,
      attempts: Object.freeze([]),
    });
  if (distance.thresholdRelation !== "beyond")
    return Object.freeze({
      relation: "unresolved",
      winding: null,
      distance,
      attempts: Object.freeze([]),
    });

  const attempts = (options.externalPoints ?? containmentExternalPoints(path, tolerance)).map(
    (externalPoint) => attemptRay(path, query, externalPoint, tolerance),
  );
  const accepted = attempts.filter((attempt) => attempt.status === "accepted");
  if (accepted.length === 0)
    return Object.freeze({
      relation: "unresolved",
      winding: null,
      distance,
      attempts: Object.freeze(attempts),
    });
  const firstInside = accepted[0]!.winding !== 0;
  if (accepted.some((attempt) => (attempt.winding !== 0) !== firstInside))
    return Object.freeze({
      relation: "unresolved",
      winding: null,
      distance,
      attempts: Object.freeze(attempts),
    });
  return Object.freeze({
    relation: firstInside ? "inside" : "outside",
    winding: accepted[0]!.winding,
    distance,
    attempts: Object.freeze(attempts),
  });
}

export function pointLoopRelation(
  path: BezierPath,
  query: Point,
  tolerance: ToleranceContext,
): PointLoopRelation {
  return pointLoopRelationDetailed(path, query, tolerance).relation;
}
