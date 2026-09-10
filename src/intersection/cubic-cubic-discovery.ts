import type { BoundingBox, CubicBezier } from "../bezier/index.js";
import { cubicBoundingBox, evaluateCubic, splitCubic } from "../bezier/index.js";
import type { Point, ToleranceContext } from "../numeric/index.js";

export interface ParameterInterval {
  readonly start: number;
  readonly end: number;
}

export type DiscoveryTermination = "geometric" | "parameter-limit";

export interface CubicIntersectionDiscoveryCell {
  readonly firstInterval: ParameterInterval;
  readonly secondInterval: ParameterInterval;
  readonly firstCurve: CubicBezier;
  readonly secondCurve: CubicBezier;
  readonly firstBounds: BoundingBox;
  readonly secondBounds: BoundingBox;
  readonly representativeParameters: readonly [number, number];
  readonly representativePoints: readonly [Point, Point];
  readonly discrepancySquared: number;
  readonly depth: number;
  readonly termination: DiscoveryTermination;
}

export interface CubicIntersectionDiscoveryOptions {
  readonly maxDepth?: number;
  readonly maxCells?: number;
}

export interface CubicIntersectionDiscovery {
  readonly cells: readonly CubicIntersectionDiscoveryCell[];
  readonly exhausted: boolean;
  readonly visitedNodes: number;
}

interface SearchNode {
  readonly firstCurve: CubicBezier;
  readonly secondCurve: CubicBezier;
  readonly firstInterval: ParameterInterval;
  readonly secondInterval: ParameterInterval;
  readonly depth: number;
}

function interval(start: number, end: number): ParameterInterval {
  return Object.freeze({ start, end });
}

function axisGap(firstMin: number, firstMax: number, secondMin: number, secondMax: number): number {
  return Math.max(0, firstMin - secondMax, secondMin - firstMax);
}

function boundsWithinDistance(first: BoundingBox, second: BoundingBox, distance: number): boolean {
  return (
    axisGap(first.min.x, first.max.x, second.min.x, second.max.x) <= distance &&
    axisGap(first.min.y, first.max.y, second.min.y, second.max.y) <= distance
  );
}

function boundsDiagonalSquared(bounds: BoundingBox): number {
  const width = bounds.max.x - bounds.min.x;
  const height = bounds.max.y - bounds.min.y;
  return width * width + height * height;
}

function splitNode(node: SearchNode, splitFirst: boolean): readonly SearchNode[] {
  if (splitFirst) {
    const [left, right] = splitCubic(node.firstCurve, 0.5);
    const middle = (node.firstInterval.start + node.firstInterval.end) / 2;
    return Object.freeze([
      Object.freeze({
        ...node,
        firstCurve: left,
        firstInterval: interval(node.firstInterval.start, middle),
        depth: node.depth + 1,
      }),
      Object.freeze({
        ...node,
        firstCurve: right,
        firstInterval: interval(middle, node.firstInterval.end),
        depth: node.depth + 1,
      }),
    ]);
  }
  const [left, right] = splitCubic(node.secondCurve, 0.5);
  const middle = (node.secondInterval.start + node.secondInterval.end) / 2;
  return Object.freeze([
    Object.freeze({
      ...node,
      secondCurve: left,
      secondInterval: interval(node.secondInterval.start, middle),
      depth: node.depth + 1,
    }),
    Object.freeze({
      ...node,
      secondCurve: right,
      secondInterval: interval(middle, node.secondInterval.end),
      depth: node.depth + 1,
    }),
  ]);
}

function discoveryCell(
  node: SearchNode,
  firstBounds: BoundingBox,
  secondBounds: BoundingBox,
  termination: DiscoveryTermination,
): CubicIntersectionDiscoveryCell {
  const firstParameter = (node.firstInterval.start + node.firstInterval.end) / 2;
  const secondParameter = (node.secondInterval.start + node.secondInterval.end) / 2;
  const firstPoint = evaluateCubic(node.firstCurve, 0.5);
  const secondPoint = evaluateCubic(node.secondCurve, 0.5);
  const dx = firstPoint.x - secondPoint.x;
  const dy = firstPoint.y - secondPoint.y;
  const representativeParameters: readonly [number, number] = Object.freeze([
    firstParameter,
    secondParameter,
  ]);
  const representativePoints: readonly [Point, Point] = Object.freeze([firstPoint, secondPoint]);
  return Object.freeze({
    firstInterval: node.firstInterval,
    secondInterval: node.secondInterval,
    firstCurve: node.firstCurve,
    secondCurve: node.secondCurve,
    firstBounds,
    secondBounds,
    representativeParameters,
    representativePoints,
    discrepancySquared: dx * dx + dy * dy,
    depth: node.depth,
    termination,
  });
}

/** Discover localized cubic/cubic candidate cells without assigning topology semantics. */
export function discoverCubicCubicIntersections(
  first: CubicBezier,
  second: CubicBezier,
  tolerance: ToleranceContext,
  options: CubicIntersectionDiscoveryOptions = {},
): CubicIntersectionDiscovery {
  const maxDepth = options.maxDepth ?? 64;
  const maxCells = options.maxCells ?? 100_000;
  if (!Number.isInteger(maxDepth) || maxDepth < 0)
    throw new RangeError("maxDepth must be a nonnegative integer");
  if (!Number.isInteger(maxCells) || maxCells <= 0)
    throw new RangeError("maxCells must be a positive integer");

  const pending: SearchNode[] = [
    Object.freeze({
      firstCurve: first,
      secondCurve: second,
      firstInterval: interval(0, 1),
      secondInterval: interval(0, 1),
      depth: 0,
    }),
  ];
  const cells: CubicIntersectionDiscoveryCell[] = [];
  const discoverySquared = tolerance.discovery * tolerance.discovery;
  let exhausted = false;
  let visitedNodes = 0;

  while (pending.length > 0) {
    if (visitedNodes >= maxCells) {
      exhausted = true;
      break;
    }
    const node = pending.pop();
    if (node === undefined) break;
    visitedNodes += 1;
    const firstBounds = cubicBoundingBox(node.firstCurve);
    const secondBounds = cubicBoundingBox(node.secondCurve);
    if (!boundsWithinDistance(firstBounds, secondBounds, tolerance.discovery)) continue;

    const firstSmall = boundsDiagonalSquared(firstBounds) <= discoverySquared;
    const secondSmall = boundsDiagonalSquared(secondBounds) <= discoverySquared;
    const firstWidth = node.firstInterval.end - node.firstInterval.start;
    const secondWidth = node.secondInterval.end - node.secondInterval.start;
    const parameterLimited =
      firstWidth <= tolerance.parameter && secondWidth <= tolerance.parameter;

    if ((firstSmall && secondSmall) || parameterLimited) {
      cells.push(
        discoveryCell(
          node,
          firstBounds,
          secondBounds,
          parameterLimited ? "parameter-limit" : "geometric",
        ),
      );
      continue;
    }
    if (node.depth >= maxDepth) {
      exhausted = true;
      continue;
    }

    const splitFirst =
      !firstSmall &&
      (secondSmall || boundsDiagonalSquared(firstBounds) >= boundsDiagonalSquared(secondBounds));
    const children = splitNode(node, splitFirst);
    pending.push(children[1]!, children[0]!);
  }

  cells.sort(
    (left, right) =>
      left.firstInterval.start - right.firstInterval.start ||
      left.secondInterval.start - right.secondInterval.start,
  );
  return Object.freeze({ cells: Object.freeze(cells), exhausted, visitedNodes });
}
