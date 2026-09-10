import type { CubicBezier } from "../bezier/index.js";
import { cubicDerivative, evaluateCubic, subcurve } from "../bezier/index.js";
import type { ToleranceContext } from "../numeric/index.js";
import { createToleranceContext, cross, lengthSquared, subtractPoints } from "../numeric/index.js";
import type { CubicIntersectionDiscoveryComponent } from "./cubic-cubic-components.js";
import { discoverCubicCubicIntersections } from "./cubic-cubic-discovery.js";
import type {
  OverlapIntersection,
  PairedIntersectionPoint,
  PointIntersection,
} from "./intersection-types.js";
import { overlapIntersection, pairedPoint, pointIntersection } from "./intersection-types.js";

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

export interface CubicPointRefinementOptions {
  readonly maxDepth?: number;
  readonly maxCells?: number;
}

export interface CubicPointRefinement {
  readonly intersection: PointIntersection | null;
  readonly usedSubdivision: boolean;
  readonly exhausted: boolean;
  readonly visitedNodes: number;
}

/** Use safeguarded Newton first, then refine only inside the saved component rectangle. */
export function refineCubicIntersectionPointWithSubdivision(
  first: CubicBezier,
  second: CubicBezier,
  component: CubicIntersectionDiscoveryComponent,
  tolerance: ToleranceContext,
  options: CubicPointRefinementOptions = {},
): CubicPointRefinement {
  const accelerated = refineCubicIntersectionPoint(first, second, component, tolerance);
  if (accelerated !== null) {
    return Object.freeze({
      intersection: accelerated,
      usedSubdivision: false,
      exhausted: false,
      visitedNodes: 0,
    });
  }

  const firstLocal = subcurve(first, component.firstSpan.start, component.firstSpan.end);
  const secondLocal = subcurve(second, component.secondSpan.start, component.secondSpan.end);
  const refinementTolerance = createToleranceContext({
    ...tolerance,
    coordinate: Math.min(tolerance.coordinate, tolerance.intersection),
    discovery: tolerance.intersection,
  });
  const discovery = discoverCubicCubicIntersections(
    firstLocal,
    secondLocal,
    refinementTolerance,
    options,
  );
  if (discovery.cells.length === 0) {
    return Object.freeze({
      intersection: null,
      usedSubdivision: true,
      exhausted: discovery.exhausted,
      visitedNodes: discovery.visitedNodes,
    });
  }

  const candidate = discovery.cells.reduce((best, cell) =>
    cell.discrepancySquared < best.discrepancySquared ? cell : best,
  );
  const mapParameter = (local: number, start: number, end: number): number =>
    start + local * (end - start);
  const firstParameter = mapParameter(
    candidate.representativeParameters[0],
    component.firstSpan.start,
    component.firstSpan.end,
  );
  const secondParameter = mapParameter(
    candidate.representativeParameters[1],
    component.secondSpan.start,
    component.secondSpan.end,
  );
  const firstPoint = evaluateCubic(first, firstParameter);
  const secondPoint = evaluateCubic(second, secondParameter);
  const difference = subtractPoints(firstPoint, secondPoint);
  const intersection =
    lengthSquared(difference) <= tolerance.intersection * tolerance.intersection
      ? pointIntersection(pairedPoint(firstParameter, firstPoint, secondParameter, secondPoint))
      : null;
  return Object.freeze({
    intersection,
    usedSubdivision: true,
    exhausted: discovery.exhausted,
    visitedNodes: discovery.visitedNodes,
  });
}

export interface CubicOverlapRefinement {
  readonly intersection: OverlapIntersection | null;
  readonly certifiedCellCount: number;
  readonly startKind: OverlapBoundaryKind | null;
  readonly endKind: OverlapBoundaryKind | null;
}

export type OverlapBoundaryKind = "exact" | "tolerance" | "domain" | "unresolved";

function pairedAt(
  first: CubicBezier,
  second: CubicBezier,
  firstParameter: number,
  secondParameter: number,
): PairedIntersectionPoint {
  return pairedPoint(
    firstParameter,
    evaluateCubic(first, firstParameter),
    secondParameter,
    evaluateCubic(second, secondParameter),
  );
}

