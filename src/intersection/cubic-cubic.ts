import type { CubicBezier } from "../bezier/index.js";
import { evaluateCubic, subcurve } from "../bezier/index.js";
import type { ToleranceContext } from "../numeric/index.js";
import { createToleranceContext } from "../numeric/index.js";
import { analyzeCubicCubicDiscovery } from "./cubic-cubic-components.js";
import type { CubicIntersectionDiscoveryComponent } from "./cubic-cubic-components.js";
import { discoverCubicCubicIntersections } from "./cubic-cubic-discovery.js";
import type {
  CubicIntersectionDiscovery,
  CubicIntersectionDiscoveryOptions,
} from "./cubic-cubic-discovery.js";
import {
  refineCubicIntersectionPointWithSubdivision,
  refineCubicOverlapBoundaries,
} from "./cubic-cubic-refinement.js";
import type { OverlapBoundaryKind } from "./cubic-cubic-refinement.js";
import type { AnalyticIntersection, PairedIntersectionPoint } from "./intersection-types.js";
import { overlapIntersection, pairedPoint, pointIntersection } from "./intersection-types.js";

export type CubicComponentResolution = "point" | "overlap" | "multiple" | "none" | "incomplete";

export interface CubicComponentDiagnostic {
  readonly component: CubicIntersectionDiscoveryComponent;
  readonly resolution: CubicComponentResolution;
  readonly result: AnalyticIntersection | null;
  readonly results: readonly AnalyticIntersection[];
  readonly localComponentCount: number;
  readonly refinementExhausted: boolean;
  readonly startBoundaryKind: OverlapBoundaryKind | null;
  readonly endBoundaryKind: OverlapBoundaryKind | null;
}

function mapPair(
  pair: PairedIntersectionPoint,
  first: CubicBezier,
  second: CubicBezier,
  component: CubicIntersectionDiscoveryComponent,
): PairedIntersectionPoint {
  const map = (value: number, start: number, end: number): number => start + value * (end - start);
  const firstParameter = map(
    pair.occurrences[0].parameter,
    component.firstSpan.start,
    component.firstSpan.end,
  );
  const secondParameter = map(
    pair.occurrences[1].parameter,
    component.secondSpan.start,
    component.secondSpan.end,
  );
  return pairedPoint(
    firstParameter,
    evaluateCubic(first, firstParameter),
    secondParameter,
    evaluateCubic(second, secondParameter),
  );
}

function mapLocalResult(
  result: AnalyticIntersection,
  first: CubicBezier,
  second: CubicBezier,
  component: CubicIntersectionDiscoveryComponent,
): AnalyticIntersection {
  if (result.kind === "point") return pointIntersection(mapPair(result, first, second, component));
  return overlapIntersection(
    mapPair(result.start, first, second, component),
    mapPair(result.end, first, second, component),
    result.direction,
  );
}

export interface CubicCubicIntersectionReport {
  readonly intersections: readonly AnalyticIntersection[];
  readonly discovery: CubicIntersectionDiscovery;
  readonly components: readonly CubicComponentDiagnostic[];
  readonly complete: boolean;
}

function firstParameter(result: AnalyticIntersection): number {
  return result.kind === "point"
    ? result.occurrences[0].parameter
    : result.start.occurrences[0].parameter;
}

function duplicate(
  left: AnalyticIntersection,
  right: AnalyticIntersection,
  tolerance: ToleranceContext,
): boolean {
  if (left.kind !== "point" || right.kind !== "point") return false;
  return (
    Math.abs(left.occurrences[0].parameter - right.occurrences[0].parameter) <=
      tolerance.parameter &&
    Math.abs(left.occurrences[1].parameter - right.occurrences[1].parameter) <= tolerance.parameter
  );
}

