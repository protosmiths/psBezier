import {
  COINCIDENT,
  effectiveWalkState,
  outgoingEdgeClassification,
  type LoopPairClassification,
  type OrientationSign,
} from "../intersection/edge-classification.js";
import type {
  LoopPairEventCharacterization,
  LoopPairEventCharacterizationReport,
} from "../intersection/event-characterization.js";
import {
  outgoingIntersectionEdge,
  type IntersectionEvent,
  type IntersectionIncidence,
  type IntersectionOverlap,
} from "../intersection/intersection-topology.js";
import {
  analyzeDirectedTransitionGraph,
  type DirectedTransitionCorridor,
  type DirectedTransitionEdge,
  type DirectedTransitionGraphReport,
} from "./transition-graph.js";

export type BinaryLoopOperation = "union" | "intersection";

export interface LoopPairOrientationSigns {
  readonly first: OrientationSign;
  readonly second: OrientationSign;
}

export type LoopPairTransitionPlanIssueCode =
  | "incomplete-characterization"
  | "missing-characterization"
  | "unresolved-event"
  | "unsupported-full-coincidence"
  | "invalid-overlap"
  | "no-valid-corridor-selection"
  | "ambiguous-corridor-selection";

export interface LoopPairTransitionPlanIssue {
  readonly code: LoopPairTransitionPlanIssueCode;
  readonly message: string;
}

export interface LoopPairTransitionPlan {
  readonly operation: BinaryLoopOperation;
  readonly orientations: LoopPairOrientationSigns;
  readonly edges: readonly DirectedTransitionEdge[];
  readonly graph: DirectedTransitionGraphReport;
  readonly valid: boolean;
  readonly complete: boolean;
  readonly issues: readonly LoopPairTransitionPlanIssue[];
}

interface CorridorCandidate {
  readonly overlap: IntersectionOverlap;
  readonly owner: object;
  readonly edges: readonly DirectedTransitionEdge[];
}

function issue(
  code: LoopPairTransitionPlanIssueCode,
  message: string,
): LoopPairTransitionPlanIssue {
  return Object.freeze({ code, message });
}

function incidenceForPath(event: IntersectionEvent, path: object): IntersectionIncidence | null {
  return event.incidences.find((incidence) => incidence.path === path) ?? null;
}

function characterizationMap(report: LoopPairEventCharacterizationReport) {
  return new Map(report.events.map((value) => [value.event, value]));
}

function vertexFor(
  incidence: IntersectionIncidence,
  characterizations: ReadonlyMap<IntersectionEvent, LoopPairEventCharacterization>,
): object {
  const kind = characterizations.get(incidence.event)?.kind;
  return kind === "transverse" || kind === "overlap-frontier" ? incidence.event : incidence;
}

function selectedNoncoincidentEdges(
  interpretation: LoopPairClassification,
  characterizations: ReadonlyMap<IntersectionEvent, LoopPairEventCharacterization>,
  operation: BinaryLoopOperation,
  orientations: LoopPairOrientationSigns,
): DirectedTransitionEdge[] {
  const wanted = operation === "union" ? 1 : -1;
  const result: DirectedTransitionEdge[] = [];
  for (const incidence of interpretation.arrangement.incidences) {
    if (
      incidence.path !== interpretation.scope.first &&
      incidence.path !== interpretation.scope.second
    )
      continue;
    const classification = outgoingEdgeClassification(interpretation, incidence);
    const edge = outgoingIntersectionEdge(incidence);
    if (classification === null || edge === null || classification.state === COINCIDENT) continue;
    const orientation =
      incidence.path === interpretation.scope.first ? orientations.first : orientations.second;
    if (effectiveWalkState(classification.state, orientation) !== wanted) continue;
    result.push(
      Object.freeze({
        identity: incidence,
        from: vertexFor(incidence, characterizations),
        to: vertexFor(edge.to, characterizations),
      }),
    );
  }
  return result;
}