/** Localize the terminal correspondences of an already-certified overlap component. */
export function refineCubicOverlapBoundaries(
  first: CubicBezier,
  second: CubicBezier,
  component: CubicIntersectionDiscoveryComponent,
  tolerance: ToleranceContext,
): CubicOverlapRefinement {
  if (component.kind !== "overlap" || component.correspondence === "unresolved") {
    return Object.freeze({
      intersection: null,
      certifiedCellCount: 0,
      startKind: null,
      endKind: null,
    });
  }
  const certified = component.certifiedSpine;
  if (certified.length === 0) {
    return Object.freeze({
      intersection: null,
      certifiedCellCount: 0,
      startKind: null,
      endKind: null,
    });
  }
  const minimumA = Math.min(...certified.map((value) => value.cell.firstInterval.start));
  const maximumA = Math.max(...certified.map((value) => value.cell.firstInterval.end));
  const startCells = certified.filter(
    (value) => value.cell.firstInterval.start <= minimumA + tolerance.parameter,
  );
  const endCells = certified.filter(
    (value) => value.cell.firstInterval.end >= maximumA - tolerance.parameter,
  );
  const boundary = (value: (typeof certified)[number], start: boolean): PairedIntersectionPoint => {
    const cell = value.cell;
    const firstParameter = start ? cell.firstInterval.start : cell.firstInterval.end;
    const secondParameter =
      component.correspondence === "same"
        ? start
          ? cell.secondInterval.start
          : cell.secondInterval.end
        : start
          ? cell.secondInterval.end
          : cell.secondInterval.start;
    return pairedAt(first, second, firstParameter, secondParameter);
  };
  const bestBoundary = (
    values: readonly (typeof certified)[number][],
    start: boolean,
  ): PairedIntersectionPoint =>
    values
      .map((value) => boundary(value, start))
      .reduce((best, value) => (value.errorSquared < best.errorSquared ? value : best));
  const refineFrontier = (
    frontierCells: readonly (typeof certified)[number][],
    start: boolean,
  ): readonly [PairedIntersectionPoint, OverlapBoundaryKind] => {
    const inside = bestBoundary(frontierCells, start);
    if (inside.errorSquared <= tolerance.intersection * tolerance.intersection) {
      return Object.freeze([inside, "exact"]);
    }
    const firstParameter = inside.occurrences[0].parameter;
    if ((start && firstParameter === 0) || (!start && firstParameter === 1)) {
      return Object.freeze([inside, "domain"]);
    }
    const insideBParameter = inside.occurrences[1].parameter;
    const threshold = tolerance.discovery * tolerance.discovery;
    const directionSign = component.correspondence === "same" ? 1 : -1;
    const candidates = component.certificates
      .filter((value) => !value.certified)
      .map((value) => value.cell)
      .filter((cell) => {
        const candidateA = cell.representativeParameters[0];
        const candidateB = cell.representativeParameters[1];
        if (start ? candidateA >= firstParameter : candidateA <= firstParameter) return false;
        const progression = (candidateA - firstParameter) * (candidateB - insideBParameter);
        if (directionSign * progression < -tolerance.parameter * tolerance.parameter) return false;
        // Failure of the hull certificate is not an outside sample. The paired
        // representative itself must establish displacement beyond epsilon.
        return cell.discrepancySquared > threshold;
      });
    if (candidates.length === 0) return Object.freeze([inside, "unresolved"]);
    const outsideCell = candidates.reduce((best, cell) =>
      Math.abs(cell.representativeParameters[0] - firstParameter) <
      Math.abs(best.representativeParameters[0] - firstParameter)
        ? cell
        : best,
    );
    let outsideA = outsideCell.representativeParameters[0];
    let outsideB = outsideCell.representativeParameters[1];
    let insideA = inside.occurrences[0].parameter;
    let insideB = inside.occurrences[1].parameter;
    // This straight interpolation is only within an already localized paired
    // bracket; it makes no claim that the global A-to-B correspondence is linear.
    for (let iteration = 0; iteration < 64; iteration += 1) {
      if (
        Math.abs(insideA - outsideA) <= tolerance.parameter &&
        Math.abs(insideB - outsideB) <= tolerance.parameter
      )
        break;
      const middleA = (insideA + outsideA) / 2;
      const middleB = (insideB + outsideB) / 2;
      const middle = pairedAt(first, second, middleA, middleB);
      if (middle.errorSquared <= threshold) {
        insideA = middleA;
        insideB = middleB;
      } else {
        outsideA = middleA;
        outsideB = middleB;
      }
    }
    return Object.freeze([pairedAt(first, second, insideA, insideB), "tolerance"]);
  };
  const [start, startKind] = refineFrontier(startCells, true);
  const [end, endKind] = refineFrontier(endCells, false);
  const discoverySquared = tolerance.discovery * tolerance.discovery;
  if (start.errorSquared > discoverySquared || end.errorSquared > discoverySquared) {
    return Object.freeze({
      intersection: null,
      certifiedCellCount: certified.length,
      startKind: null,
      endKind: null,
    });
  }
  return Object.freeze({
    intersection: overlapIntersection(start, end, component.correspondence),
    certifiedCellCount: certified.length,
    startKind,
    endKind,
  });
}
