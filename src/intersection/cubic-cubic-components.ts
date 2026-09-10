import type { CubicBezier } from "../bezier/index.js";
import { reverseCubic } from "../bezier/index.js";
import type { ToleranceContext } from "../numeric/index.js";
import type {
  CubicIntersectionDiscovery,
  CubicIntersectionDiscoveryCell,
  ParameterInterval,
} from "./cubic-cubic-discovery.js";

export type DiscoveryComponentKind = "point" | "overlap" | "ambiguous";
export type DiscoveryCorrespondence = "same" | "opposite" | "unresolved";

export interface CertifiedDiscoveryCell {
  readonly cell: CubicIntersectionDiscoveryCell;
  readonly correspondence: Exclude<DiscoveryCorrespondence, "unresolved">;
  readonly certified: boolean;
  readonly maximumControlDiscrepancySquared: number;
}

export interface CubicIntersectionDiscoveryComponent {
  readonly cells: readonly CubicIntersectionDiscoveryCell[];
  readonly firstSpan: ParameterInterval;
  readonly secondSpan: ParameterInterval;
  readonly correspondence: DiscoveryCorrespondence;
  readonly kind: DiscoveryComponentKind;
  readonly certificates: readonly CertifiedDiscoveryCell[];
}

function intervalsAdjacent(
  first: ParameterInterval,
  second: ParameterInterval,
  tolerance: number,
): boolean {
  return first.start <= second.end + tolerance && second.start <= first.end + tolerance;
}

function cellsAdjacent(
  first: CubicIntersectionDiscoveryCell,
  second: CubicIntersectionDiscoveryCell,
  tolerance: number,
): boolean {
  return (
    intervalsAdjacent(first.firstInterval, second.firstInterval, tolerance) &&
    intervalsAdjacent(first.secondInterval, second.secondInterval, tolerance)
  );
}

function directionallyAdjacent(
  first: CubicIntersectionDiscoveryCell,
  second: CubicIntersectionDiscoveryCell,
  correspondence: "same" | "opposite",
  tolerance: number,
): boolean {
  if (!cellsAdjacent(first, second, tolerance)) return false;
  const firstA = (first.firstInterval.start + first.firstInterval.end) / 2;
  const secondA = (second.firstInterval.start + second.firstInterval.end) / 2;
  if (Math.abs(firstA - secondA) <= tolerance) return true;
  const earlier = firstA < secondA ? first : second;
  const later = firstA < secondA ? second : first;
  if (intervalsAdjacent(earlier.secondInterval, later.secondInterval, tolerance)) return true;
  const earlierB = (earlier.secondInterval.start + earlier.secondInterval.end) / 2;
  const laterB = (later.secondInterval.start + later.secondInterval.end) / 2;
  return correspondence === "same" ? laterB >= earlierB : laterB <= earlierB;
}

function maximumDifferenceControlLengthSquared(first: CubicBezier, second: CubicBezier): number {
  const firstPoints = [first.start, first.control1, first.control2, first.end];
  const secondPoints = [second.start, second.control1, second.control2, second.end];
  let maximum = 0;
  for (let index = 0; index < 4; index += 1) {
    const a = firstPoints[index]!;
    const b = secondPoints[index]!;
    const dx = a.x - b.x;
    const dy = a.y - b.y;
    maximum = Math.max(maximum, dx * dx + dy * dy);
  }
  return maximum;
}

function certify(
  cell: CubicIntersectionDiscoveryCell,
  correspondence: "same" | "opposite",
  tolerance: ToleranceContext,
): CertifiedDiscoveryCell {
  const second = correspondence === "same" ? cell.secondCurve : reverseCubic(cell.secondCurve);
  const maximumControlDiscrepancySquared = maximumDifferenceControlLengthSquared(
    cell.firstCurve,
    second,
  );
  return Object.freeze({
    cell,
    correspondence,
    certified: maximumControlDiscrepancySquared <= tolerance.discovery * tolerance.discovery,
    maximumControlDiscrepancySquared,
  });
}

function inferCorrespondence(
  cells: readonly CubicIntersectionDiscoveryCell[],
): DiscoveryCorrespondence {
  if (cells.length < 2) return "unresolved";
  let covariance = 0;
  let meanA = 0;
  let meanB = 0;
  for (const cell of cells) {
    meanA += cell.representativeParameters[0];
    meanB += cell.representativeParameters[1];
  }
  meanA /= cells.length;
  meanB /= cells.length;
  for (const cell of cells) {
    covariance +=
      (cell.representativeParameters[0] - meanA) * (cell.representativeParameters[1] - meanB);
  }
  const scale = cells.length * Number.EPSILON;
  return Math.abs(covariance) <= scale ? "unresolved" : covariance > 0 ? "same" : "opposite";
}

function span(cells: readonly CubicIntersectionDiscoveryCell[], first: boolean): ParameterInterval {
  let start = Number.POSITIVE_INFINITY;
  let end = Number.NEGATIVE_INFINITY;
  for (const cell of cells) {
    const value = first ? cell.firstInterval : cell.secondInterval;
    start = Math.min(start, value.start);
    end = Math.max(end, value.end);
  }
  return Object.freeze({ start, end });
}

