import type { CubicBezier } from "../bezier/index.js";
import type { ToleranceContext } from "../numeric/index.js";
import { point } from "../numeric/index.js";
import type { BezierPath, PathBezier } from "../path/index.js";
import { pathBezierAsCubic } from "../path/index.js";
import type { CubicIntersectionDiscoveryOptions } from "./cubic-cubic-discovery.js";
import type { CubicCubicIntersectionReport } from "./cubic-cubic.js";
import { intersectCubicCubicDetailed } from "./cubic-cubic.js";
import { intersectAnalytic } from "./dispatch.js";
import type { AnalyticIntersection, PairedIntersectionPoint } from "./intersection-types.js";
import { lineSegment } from "./intersection-types.js";
import type {
  IntersectionArrangement,
  IntersectionEventSeed,
  IntersectionOverlapSeed,
} from "./intersection-topology.js";
import {
  buildIntersectionArrangement,
  eventSeedFromSegmentPoint,
  intersectionOverlapSeed,
} from "./intersection-topology.js";

export type PathSegmentPairExclusion = "same-segment" | "adjacent-segments";

export interface PathSegmentPairDiagnostic {
  readonly first: PathBezier;
  readonly second: PathBezier;
  readonly excluded: PathSegmentPairExclusion | null;
  readonly intersections: readonly AnalyticIntersection[];
  readonly complete: boolean;
  readonly cubicReport: CubicCubicIntersectionReport | null;
}

export interface PathIntersectionReport {
  readonly first: BezierPath;
  readonly second: BezierPath;
  readonly selfIntersection: boolean;
  readonly pairs: readonly PathSegmentPairDiagnostic[];
  readonly arrangement: IntersectionArrangement | null;
  readonly complete: boolean;
}

interface LiftedEvents {
  readonly seeds: IntersectionEventSeed[];
  readonly overlaps: IntersectionOverlapSeed[];
}

function areAdjacent(first: PathBezier, second: PathBezier): boolean {
  return first.next === second || first.prev === second;
}

function sameOccurrencePair(
  left: IntersectionEventSeed,
  right: IntersectionEventSeed,
  tolerance: ToleranceContext,
): boolean {
  return (
    left.occurrences[0].path === right.occurrences[0].path &&
    left.occurrences[1].path === right.occurrences[1].path &&
    Math.abs(left.occurrences[0].globalT - right.occurrences[0].globalT) <= tolerance.parameter &&
    Math.abs(left.occurrences[1].globalT - right.occurrences[1].globalT) <= tolerance.parameter
  );
}

function canonicalEventSeed(
  lifted: LiftedEvents,
  candidate: IntersectionEventSeed,
  tolerance: ToleranceContext,
): IntersectionEventSeed {
  const existing = lifted.seeds.find((seed) => sameOccurrencePair(seed, candidate, tolerance));
  if (existing !== undefined) return existing;
  lifted.seeds.push(candidate);
  return candidate;
}

function liftPoint(
  lifted: LiftedEvents,
  first: PathBezier,
  second: PathBezier,
  value: PairedIntersectionPoint,
  tolerance: ToleranceContext,
): IntersectionEventSeed {
  return canonicalEventSeed(
    lifted,
    eventSeedFromSegmentPoint(first, second, value, tolerance),
    tolerance,
  );
}

function sameOverlap(left: IntersectionOverlapSeed, right: IntersectionOverlapSeed): boolean {
  return left.start === right.start && left.end === right.end && left.direction === right.direction;
}

function liftResult(
  lifted: LiftedEvents,
  first: PathBezier,
  second: PathBezier,
  result: AnalyticIntersection,
  tolerance: ToleranceContext,
): void {
  if (result.kind === "point") {
    liftPoint(lifted, first, second, result, tolerance);
    return;
  }
  const start = liftPoint(lifted, first, second, result.start, tolerance);
  const end = liftPoint(lifted, first, second, result.end, tolerance);
  const overlap = intersectionOverlapSeed(start, end, result.direction);
  if (!lifted.overlaps.some((existing) => sameOverlap(existing, overlap))) {
    lifted.overlaps.push(overlap);
  }
}

