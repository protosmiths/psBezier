import {
  cubicBoundingBox,
  evaluateCubic,
  splitCubic,
  type BoundingBox,
  type CubicBezier,
} from "../bezier/index.js";
import { distanceSquared, type Point, type ToleranceContext } from "../numeric/index.js";
import { normalizeGlobalT, pathBezierAsCubic, type BezierPath } from "../path/index.js";

export interface PointPathDistanceOptions {
  readonly maxNodes?: number;
  readonly maxDepth?: number;
  readonly decisionDistance?: number;
}

export type DistanceThresholdRelation = "within" | "beyond" | "unresolved";

export interface PointPathDistanceReport {
  /** Upper bound furnished by an evaluated source-curve point. */
  readonly distanceSquared: number;
  /** Conservative lower bound for the true minimum. */
  readonly lowerBoundSquared: number;
  readonly pathGlobalT: number;
  readonly point: Point;
  readonly complete: boolean;
  readonly exhausted: boolean;
  readonly depthLimited: boolean;
  readonly nodesVisited: number;
  readonly nodesCreated: number;
  readonly remainingNodes: number;
  readonly maximumDepthReached: number;
  readonly decisionDistance: number | null;
  readonly thresholdRelation: DistanceThresholdRelation | null;
}

interface DistanceNode {
  readonly curve: CubicBezier;
  readonly segmentIndex: number;
  readonly t0: number;
  readonly t1: number;
  readonly depth: number;
  readonly lowerBoundSquared: number;
}

function pointBoxDistanceSquared(target: Point, bounds: BoundingBox): number {
  const dx =
    target.x < bounds.min.x
      ? bounds.min.x - target.x
      : target.x > bounds.max.x
        ? target.x - bounds.max.x
        : 0;
  const dy =
    target.y < bounds.min.y
      ? bounds.min.y - target.y
      : target.y > bounds.max.y
        ? target.y - bounds.max.y
        : 0;
  return dx * dx + dy * dy;
}

function node(
  target: Point,
  curve: CubicBezier,
  segmentIndex: number,
  t0: number,
  t1: number,
  depth: number,
): DistanceNode {
  return {
    curve,
    segmentIndex,
    t0,
    t1,
    depth,
    lowerBoundSquared: pointBoxDistanceSquared(target, cubicBoundingBox(curve)),
  };
}

function distanceGapWithinTolerance(
  upperSquared: number,
  lowerSquared: number,
  tolerance: number,
): boolean {
  return Math.sqrt(upperSquared) - Math.sqrt(lowerSquared) <= tolerance;
}

/**
 * Bound the minimum distance from a point to an immutable path.
 *
 * `distanceSquared` is always an upper bound from an evaluated curve point. An incomplete report
 * must never be interpreted as proof that the query is farther from the path than that candidate.
 */
