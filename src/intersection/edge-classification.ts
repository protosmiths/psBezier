import type { ToleranceContext } from "../numeric/index.js";
import type { BezierPath } from "../path/index.js";
import type {
  IntersectionArrangement,
  IntersectionIncidence,
  IntersectionOverlap,
} from "./intersection-topology.js";
import { incidencesForPath, outgoingIntersectionEdge } from "./intersection-topology.js";

export const INNER = -1;
export const COINCIDENT = 0;
export const OUTER = 1;
export type GeometricEdgeState = typeof INNER | typeof COINCIDENT | typeof OUTER;
export type OrientationSign = -1 | 1;

export interface LoopPairClassificationScope {
  readonly kind: "loop-pair";
  readonly consumer: string;
  readonly first: BezierPath;
  readonly second: BezierPath;
}

export interface OutgoingEdgeClassificationSeed {
  readonly incidence: IntersectionIncidence;
  readonly state: GeometricEdgeState;
}

export interface OutgoingEdgeClassification extends OutgoingEdgeClassificationSeed {
  readonly relativeTo: BezierPath;
}

export interface LoopPairClassification {
  readonly arrangement: IntersectionArrangement;
  readonly scope: LoopPairClassificationScope;
  readonly classifications: readonly OutgoingEdgeClassification[];
}

export function loopPairClassificationScope(
  consumer: string,
  first: BezierPath,
  second: BezierPath,
): LoopPairClassificationScope {
  return Object.freeze({ kind: "loop-pair", consumer, first, second });
}

function otherPath(scope: LoopPairClassificationScope, path: BezierPath): BezierPath | null {
  if (path === scope.first) return scope.second;
  if (path === scope.second) return scope.first;
  return null;
}

export function buildLoopPairClassification(
  arrangement: IntersectionArrangement,
  scope: LoopPairClassificationScope,
  seeds: readonly OutgoingEdgeClassificationSeed[],
): LoopPairClassification {
  const classifications = seeds.map((seed): OutgoingEdgeClassification => {
    const relativeTo = otherPath(scope, seed.incidence.path) ?? scope.first;
    return Object.freeze({ ...seed, relativeTo });
  });
  return Object.freeze({ arrangement, scope, classifications: Object.freeze(classifications) });
}

export function outgoingEdgeClassification(
  interpretation: LoopPairClassification,
  incidence: IntersectionIncidence,
): OutgoingEdgeClassification | null {
  return interpretation.classifications.find((value) => value.incidence === incidence) ?? null;
}

export function incomingEdgeClassification(
  interpretation: LoopPairClassification,
  incidence: IntersectionIncidence,
): OutgoingEdgeClassification | null {
  return incidence.previous === null
    ? null
    : outgoingEdgeClassification(interpretation, incidence.previous);
}

export function effectiveWalkState(
  state: GeometricEdgeState,
  orientationSign: OrientationSign,
): GeometricEdgeState {
  return (state * orientationSign) as GeometricEdgeState;
}

export type EdgeClassificationIssueSeverity = "error" | "notice";
export type EdgeClassificationIssueCode =
  | "invalid-scope"
  | "foreign-incidence"
  | "wrong-relative-loop"
  | "missing-outgoing-edge"
  | "duplicate-classification"
  | "missing-classification"
  | "overlap-conflict"
  | "stationary-overlap"
  | "tied-occurrence";

export interface EdgeClassificationIssue {
  readonly severity: EdgeClassificationIssueSeverity;
  readonly code: EdgeClassificationIssueCode;
  readonly message: string;
}

export interface EdgeClassificationValidation {
  readonly valid: boolean;
  readonly complete: boolean;
  readonly issues: readonly EdgeClassificationIssue[];
}

function participatingIncidences(
  arrangement: IntersectionArrangement,
  scope: LoopPairClassificationScope,
): IntersectionIncidence[] {
  return [
    ...incidencesForPath(arrangement, scope.first),
    ...incidencesForPath(arrangement, scope.second),
  ].filter((incidence) => outgoingIntersectionEdge(incidence) !== null);
}

function incidenceAt(overlap: IntersectionOverlap, path: BezierPath, end: "start" | "end") {
  return overlap[end].incidences.find((incidence) => incidence.path === path) ?? null;
}

