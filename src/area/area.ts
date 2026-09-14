import { isLinearCubic, type CubicBezier } from "../bezier/index.js";
import { pathBezierAsCubic, type BezierPath } from "../path/index.js";
import type { CubicIntersectionDiscoveryOptions } from "../intersection/index.js";
import {
  intersectAnalytic,
  intersectCubicCubicDetailed,
  intersectPathsDetailed,
  lineSegment,
  type AnalyticIntersection,
  type PathIntersectionReport,
} from "../intersection/index.js";
import type { ToleranceContext } from "../numeric/index.js";
import {
  classifyPathOrientation,
  type PathOrientation,
  type PathOrientationSign,
} from "../path/index.js";

export interface AreaTermSeed {
  readonly path: BezierPath;
  readonly multiplicity?: number;
}

export interface AreaTerm {
  readonly path: BezierPath;
  readonly multiplicity: number;
  readonly signedArea: number;
  readonly orientation: Exclude<PathOrientation, "degenerate">;
  readonly orientationSign: PathOrientationSign;
  readonly signedContribution: number;
}

export interface Area {
  readonly terms: readonly AreaTerm[];
}

export type AreaConstructionIssueCode =
  | "invalid-multiplicity"
  | "open-path"
  | "degenerate-path"
  | "incomplete-self-intersection-search"
  | "self-intersecting-path"
  | "invalid-adjacent-segment-contact";

export interface AreaConstructionIssue {
  readonly termIndex: number;
  readonly code: AreaConstructionIssueCode;
  readonly message: string;
}

export interface AreaTermConstructionReport {
  readonly termIndex: number;
  readonly seed: AreaTermSeed;
  readonly term: AreaTerm | null;
  readonly selfIntersection: PathIntersectionReport | null;
  readonly valid: boolean;
  readonly complete: boolean;
  readonly issues: readonly AreaConstructionIssue[];
}

export interface AreaConstructionReport {
  readonly area: Area | null;
  readonly terms: readonly AreaTermConstructionReport[];
  readonly valid: boolean;
  readonly complete: boolean;
  readonly issues: readonly AreaConstructionIssue[];
}

function issue(
  termIndex: number,
  code: AreaConstructionIssueCode,
  message: string,
): AreaConstructionIssue {
  return Object.freeze({ termIndex, code, message });
}

function compareNumbers(first: number, second: number): number {
  return first < second ? -1 : first > second ? 1 : 0;
}

function termCoordinates(term: AreaTerm): number[] {
  return term.path.segments.flatMap((segment) => [
    segment.start.x,
    segment.start.y,
    segment.control1.x,
    segment.control1.y,
    segment.control2.x,
    segment.control2.y,
  ]);
}

function compareTerms(first: AreaTerm, second: AreaTerm): number {
  const summary =
    compareNumbers(first.signedArea, second.signedArea) ||
    compareNumbers(first.multiplicity, second.multiplicity) ||
    compareNumbers(first.path.segmentCount, second.path.segmentCount);
  if (summary !== 0) return summary;
  const firstCoordinates = termCoordinates(first);
  const secondCoordinates = termCoordinates(second);
  for (let index = 0; index < firstCoordinates.length; index += 1) {
    const comparison = compareNumbers(firstCoordinates[index]!, secondCoordinates[index]!);
    if (comparison !== 0) return comparison;
  }
  return 0;
}

function adjacentIntersections(
  first: CubicBezier,
  second: CubicBezier,
  tolerance: ToleranceContext,
  options: CubicIntersectionDiscoveryOptions,
): readonly AnalyticIntersection[] | null {
  const firstLinear = isLinearCubic(first, tolerance);
  const secondLinear = isLinearCubic(second, tolerance);
  const firstGeometry = firstLinear ? lineSegment(first.start, first.end) : first;
  const secondGeometry = secondLinear ? lineSegment(second.start, second.end) : second;
  if (firstLinear || secondLinear)
    return intersectAnalytic(firstGeometry, secondGeometry, tolerance);
  const report = intersectCubicCubicDetailed(first, second, tolerance, options);
  return report.complete ? report.intersections : null;
}