function hasSpanningCertifiedChain(
  certifiedCells: readonly CubicIntersectionDiscoveryCell[],
  firstSpan: ParameterInterval,
  secondSpan: ParameterInterval,
  largestFirstCell: number,
  largestSecondCell: number,
  parameterTolerance: number,
  correspondence: "same" | "opposite",
): boolean {
  const unseen = new Set(certifiedCells.map((_, index) => index));
  while (unseen.size > 0) {
    const seed = unseen.values().next().value as number;
    unseen.delete(seed);
    const indices = [seed];
    for (let cursor = 0; cursor < indices.length; cursor += 1) {
      const current = indices[cursor]!;
      for (const candidate of [...unseen]) {
        if (
          directionallyAdjacent(
            certifiedCells[current]!,
            certifiedCells[candidate]!,
            correspondence,
            parameterTolerance,
          )
        ) {
          unseen.delete(candidate);
          indices.push(candidate);
        }
      }
    }
    const chain = indices.map((index) => certifiedCells[index]!);
    const chainFirst = span(chain, true);
    const chainSecond = span(chain, false);
    if (
      chainFirst.end - chainFirst.start > 2 * largestFirstCell &&
      chainSecond.end - chainSecond.start > 2 * largestSecondCell &&
      chainFirst.start <= firstSpan.start + largestFirstCell &&
      chainFirst.end >= firstSpan.end - largestFirstCell &&
      chainSecond.start <= secondSpan.start + largestSecondCell &&
      chainSecond.end >= secondSpan.end - largestSecondCell
    ) {
      return true;
    }
  }
  return false;
}

function component(
  cells: readonly CubicIntersectionDiscoveryCell[],
  tolerance: ToleranceContext,
): CubicIntersectionDiscoveryComponent {
  const ordered = Object.freeze(
    [...cells].sort(
      (a, b) =>
        a.firstInterval.start - b.firstInterval.start ||
        a.secondInterval.start - b.secondInterval.start,
    ),
  );
  const firstSpan = span(ordered, true);
  const secondSpan = span(ordered, false);
  const correspondence = inferCorrespondence(ordered);
  const certificates =
    correspondence === "unresolved"
      ? Object.freeze([])
      : Object.freeze(ordered.map((cell) => certify(cell, correspondence, tolerance)));
  const largestFirstCell = Math.max(
    ...ordered.map((cell) => cell.firstInterval.end - cell.firstInterval.start),
  );
  const largestSecondCell = Math.max(
    ...ordered.map((cell) => cell.secondInterval.end - cell.secondInterval.start),
  );
  const certifiedCells = certificates.filter((value) => value.certified).map((value) => value.cell);
  const certifiedSpine = hasSpanningCertifiedChain(
    certifiedCells,
    firstSpan,
    secondSpan,
    largestFirstCell,
    largestSecondCell,
    tolerance.parameter,
    correspondence === "unresolved" ? "same" : correspondence,
  );
  const collapsedToCellScale =
    firstSpan.end - firstSpan.start <= largestFirstCell + tolerance.parameter &&
    secondSpan.end - secondSpan.start <= largestSecondCell + tolerance.parameter;
  const kind: DiscoveryComponentKind =
    correspondence === "unresolved"
      ? collapsedToCellScale
        ? "point"
        : "ambiguous"
      : certifiedSpine
        ? "overlap"
        : "ambiguous";
  return Object.freeze({
    cells: ordered,
    firstSpan,
    secondSpan,
    correspondence,
    kind,
    certificates,
  });
}

/** Build connected paired-parameter components and certify proposed local correspondence. */
export function analyzeCubicCubicDiscovery(
  discovery: CubicIntersectionDiscovery,
  tolerance: ToleranceContext,
): readonly CubicIntersectionDiscoveryComponent[] {
  const cells = discovery.cells;
  const parents = cells.map((_, index) => index);
  const find = (index: number): number => {
    let root = index;
    while (parents[root] !== root) root = parents[root]!;
    while (parents[index] !== index) {
      const next = parents[index]!;
      parents[index] = root;
      index = next;
    }
    return root;
  };
  const unite = (left: number, right: number): void => {
    const leftRoot = find(left);
    const rightRoot = find(right);
    if (leftRoot !== rightRoot) parents[rightRoot] = leftRoot;
  };

  for (let left = 0; left < cells.length; left += 1) {
    for (let right = left + 1; right < cells.length; right += 1) {
      if (cells[right]!.firstInterval.start > cells[left]!.firstInterval.end + tolerance.parameter)
        break;
      if (cellsAdjacent(cells[left]!, cells[right]!, tolerance.parameter)) unite(left, right);
    }
  }

  const groups = new Map<number, CubicIntersectionDiscoveryCell[]>();
  for (let index = 0; index < cells.length; index += 1) {
    const root = find(index);
    const group = groups.get(root) ?? [];
    group.push(cells[index]!);
    groups.set(root, group);
  }
  return Object.freeze([...groups.values()].map((group) => component(group, tolerance)));
}