function intervalIncidences(
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

function candidateForPath(
  overlap: IntersectionOverlap,
  path: object,
  reverseEndpoints: boolean,
  characterizations: ReadonlyMap<IntersectionEvent, LoopPairEventCharacterization>,
): CorridorCandidate | null {
  const startEvent = reverseEndpoints ? overlap.end : overlap.start;
  const endEvent = reverseEndpoints ? overlap.start : overlap.end;
  const start = incidenceForPath(startEvent, path);
  const end = incidenceForPath(endEvent, path);
  if (start === null || end === null || start === end) return null;
  const incidences = intervalIncidences(start, end);
  if (incidences === null || incidences.length === 0) return null;
  const tiles = Object.freeze(incidences.map((incidence) => incidence as object));
  const corridor: DirectedTransitionCorridor = Object.freeze({ identity: overlap, tiles });
  return Object.freeze({
    overlap,
    owner: path,
    edges: Object.freeze(
      incidences.map((incidence, index): DirectedTransitionEdge => {
        const edge = outgoingIntersectionEdge(incidence)!;
        return Object.freeze({
          identity: incidence,
          from: vertexFor(incidence, characterizations),
          to: vertexFor(edge.to, characterizations),
          corridor,
          corridorTile: tiles[index]!,
          owner: path,
        });
      }),
    ),
  });
}

function overlapCandidates(
  interpretation: LoopPairClassification,
  overlap: IntersectionOverlap,
  characterizations: ReadonlyMap<IntersectionEvent, LoopPairEventCharacterization>,
): readonly CorridorCandidate[] | null {
  if (overlap.direction === "stationary") return null;
  const first = candidateForPath(overlap, interpretation.scope.first, false, characterizations);
  const second = candidateForPath(
    overlap,
    interpretation.scope.second,
    overlap.direction === "opposite",
    characterizations,
  );
  return first === null || second === null ? null : Object.freeze([first, second]);
}

interface ValidSelection {
  readonly choices: readonly (CorridorCandidate | null)[];
  readonly edges: readonly DirectedTransitionEdge[];
  readonly graph: DirectedTransitionGraphReport;
}

function validSelections(
  ordinary: readonly DirectedTransitionEdge[],
  corridors: readonly (readonly CorridorCandidate[])[],
): ValidSelection[] {
  const results: ValidSelection[] = [];
  const visit = (index: number, choices: readonly (CorridorCandidate | null)[]) => {
    if (index < corridors.length) {
      visit(index + 1, [...choices, null]);
      for (const candidate of corridors[index]!) visit(index + 1, [...choices, candidate]);
      return;
    }
    const edges = Object.freeze([
      ...ordinary,
      ...choices.flatMap((candidate) => candidate?.edges ?? []),
    ]);
    const graph = analyzeDirectedTransitionGraph(edges);
    if (graph.valid && graph.complete) results.push(Object.freeze({ choices, edges, graph }));
  };
  visit(0, []);
  return results;
}

function sameSelectionGeometry(
  first: ValidSelection,
  second: ValidSelection,
  overlaps: readonly IntersectionOverlap[],
): boolean {
  return overlaps.every((overlap, index) => {
    const left = first.choices[index];
    const right = second.choices[index];
    if (left === null || right === null) return left === right;
    return overlap.direction === "same";
  });
}

export function planLoopPairTransitions(
  interpretation: LoopPairClassification,
  characterization: LoopPairEventCharacterizationReport,
  operation: BinaryLoopOperation,
  orientations: LoopPairOrientationSigns,
): LoopPairTransitionPlan {
  const issues: LoopPairTransitionPlanIssue[] = [];
  const characterizations = characterizationMap(characterization);
  if (!characterization.complete)
    issues.push(
      issue(
        "incomplete-characterization",
        "event characterization must be complete before planning",
      ),
    );
  for (const event of interpretation.arrangement.events) {
    const value = characterizations.get(event);
    if (value === undefined)
      issues.push(
        issue("missing-characterization", "an arrangement event has no characterization"),
      );
    else if (value.kind === "unresolved")
      issues.push(
        issue("unresolved-event", "an unresolved event cannot supply a Boolean transition"),
      );
  }
  const ordinary = selectedNoncoincidentEdges(
    interpretation,
    characterizations,
    operation,
    orientations,
  );
  const corridorGroups: (readonly CorridorCandidate[])[] = [];
  for (const overlap of interpretation.arrangement.overlaps) {
    const candidates = overlapCandidates(interpretation, overlap, characterizations);
    if (candidates === null) {
      issues.push(
        issue("invalid-overlap", "overlap does not define two usable directed source corridors"),
      );
      continue;
    }
    corridorGroups.push(candidates);
  }

  const fullCoincidence =
    interpretation.arrangement.overlaps.length > 0 &&
    interpretation.classifications.every((value) => value.state === COINCIDENT);
  if (fullCoincidence)
    issues.push(
      issue(
        "unsupported-full-coincidence",
        "an overlap without noncoincident frontier edges belongs to Area-level coincidence policy",
      ),
    );

  let edges: readonly DirectedTransitionEdge[] = Object.freeze(ordinary);
  let graph = analyzeDirectedTransitionGraph(edges);
  if (issues.length === 0) {
    const selections = validSelections(ordinary, corridorGroups);
    if (selections.length === 0)
      issues.push(
        issue(
          "no-valid-corridor-selection",
          "no overlap-corridor selection balances the result graph",
        ),
      );
    else {
      const preferred = selections[0]!;
      if (
        selections.some(
          (selection) =>
            !sameSelectionGeometry(preferred, selection, interpretation.arrangement.overlaps),
        )
      )
        issues.push(
          issue(
            "ambiguous-corridor-selection",
            "multiple geometrically different overlap-corridor selections balance the graph",
          ),
        );
      else {
        edges = preferred.edges;
        graph = preferred.graph;
      }
    }
  }

  return Object.freeze({
    operation,
    orientations: Object.freeze({ ...orientations }),
    edges,
    graph,
    valid: issues.length === 0 && graph.valid,
    complete: issues.length === 0 && graph.complete,
    issues: Object.freeze(issues),
  });
}