function pairDiagnostic(
  first: PathBezier,
  second: PathBezier,
  excluded: PathSegmentPairExclusion | null,
  tolerance: ToleranceContext,
  options: CubicIntersectionDiscoveryOptions,
): PathSegmentPairDiagnostic {
  if (excluded !== null) {
    return Object.freeze({
      first,
      second,
      excluded,
      intersections: Object.freeze([]),
      complete: true,
      cubicReport: null,
    });
  }
  const firstCubic = pathBezierAsCubic(first);
  const secondCubic = pathBezierAsCubic(second);
  if (isCanonicalLine(firstCubic) || isCanonicalLine(secondCubic)) {
    const firstGeometry = isCanonicalLine(firstCubic)
      ? lineSegment(firstCubic.start, firstCubic.end)
      : firstCubic;
    const secondGeometry = isCanonicalLine(secondCubic)
      ? lineSegment(secondCubic.start, secondCubic.end)
      : secondCubic;
    return Object.freeze({
      first,
      second,
      excluded: null,
      intersections: intersectAnalytic(firstGeometry, secondGeometry, tolerance),
      complete: true,
      cubicReport: null,
    });
  }
  const cubicReport = intersectCubicCubicDetailed(firstCubic, secondCubic, tolerance, options);
  return Object.freeze({
    first,
    second,
    excluded: null,
    intersections: cubicReport.intersections,
    complete: cubicReport.complete,
    cubicReport,
  });
}

function isCanonicalLine(curve: CubicBezier): boolean {
  const firstThird = point(
    curve.start.x + (curve.end.x - curve.start.x) / 3,
    curve.start.y + (curve.end.y - curve.start.y) / 3,
  );
  const secondThird = point(
    curve.start.x + (2 * (curve.end.x - curve.start.x)) / 3,
    curve.start.y + (2 * (curve.end.y - curve.start.y)) / 3,
  );
  return (
    curve.control1.x === firstThird.x &&
    curve.control1.y === firstThird.y &&
    curve.control2.x === secondThird.x &&
    curve.control2.y === secondThird.y
  );
}

/** Lift every complete eligible segment-pair result into path-incidence topology. */
export function intersectPathsDetailed(
  first: BezierPath,
  second: BezierPath,
  tolerance: ToleranceContext,
  options: CubicIntersectionDiscoveryOptions = {},
): PathIntersectionReport {
  const selfIntersection = first === second;
  const pairs: PathSegmentPairDiagnostic[] = [];
  const lifted: LiftedEvents = { seeds: [], overlaps: [] };
  let complete = true;

  if (selfIntersection) {
    for (let firstIndex = 0; firstIndex < first.segmentCount; firstIndex += 1) {
      const firstSegment = first.segments[firstIndex]!;
      for (let secondIndex = firstIndex; secondIndex < second.segmentCount; secondIndex += 1) {
        const secondSegment = second.segments[secondIndex]!;
        const excluded: PathSegmentPairExclusion | null =
          firstSegment === secondSegment
            ? "same-segment"
            : areAdjacent(firstSegment, secondSegment)
              ? "adjacent-segments"
              : null;
        const diagnostic = pairDiagnostic(
          firstSegment,
          secondSegment,
          excluded,
          tolerance,
          options,
        );
        pairs.push(diagnostic);
        if (diagnostic.excluded !== null) continue;
        complete &&= diagnostic.complete;
        for (const result of diagnostic.intersections) {
          liftResult(lifted, firstSegment, secondSegment, result, tolerance);
        }
      }
    }
  } else {
    for (const firstSegment of first.segments) {
      for (const secondSegment of second.segments) {
        const diagnostic = pairDiagnostic(firstSegment, secondSegment, null, tolerance, options);
        pairs.push(diagnostic);
        complete &&= diagnostic.complete;
        for (const result of diagnostic.intersections) {
          liftResult(lifted, firstSegment, secondSegment, result, tolerance);
        }
      }
    }
  }

  return Object.freeze({
    first,
    second,
    selfIntersection,
    pairs: Object.freeze(pairs),
    arrangement: complete ? buildIntersectionArrangement(lifted.seeds, lifted.overlaps) : null,
    complete,
  });
}

export function intersectPaths(
  first: BezierPath,
  second: BezierPath,
  tolerance: ToleranceContext,
): IntersectionArrangement {
  const report = intersectPathsDetailed(first, second, tolerance);
  if (report.arrangement === null) {
    throw new Error(
      "path intersection search is incomplete; inspect intersectPathsDetailed diagnostics",
    );
  }
  return report.arrangement;
}
