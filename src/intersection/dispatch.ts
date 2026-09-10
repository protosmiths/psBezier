import type { CubicBezier } from "../bezier/index.js";
import type { ToleranceContext } from "../numeric/index.js";
import type { AnalyticIntersection, LineSegment } from "./intersection-types.js";
import { swapIntersectionInputs } from "./intersection-types.js";
import { intersectLineCubic } from "./line-cubic.js";
import { intersectLineLine } from "./line-line.js";
import { intersectCubicCubic } from "./cubic-cubic.js";

export type AnalyticGeometry = LineSegment | CubicBezier;

function isLineSegment(value: AnalyticGeometry): value is LineSegment {
  return "kind" in value && value.kind === "line";
}

/**
 * Dispatch every supported geometry pair. Incomplete cubic/cubic searches throw;
 * use intersectCubicCubicDetailed when diagnostics or custom budgets are required.
 */
export function intersectAnalytic(
  first: AnalyticGeometry,
  second: AnalyticGeometry,
  tolerance: ToleranceContext,
): readonly AnalyticIntersection[] {
  if (isLineSegment(first)) {
    return isLineSegment(second)
      ? intersectLineLine(first, second, tolerance)
      : intersectLineCubic(first, second, tolerance);
  }
  if (isLineSegment(second)) {
    const swapped = intersectLineCubic(second, first, tolerance).map(swapIntersectionInputs);
    const firstParameter = (result: AnalyticIntersection): number =>
      result.kind === "point"
        ? result.occurrences[0].parameter
        : result.start.occurrences[0].parameter;
    swapped.sort((left, right) => firstParameter(left) - firstParameter(right));
    return Object.freeze(swapped);
  }
  return intersectCubicCubic(first, second, tolerance);
}