/** Run discovery, component analysis, and refinement while retaining every diagnostic state. */
export function intersectCubicCubicDetailed(
  first: CubicBezier,
  second: CubicBezier,
  tolerance: ToleranceContext,
  options: CubicIntersectionDiscoveryOptions = {},
): CubicCubicIntersectionReport {
  const discovery = discoverCubicCubicIntersections(first, second, tolerance, options);
  const analyzed = analyzeCubicCubicDiscovery(discovery, tolerance);
  const diagnostics: CubicComponentDiagnostic[] = [];
  const results: AnalyticIntersection[] = [];

  for (const component of analyzed) {
    if (component.kind === "overlap") {
      const refined = refineCubicOverlapBoundaries(first, second, component, tolerance);
      const unresolved = refined.startKind === "unresolved" || refined.endKind === "unresolved";
      diagnostics.push(
        Object.freeze({
          component,
          resolution: refined.intersection === null || unresolved ? "incomplete" : "overlap",
          result: refined.intersection,
          results: Object.freeze(refined.intersection === null ? [] : [refined.intersection]),
          localComponentCount: 1,
          refinementExhausted: false,
          startBoundaryKind: refined.startKind,
          endBoundaryKind: refined.endKind,
        }),
      );
      if (refined.intersection !== null && !unresolved) results.push(refined.intersection);
      continue;
    }

    const firstLocal = subcurve(first, component.firstSpan.start, component.firstSpan.end);
    const secondLocal = subcurve(second, component.secondSpan.start, component.secondSpan.end);
    const localTolerance = createToleranceContext({
      ...tolerance,
      coordinate: Math.min(tolerance.coordinate, tolerance.intersection),
      discovery: tolerance.intersection,
    });
    const localDiscovery = discoverCubicCubicIntersections(
      firstLocal,
      secondLocal,
      localTolerance,
      options,
    );
    const localComponents = analyzeCubicCubicDiscovery(localDiscovery, localTolerance);
    const localResults: AnalyticIntersection[] = [];
    let refinementExhausted = localDiscovery.exhausted;
    let unresolved = false;
    for (const localComponent of localComponents) {
      if (localComponent.kind === "overlap") {
        const localOverlap = refineCubicOverlapBoundaries(
          firstLocal,
          secondLocal,
          localComponent,
          localTolerance,
        );
        if (
          localOverlap.intersection === null ||
          localOverlap.startKind === "unresolved" ||
          localOverlap.endKind === "unresolved"
        ) {
          unresolved = true;
        } else {
          localResults.push(mapLocalResult(localOverlap.intersection, first, second, component));
        }
      } else {
        const localPoint = refineCubicIntersectionPointWithSubdivision(
          firstLocal,
          secondLocal,
          localComponent,
          localTolerance,
          options,
        );
        refinementExhausted ||= localPoint.exhausted;
        if (localPoint.intersection !== null)
          localResults.push(mapLocalResult(localPoint.intersection, first, second, component));
      }
    }
    const incomplete = refinementExhausted || unresolved;
    const resolution: CubicComponentResolution = incomplete
      ? "incomplete"
      : localResults.length === 0
        ? "none"
        : localResults.length === 1
          ? localResults[0]!.kind
          : "multiple";
    diagnostics.push(
      Object.freeze({
        component,
        resolution,
        result: localResults.length === 1 ? localResults[0]! : null,
        results: Object.freeze(localResults),
        localComponentCount: localComponents.length,
        refinementExhausted,
        startBoundaryKind: null,
        endBoundaryKind: null,
      }),
    );
    results.push(...localResults);
  }

  results.sort((left, right) => firstParameter(left) - firstParameter(right));
  const unique = results.filter(
    (result, index) => index === 0 || !duplicate(results[index - 1]!, result, tolerance),
  );
  const complete =
    !discovery.exhausted && diagnostics.every((value) => value.resolution !== "incomplete");
  return Object.freeze({
    intersections: Object.freeze(unique),
    discovery,
    components: Object.freeze(diagnostics),
    complete,
  });
}

export function intersectCubicCubic(
  first: CubicBezier,
  second: CubicBezier,
  tolerance: ToleranceContext,
): readonly AnalyticIntersection[] {
  const report = intersectCubicCubicDetailed(first, second, tolerance);
  if (!report.complete) {
    throw new Error(
      "cubic/cubic intersection search is incomplete; inspect intersectCubicCubicDetailed diagnostics",
    );
  }
  return report.intersections;
}
