import type { CubicBezier } from "../bezier/index.js";
import { cubicDerivative, evaluateCubic } from "../bezier/index.js";
import type { ToleranceContext } from "../numeric/index.js";
import { cross, lengthSquared, subtractPoints } from "../numeric/index.js";
import type { CubicIntersectionDiscoveryComponent } from "./cubic-cubic-components.js";
import type { PointIntersection } from "./intersection-types.js";
import { pairedPoint, pointIntersection } from "./intersection-types.js";

function clamp(value: number, minimum: number, maximum: number): number {
  return Math.max(minimum, Math.min(maximum, value));
}

/** Refine a point-like discovery component without searching outside its saved rectangle. */
export function refineCubicIntersectionPoint(
  first: CubicBezier,
  second: CubicBezier,
  component: CubicIntersectionDiscoveryComponent,
  tolerance: ToleranceContext,
): PointIntersection | null {
  const seed = component.cells.reduce((best, cell) =>
    cell.discrepancySquared < best.discrepancySquared ? cell : best,
  );
  let firstParameter = seed.representativeParameters[0];
  let secondParameter = seed.representativeParameters[1];
  const targetSquared = tolerance.intersection * tolerance.intersection;

  for (let iteration = 0; iteration < 32; iteration += 1) {
    const firstPoint = evaluateCubic(first, firstParameter);
    const secondPoint = evaluateCubic(second, secondParameter);
    const difference = subtractPoints(firstPoint, secondPoint);
    if (lengthSquared(difference) <= targetSquared) {
      return pointIntersection(
        pairedPoint(firstParameter, firstPoint, secondParameter, secondPoint),
      );
    }

    const firstDerivative = cubicDerivative(first, firstParameter);
    const secondDerivative = cubicDerivative(second, secondParameter);
    const determinant = cross(firstDerivative, secondDerivative);
    const conditioningScale = lengthSquared(firstDerivative) * lengthSquared(secondDerivative);
    if (
      conditioningScale === 0 ||
      determinant * determinant <= tolerance.relative * tolerance.relative * conditioningScale
    ) {
      break;
    }

    const firstStep = -cross(difference, secondDerivative) / determinant;
    const secondStep = cross(firstDerivative, difference) / determinant;
    const nextFirst = clamp(
      firstParameter + firstStep,
      component.firstSpan.start,
      component.firstSpan.end,
    );
    const nextSecond = clamp(
      secondParameter + secondStep,
      component.secondSpan.start,
      component.secondSpan.end,
    );
    if (
      Math.abs(nextFirst - firstParameter) <= tolerance.parameter &&
      Math.abs(nextSecond - secondParameter) <= tolerance.parameter
    ) {
      break;
    }
    firstParameter = nextFirst;
    secondParameter = nextSecond;
  }

  // Newton is only an accelerator. The caller retains the unresolved component
  // for subdivision refinement when this local solve is singular or inconclusive.
  return null;
}