function adjacentContactStatus(
  path: BezierPath,
  tolerance: ToleranceContext,
  options: CubicIntersectionDiscoveryOptions,
): "valid" | "invalid" | "incomplete" {
  const checked = new Set<string>();
  for (const first of path.segments) {
    const second = first.next;
    if (second === null) continue;
    const key =
      first.index < second.index
        ? `${first.index}:${second.index}`
        : `${second.index}:${first.index}`;
    if (checked.has(key)) continue;
    checked.add(key);
    const results = adjacentIntersections(
      pathBezierAsCubic(first),
      pathBezierAsCubic(second),
      tolerance,
      options,
    );
    if (results === null) return "incomplete";
    for (const result of results) {
      if (result.kind === "overlap") return "invalid";
      const firstParameter = result.occurrences[0].parameter;
      const secondParameter = result.occurrences[1].parameter;
      const expectedFirst = first.next === second ? 1 : 0;
      const expectedSecond = first.next === second ? 0 : 1;
      if (
        Math.abs(firstParameter - expectedFirst) > tolerance.parameter ||
        Math.abs(secondParameter - expectedSecond) > tolerance.parameter
      )
        return "invalid";
    }
  }
  return "valid";
}

function constructTerm(
  seed: AreaTermSeed,
  termIndex: number,
  tolerance: ToleranceContext,
  options: CubicIntersectionDiscoveryOptions,
): AreaTermConstructionReport {
  const issues: AreaConstructionIssue[] = [];
  const multiplicity = seed.multiplicity ?? 1;
  if (!Number.isSafeInteger(multiplicity) || multiplicity <= 0)
    issues.push(
      issue(termIndex, "invalid-multiplicity", "Area multiplicity must be a positive safe integer"),
    );
  if (!seed.path.isClosed)
    issues.push(issue(termIndex, "open-path", "an Area boundary path must be closed"));

  let orientation: ReturnType<typeof classifyPathOrientation> | null = null;
  if (seed.path.isClosed) {
    orientation = classifyPathOrientation(seed.path, tolerance);
    if (orientation.orientation === "degenerate")
      issues.push(
        issue(termIndex, "degenerate-path", "an Area boundary must have resolved nonzero area"),
      );
  }

  if (seed.path.isClosed) {
    const adjacentStatus = adjacentContactStatus(seed.path, tolerance, options);
    if (adjacentStatus === "invalid")
      issues.push(
        issue(
          termIndex,
          "invalid-adjacent-segment-contact",
          "adjacent Area segments may meet only at their shared structural knot",
        ),
      );
    if (adjacentStatus === "incomplete")
      issues.push(
        issue(
          termIndex,
          "incomplete-self-intersection-search",
          "adjacent-segment search did not establish whether the Area boundary is simple",
        ),
      );
  }

  let selfIntersection: PathIntersectionReport | null = null;
  if (seed.path.isClosed) {
    selfIntersection = intersectPathsDetailed(seed.path, seed.path, tolerance, options);
    if (!selfIntersection.complete)
      issues.push(
        issue(
          termIndex,
          "incomplete-self-intersection-search",
          "self-intersection search did not establish whether the Area boundary is simple",
        ),
      );
    else if (
      selfIntersection.arrangement !== null &&
      (selfIntersection.arrangement.events.length > 0 ||
        selfIntersection.arrangement.overlaps.length > 0)
    )
      issues.push(
        issue(termIndex, "self-intersecting-path", "an Area boundary must be a simple loop"),
      );
  }

  const complete = !issues.some((value) => value.code === "incomplete-self-intersection-search");
  const valid = issues.length === 0;
  const term =
    valid &&
    orientation !== null &&
    orientation.orientation !== "degenerate" &&
    orientation.orientationSign !== null
      ? Object.freeze({
          path: seed.path,
          multiplicity,
          signedArea: orientation.signedArea,
          orientation: orientation.orientation,
          orientationSign: orientation.orientationSign,
          signedContribution: orientation.orientationSign * multiplicity,
        })
      : null;
  return Object.freeze({
    termIndex,
    seed,
    term,
    selfIntersection,
    valid,
    complete,
    issues: Object.freeze(issues),
  });
}

export function createAreaDetailed(
  seeds: readonly AreaTermSeed[],
  tolerance: ToleranceContext,
  options: CubicIntersectionDiscoveryOptions = {},
): AreaConstructionReport {
  const terms = seeds.map((seed, index) => constructTerm(seed, index, tolerance, options));
  const issues = terms.flatMap((term) => term.issues);
  const complete = terms.every((term) => term.complete);
  const valid = terms.every((term) => term.valid);
  const areaTerms = terms.flatMap((report) => (report.term === null ? [] : [report.term]));
  const area =
    valid && complete
      ? Object.freeze({ terms: Object.freeze(areaTerms.sort(compareTerms)) })
      : null;
  return Object.freeze({
    area,
    terms: Object.freeze(terms),
    valid,
    complete,
    issues: Object.freeze(issues),
  });
}

export function createArea(seeds: readonly AreaTermSeed[], tolerance: ToleranceContext): Area {
  const report = createAreaDetailed(seeds, tolerance);
  if (report.area === null)
    throw new Error("Area construction failed; inspect createAreaDetailed diagnostics");
  return report.area;
}
