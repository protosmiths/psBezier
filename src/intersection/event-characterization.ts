import { cross, type ToleranceContext, type Vector } from "../numeric/index.js";
import { locateGlobalT, pathBezierAsCubic } from "../path/index.js";
import { unitTangent } from "../bezier/index.js";
import {
  COINCIDENT,
  incomingEdgeClassification,
  outgoingEdgeClassification,
  type GeometricEdgeState,
  type LoopPairClassification,
} from "./edge-classification.js";
import type { IntersectionEvent, IntersectionIncidence } from "./intersection-topology.js";

export type LoopPairEventKind = "transverse" | "contact" | "overlap-frontier" | "unresolved";

export interface IncidenceStateTransition {
  readonly incidence: IntersectionIncidence;
  readonly incoming: GeometricEdgeState | null;
  readonly outgoing: GeometricEdgeState | null;
}

export interface LoopPairEventCharacterization {
  readonly event: IntersectionEvent;
  readonly kind: LoopPairEventKind;
  readonly first: IncidenceStateTransition;
  readonly second: IncidenceStateTransition;
  readonly tangentsWellConditioned: boolean;
  readonly zeroSum: number | null;
  readonly balanceValid: boolean | null;
}

export interface LoopPairEventCharacterizationReport {
  readonly events: readonly LoopPairEventCharacterization[];
  readonly complete: boolean;
}

function branchTangents(
  incidence: IntersectionIncidence,
  tolerance: ToleranceContext,
): readonly [Vector | null, Vector | null] {
  const location = locateGlobalT(incidence.path, incidence.globalT);
  const outgoing = unitTangent(pathBezierAsCubic(location.segment), location.localT, tolerance);
  if (location.localT > tolerance.parameter) return Object.freeze([outgoing, outgoing]);
  const previous = location.segment.prev;
  const incoming =
    previous === null ? null : unitTangent(pathBezierAsCubic(previous), 1, tolerance);
  return Object.freeze([incoming, outgoing]);
}

function allBranchesTransverse(
  first: IntersectionIncidence,
  second: IntersectionIncidence,
  tolerance: ToleranceContext,
): boolean {
  const firstTangents = branchTangents(first, tolerance);
  const secondTangents = branchTangents(second, tolerance);
  for (const firstTangent of firstTangents)
    for (const secondTangent of secondTangents) {
      if (firstTangent === null || secondTangent === null) return false;
      const determinant = cross(firstTangent, secondTangent);
      if (determinant * determinant <= tolerance.relative) return false;
    }
  return true;
}

function transition(
  interpretation: LoopPairClassification,
  incidence: IntersectionIncidence,
): IncidenceStateTransition {
  return Object.freeze({
    incidence,
    incoming: incomingEdgeClassification(interpretation, incidence)?.state ?? null,
    outgoing: outgoingEdgeClassification(interpretation, incidence)?.state ?? null,
  });
}

function eventIncidences(
  event: IntersectionEvent,
  interpretation: LoopPairClassification,
): readonly [IntersectionIncidence, IntersectionIncidence] | null {
  const first = event.incidences.find((incidence) => incidence.path === interpretation.scope.first);
  const second = event.incidences.find(
    (incidence) => incidence.path === interpretation.scope.second,
  );
  return first === undefined || second === undefined ? null : Object.freeze([first, second]);
}

export function characterizeLoopPairEvents(
  interpretation: LoopPairClassification,
  tolerance: ToleranceContext,
): LoopPairEventCharacterizationReport {
  const overlapEvents = new Map<IntersectionEvent, boolean>();
  for (const overlap of interpretation.arrangement.overlaps) {
    const paths = new Set(overlap.start.incidences.map((incidence) => incidence.path));
    if (!paths.has(interpretation.scope.first) || !paths.has(interpretation.scope.second)) continue;
    const usable = overlap.direction !== "stationary";
    overlapEvents.set(overlap.start, (overlapEvents.get(overlap.start) ?? true) && usable);
    overlapEvents.set(overlap.end, (overlapEvents.get(overlap.end) ?? true) && usable);
  }

  const results: LoopPairEventCharacterization[] = [];
  for (const event of interpretation.arrangement.events) {
    const incidences = eventIncidences(event, interpretation);
    if (incidences === null) continue;
    const first = transition(interpretation, incidences[0]);
    const second = transition(interpretation, incidences[1]);
    const states = [first.incoming, first.outgoing, second.incoming, second.outgoing];
    const resolved = states.every((state) => state !== null);
    const tangentsWellConditioned = allBranchesTransverse(incidences[0], incidences[1], tolerance);
    const overlapUsable = overlapEvents.get(event);
    const firstChanges = first.incoming !== first.outgoing;
    const secondChanges = second.incoming !== second.outgoing;
    const noncoincident = states.every((state) => state !== COINCIDENT);
    let kind: LoopPairEventKind = "unresolved";
    if (resolved && overlapUsable === true && states.includes(COINCIDENT))
      kind = "overlap-frontier";
    else if (
      resolved &&
      overlapUsable === undefined &&
      noncoincident &&
      firstChanges &&
      secondChanges &&
      tangentsWellConditioned
    )
      kind = "transverse";
    else if (
      resolved &&
      overlapUsable === undefined &&
      noncoincident &&
      !firstChanges &&
      !secondChanges &&
      !tangentsWellConditioned
    )
      kind = "contact";

    const zeroSum =
      kind === "transverse"
        ? states.reduce<number>((sum, state) => sum + (state as GeometricEdgeState), 0)
        : null;
    results.push(
      Object.freeze({
        event,
        kind,
        first,
        second,
        tangentsWellConditioned,
        zeroSum,
        balanceValid: zeroSum === null ? null : zeroSum === 0,
      }),
    );
  }
  return Object.freeze({
    events: Object.freeze(results),
    complete: results.every(
      (result) => result.kind !== "unresolved" && result.balanceValid !== false,
    ),
  });
}