function directedIntervalIncidences(
  from: IntersectionIncidence,
  to: IntersectionIncidence,
): IntersectionIncidence[] | null {
  const result: IntersectionIncidence[] = [];
  let current = from;
  do {
    result.push(current);
    const next = current.next;
    if (next === null || next.path !== from.path) return null;
    current = next;
    if (result.length > from.arrangement.incidences.length) return null;
  } while (current !== to);
  return result;
}

function overlapConstrainedIncidences(
  overlap: IntersectionOverlap,
  scope: LoopPairClassificationScope,
): IntersectionIncidence[] | null {
  if (overlap.direction === "stationary") return null;
  const firstStart = incidenceAt(overlap, scope.first, "start");
  const firstEnd = incidenceAt(overlap, scope.first, "end");
  const secondStart = incidenceAt(overlap, scope.second, "start");
  const secondEnd = incidenceAt(overlap, scope.second, "end");
  if (firstStart === null || firstEnd === null || secondStart === null || secondEnd === null)
    return [];
  const first = directedIntervalIncidences(firstStart, firstEnd);
  const second =
    overlap.direction === "same"
      ? directedIntervalIncidences(secondStart, secondEnd)
      : directedIntervalIncidences(secondEnd, secondStart);
  return first === null || second === null ? [] : [...first, ...second];
}

export function validateLoopPairClassification(
  interpretation: LoopPairClassification,
  tolerance: ToleranceContext,
): EdgeClassificationValidation {
  const { arrangement, scope } = interpretation;
  const issues: EdgeClassificationIssue[] = [];
  const add = (
    severity: EdgeClassificationIssueSeverity,
    code: EdgeClassificationIssueCode,
    message: string,
  ) => issues.push(Object.freeze({ severity, code, message }));
  if (
    scope.first === scope.second ||
    !scope.first.isClosed ||
    !scope.second.isClosed ||
    !arrangement.paths.includes(scope.first) ||
    !arrangement.paths.includes(scope.second)
  )
    add("error", "invalid-scope", "scope requires two distinct closed paths in the arrangement");

  const seen = new Set<IntersectionIncidence>();
  for (const value of interpretation.classifications) {
    if (value.incidence.arrangement !== arrangement)
      add("error", "foreign-incidence", "classification incidence belongs to another arrangement");
    if (value.relativeTo !== otherPath(scope, value.incidence.path))
      add("error", "wrong-relative-loop", "classification is not relative to the other scope loop");
    if (outgoingIntersectionEdge(value.incidence) === null)
      add("error", "missing-outgoing-edge", "classification incidence has no outgoing edge");
    if (seen.has(value.incidence))
      add("error", "duplicate-classification", "incidence is classified more than once");
    seen.add(value.incidence);
  }

  const required = participatingIncidences(arrangement, scope);
  for (const incidence of required)
    if (!seen.has(incidence))
      add("notice", "missing-classification", "participating incidence is not classified");

  for (const path of [scope.first, scope.second]) {
    const values = incidencesForPath(arrangement, path);
    for (let index = 1; index < values.length; index += 1)
      if (Math.abs(values[index]!.globalT - values[index - 1]!.globalT) <= tolerance.parameter)
        add("notice", "tied-occurrence", "scope contains a tied path occurrence");
  }

  for (const overlap of arrangement.overlaps) {
    const overlapPaths = new Set(overlap.start.incidences.map((incidence) => incidence.path));
    if (!overlapPaths.has(scope.first) || !overlapPaths.has(scope.second)) continue;
    const constrained = overlapConstrainedIncidences(overlap, scope);
    if (constrained === null) {
      add("notice", "stationary-overlap", "stationary overlap has no directed edge constraint");
      continue;
    }
    for (const incidence of constrained) {
      const value = outgoingEdgeClassification(interpretation, incidence);
      if (value !== null && value.state !== COINCIDENT)
        add("error", "overlap-conflict", "overlap-covered edge must be COINCIDENT");
    }
  }

  const complete = !issues.some(
    (value) =>
      value.code === "missing-classification" ||
      value.code === "stationary-overlap" ||
      value.code === "tied-occurrence",
  );
  return Object.freeze({
    valid: !issues.some((value) => value.severity === "error"),
    complete,
    issues: Object.freeze(issues),
  });
}
