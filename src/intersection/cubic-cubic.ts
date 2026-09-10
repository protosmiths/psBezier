import type { CubicBezier } from "../bezier/index.js";
import type { ToleranceContext } from "../numeric/index.js";
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
import type { AnalyticIntersection } from "./intersection-types.js";

export type CubicComponentResolution = "point" | "overlap" | "none" | "incomplete";

export interface CubicComponentDiagnostic {
  readonly component: CubicIntersectionDiscoveryComponent;
  readonly resolution: CubicComponentResolution;
  readonly result: AnalyticIntersection | null;
  readonly refinementExhausted: boolean;
  readonly startBoundaryKind: OverlapBoundaryKind | null;
  readonly endBoundaryKind: OverlapBoundaryKind | null;
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
          refinementExhausted: false,
          startBoundaryKind: refined.startKind,
          endBoundaryKind: refined.endKind,
        }),
      );
      if (refined.intersection !== null && !unresolved) results.push(refined.intersection);
      continue;
    }

    const refined = refineCubicIntersectionPointWithSubdivision(
      first,
      second,
      component,
      tolerance,
      options,
    );
    const resolution: CubicComponentResolution = refined.exhausted
      ? "incomplete"
      : refined.intersection === null
        ? "none"
        : "point";
    diagnostics.push(
      Object.freeze({
        component,
        resolution,
        result: refined.intersection,
        refinementExhausted: refined.exhausted,
        startBoundaryKind: null,
        endBoundaryKind: null,
      }),
    );
    if (refined.intersection !== null) results.push(refined.intersection);
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