export function pointPathDistanceDetailed(
  path: BezierPath,
  target: Point,
  tolerance: ToleranceContext,
  options: PointPathDistanceOptions = {},
): PointPathDistanceReport {
  const maxNodes = options.maxNodes ?? 100_000;
  const maxDepth = options.maxDepth ?? 64;
  const decisionDistance = options.decisionDistance ?? null;
  if (!Number.isInteger(maxNodes) || maxNodes <= 0)
    throw new RangeError("maxNodes must be positive");
  if (!Number.isInteger(maxDepth) || maxDepth < 0)
    throw new RangeError("maxDepth must be nonnegative");
  if (decisionDistance !== null && (!Number.isFinite(decisionDistance) || decisionDistance < 0))
    throw new RangeError("decisionDistance must be finite and nonnegative");

  let bestPoint = evaluateCubic(pathBezierAsCubic(path.first), 0);
  let bestDistanceSquared = distanceSquared(target, bestPoint);
  let bestGlobalT = 0;
  let nodesCreated = 0;
  let nodesVisited = 0;
  let maximumDepthReached = 0;
  let depthLimited = false;
  let unresolvedLowerBoundSquared = Number.POSITIVE_INFINITY;
  const queue: DistanceNode[] = [];

  const consider = (
    curve: CubicBezier,
    segmentIndex: number,
    localT: number,
    t0: number,
    t1: number,
  ) => {
    const candidate = evaluateCubic(curve, localT);
    const candidateDistanceSquared = distanceSquared(target, candidate);
    if (candidateDistanceSquared < bestDistanceSquared) {
      bestDistanceSquared = candidateDistanceSquared;
      bestPoint = candidate;
      bestGlobalT = normalizeGlobalT(path, segmentIndex + t0 + (t1 - t0) * localT);
    }
  };

  for (const segment of path.segments) {
    const curve = pathBezierAsCubic(segment);
    consider(curve, segment.index, 0, 0, 1);
    consider(curve, segment.index, 0.5, 0, 1);
    consider(curve, segment.index, 1, 0, 1);
    queue.push(node(target, curve, segment.index, 0, 1, 0));
    nodesCreated += 1;
  }

  let exhausted = false;
  while (queue.length > 0) {
    queue.sort((left, right) => right.lowerBoundSquared - left.lowerBoundSquared);
    const current = queue.pop()!;
    if (current.lowerBoundSquared >= bestDistanceSquared) continue;
    if (nodesVisited >= maxNodes) {
      queue.push(current);
      exhausted = true;
      break;
    }
    nodesVisited += 1;
    maximumDepthReached = Math.max(maximumDepthReached, current.depth);
    if (current.depth >= maxDepth) {
      depthLimited = true;
      unresolvedLowerBoundSquared = Math.min(
        unresolvedLowerBoundSquared,
        current.lowerBoundSquared,
      );
      continue;
    }

    const [left, right] = splitCubic(current.curve, 0.5);
    const middle = (current.t0 + current.t1) / 2;
    consider(current.curve, current.segmentIndex, 0.5, current.t0, current.t1);
    for (const child of [
      node(target, left, current.segmentIndex, current.t0, middle, current.depth + 1),
      node(target, right, current.segmentIndex, middle, current.t1, current.depth + 1),
    ]) {
      nodesCreated += 1;
      if (child.lowerBoundSquared < bestDistanceSquared) queue.push(child);
    }

    const activeLower = Math.min(
      unresolvedLowerBoundSquared,
      ...queue.map((value) => value.lowerBoundSquared),
      bestDistanceSquared,
    );
    const thresholdResolved =
      decisionDistance !== null &&
      (bestDistanceSquared <= decisionDistance * decisionDistance ||
        activeLower > decisionDistance * decisionDistance);
    if (
      thresholdResolved ||
      (decisionDistance === null &&
        distanceGapWithinTolerance(bestDistanceSquared, activeLower, tolerance.coordinate))
    )
      break;
  }

  const lowerBoundSquared = Math.min(
    unresolvedLowerBoundSquared,
    ...queue.map((value) => value.lowerBoundSquared),
    bestDistanceSquared,
  );
  const complete = distanceGapWithinTolerance(
    bestDistanceSquared,
    lowerBoundSquared,
    tolerance.coordinate,
  );
  const thresholdRelation =
    decisionDistance === null
      ? null
      : bestDistanceSquared <= decisionDistance * decisionDistance
        ? "within"
        : lowerBoundSquared > decisionDistance * decisionDistance
          ? "beyond"
          : "unresolved";
  return Object.freeze({
    distanceSquared: bestDistanceSquared,
    lowerBoundSquared,
    pathGlobalT: bestGlobalT,
    point: bestPoint,
    complete,
    exhausted,
    depthLimited,
    nodesVisited,
    nodesCreated,
    remainingNodes: queue.length,
    maximumDepthReached,
    decisionDistance,
    thresholdRelation,
  });
}
