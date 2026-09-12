import type { Point, ToleranceContext } from "../numeric/index.js";
import { evaluatePathIntervalAtFraction, type BezierPath } from "../path/index.js";
import {
  COINCIDENT,
  INNER,
  OUTER,
  buildLoopPairClassification,
  overlapConstrainedIncidences,
  scopedLoopIncidences,
  validateLoopPairClassification,
  type EdgeClassificationValidation,
  type GeometricEdgeState,
  type LoopPairClassification,
  type LoopPairClassificationScope,
  type OutgoingEdgeClassificationSeed,
} from "../intersection/edge-classification.js";
import {
  outgoingIntersectionEdge,
  type IntersectionArrangement,
  type IntersectionIncidence,
} from "../intersection/intersection-topology.js";
import {
  pointLoopRelationDetailed,
  type PointLoopRelationOptions,
  type PointLoopRelationReport,
} from "./point-loop-relation.js";

export interface LoopEdgeClassificationOptions {
  readonly sampleFractions?: readonly number[];
  readonly requiredUsableSamples?: number;
  readonly containment?: PointLoopRelationOptions;
}

export interface LoopEdgeSampleReport {
  readonly fraction: number;
  readonly point: Point;
  readonly containment: PointLoopRelationReport;
}

export type LoopEdgeClassificationStatus =
  | "coincident"
  | "classified"
  | "no-safe-edge-sample"
  | "inconsistent-edge-state";

export interface LoopEdgeClassificationReport {
  readonly incidence: IntersectionIncidence;
  readonly relativeTo: BezierPath;
  readonly status: LoopEdgeClassificationStatus;
  readonly state: GeometricEdgeState | null;
  readonly samples: readonly LoopEdgeSampleReport[];
}

export interface LoopPairEdgeClassificationReport {
  readonly interpretation: LoopPairClassification;
  readonly edges: readonly LoopEdgeClassificationReport[];
  readonly validation: EdgeClassificationValidation;
  readonly complete: boolean;
}

const defaultFractions = Object.freeze([0.5, 0.25, 0.75, 0.125, 0.375, 0.625, 0.875]);

function constrainedSet(
  arrangement: IntersectionArrangement,
  scope: LoopPairClassificationScope,
): { readonly incidences: ReadonlySet<IntersectionIncidence>; readonly stationary: boolean } {
  const incidences = new Set<IntersectionIncidence>();
  let stationary = false;
  for (const overlap of arrangement.overlaps) {
    const paths = new Set(overlap.start.incidences.map((incidence) => incidence.path));
    if (!paths.has(scope.first) || !paths.has(scope.second)) continue;
    const values = overlapConstrainedIncidences(overlap, scope);
    if (values === null) stationary = true;
    else for (const incidence of values) incidences.add(incidence);
  }
  return { incidences, stationary };
}

export function classifyLoopPairEdgesDetailed(
  arrangement: IntersectionArrangement,
  scope: LoopPairClassificationScope,
  tolerance: ToleranceContext,
  options: LoopEdgeClassificationOptions = {},
): LoopPairEdgeClassificationReport {
  const fractions = options.sampleFractions ?? defaultFractions;
  const requiredUsableSamples = options.requiredUsableSamples ?? 1;
  if (!Number.isInteger(requiredUsableSamples) || requiredUsableSamples <= 0)
    throw new RangeError("requiredUsableSamples must be positive");
  if (
    fractions.length === 0 ||
    fractions.some((value) => !Number.isFinite(value) || value <= 0 || value >= 1)
  )
    throw new RangeError("sample fractions must lie strictly inside (0, 1)");

  const constraints = constrainedSet(arrangement, scope);
  const seeds: OutgoingEdgeClassificationSeed[] = [];
  const edges: LoopEdgeClassificationReport[] = [];
  for (const incidence of scopedLoopIncidences(arrangement, scope)) {
    const relativeTo = incidence.path === scope.first ? scope.second : scope.first;
    if (constraints.incidences.has(incidence)) {
      seeds.push({ incidence, state: COINCIDENT });
      edges.push(
        Object.freeze({
          incidence,
          relativeTo,
          status: "coincident",
          state: COINCIDENT,
          samples: Object.freeze([]),
        }),
      );
      continue;
    }
    const edge = outgoingIntersectionEdge(incidence);
    if (edge === null) continue;
    const samples: LoopEdgeSampleReport[] = [];
    const usable: GeometricEdgeState[] = [];
    for (const fraction of fractions) {
      const samplePoint = evaluatePathIntervalAtFraction(
        edge.path,
        edge.fromGlobalT,
        edge.toGlobalT,
        fraction,
        { fullCycle: edge.fullCycle },
      );
      const containment = pointLoopRelationDetailed(
        relativeTo,
        samplePoint,
        tolerance,
        options.containment,
      );
      samples.push(Object.freeze({ fraction, point: samplePoint, containment }));
      if (containment.relation === "inside") usable.push(INNER);
      if (containment.relation === "outside") usable.push(OUTER);
      if (usable.some((state) => state !== usable[0])) break;
      if (usable.length >= requiredUsableSamples) break;
    }
    const inconsistent = usable.some((state) => state !== usable[0]);
    const state = inconsistent || usable.length < requiredUsableSamples ? null : usable[0]!;
    if (state !== null) seeds.push({ incidence, state });
    edges.push(
      Object.freeze({
        incidence,
        relativeTo,
        status: inconsistent
          ? "inconsistent-edge-state"
          : state === null
            ? "no-safe-edge-sample"
            : "classified",
        state,
        samples: Object.freeze(samples),
      }),
    );
  }
  const interpretation = buildLoopPairClassification(arrangement, scope, seeds);
  const validation = validateLoopPairClassification(interpretation, tolerance);
  return Object.freeze({
    interpretation,
    edges: Object.freeze(edges),
    validation,
    complete:
      !constraints.stationary &&
      edges.every((edge) => edge.state !== null) &&
      validation.valid &&
      validation.complete,
  });
}
