import {
  characterizeLoopPairEvents,
  intersectPathsDetailed,
  loopPairClassificationScope,
  overlapConstrainedIncidences,
  scopedLoopIncidences,
  type IntersectionArrangement,
  type PathIntersectionReport,
} from "../intersection/index.js";
import {
  classifyLoopPairEdgesDetailed,
  pointLoopRelationDetailed,
  type LoopPairEdgeClassificationReport,
  type PointLoopRelationReport,
} from "../containment/index.js";
import type { CubicIntersectionDiscoveryOptions } from "../intersection/index.js";
import type { ToleranceContext } from "../numeric/index.js";
import { evaluatePath, type BezierPath } from "../path/index.js";
import type { LoopPairEventCharacterizationReport } from "../intersection/index.js";

export type SimpleLoopPairRelationship =
  | "full-coincidence"
  | "zero-switch-disjoint"
  | "zero-switch-first-inside-second"
  | "zero-switch-second-inside-first"
  | "switching-topology"
  | "unresolved";

export interface LoopRelationshipSample {
  readonly path: BezierPath;
  readonly relativeTo: BezierPath;
  readonly globalT: number;
  readonly relation: PointLoopRelationReport;
}

export interface SimpleLoopPairRelationshipReport {
  readonly first: BezierPath;
  readonly second: BezierPath;
  readonly relationship: SimpleLoopPairRelationship;
  readonly intersections: PathIntersectionReport;
  readonly classification: LoopPairEdgeClassificationReport | null;
  readonly characterization: LoopPairEventCharacterizationReport | null;
  readonly samples: readonly LoopRelationshipSample[];
  readonly complete: boolean;
}

function fullyCoincident(
  arrangement: IntersectionArrangement,
  first: BezierPath,
  second: BezierPath,
): boolean {
  if (arrangement.overlaps.length === 0) return false;
  const scope = loopPairClassificationScope("simple-loop-relationship", first, second);
  const constrained = new Set(
    arrangement.overlaps.flatMap((overlap) => overlapConstrainedIncidences(overlap, scope) ?? []),
  );
  const required = scopedLoopIncidences(arrangement, scope);
  return required.length > 0 && required.every((incidence) => constrained.has(incidence));
}

function relationSample(
  path: BezierPath,
  relativeTo: BezierPath,
  tolerance: ToleranceContext,
): LoopRelationshipSample | null {
  for (const fraction of [0.5, 0.25, 0.75]) {
    for (const segment of path.segments) {
      const globalT = segment.index + fraction;
      const relation = pointLoopRelationDetailed(
        relativeTo,
        evaluatePath(path, globalT),
        tolerance,
      );
      if (relation.relation === "inside" || relation.relation === "outside")
        return Object.freeze({ path, relativeTo, globalT, relation });
    }
  }
  return null;
}

export function classifySimpleLoopPairRelationship(
  first: BezierPath,
  second: BezierPath,
  tolerance: ToleranceContext,
  options: CubicIntersectionDiscoveryOptions = {},
): SimpleLoopPairRelationshipReport {
  const intersections = intersectPathsDetailed(first, second, tolerance, options);
  if (
    !first.isClosed ||
    !second.isClosed ||
    !intersections.complete ||
    intersections.arrangement === null
  )
    return Object.freeze({
      first,
      second,
      relationship: "unresolved",
      intersections,
      classification: null,
      characterization: null,
      samples: Object.freeze([]),
      complete: false,
    });

  const arrangement = intersections.arrangement;
  const classification = classifyLoopPairEdgesDetailed(
    arrangement,
    loopPairClassificationScope("simple-loop-relationship", first, second),
    tolerance,
  );
  const characterization = characterizeLoopPairEvents(classification.interpretation, tolerance);
  if (fullyCoincident(arrangement, first, second))
    return Object.freeze({
      first,
      second,
      relationship: "full-coincidence",
      intersections,
      classification,
      characterization,
      samples: Object.freeze([]),
      complete: classification.complete,
    });
  if (!classification.complete || !characterization.complete)
    return Object.freeze({
      first,
      second,
      relationship: "unresolved",
      intersections,
      classification,
      characterization,
      samples: Object.freeze([]),
      complete: false,
    });
  if (characterization.events.some((event) => event.kind !== "contact"))
    return Object.freeze({
      first,
      second,
      relationship: "switching-topology",
      intersections,
      classification,
      characterization,
      samples: Object.freeze([]),
      complete: true,
    });

  const firstSample = relationSample(first, second, tolerance);
  const secondSample = relationSample(second, first, tolerance);
  const samples: readonly LoopRelationshipSample[] = Object.freeze(
    [firstSample, secondSample].filter((value): value is LoopRelationshipSample => value !== null),
  );
  if (firstSample === null || secondSample === null)
    return Object.freeze({
      first,
      second,
      relationship: "unresolved",
      intersections,
      classification,
      characterization,
      samples,
      complete: false,
    });
  const firstRelation = firstSample.relation.relation;
  const secondRelation = secondSample.relation.relation;
  const relationship: SimpleLoopPairRelationship =
    firstRelation === "outside" && secondRelation === "outside"
      ? "zero-switch-disjoint"
      : firstRelation === "inside" && secondRelation === "outside"
        ? "zero-switch-first-inside-second"
        : firstRelation === "outside" && secondRelation === "inside"
          ? "zero-switch-second-inside-first"
          : "unresolved";
  return Object.freeze({
    first,
    second,
    relationship,
    intersections,
    classification,
    characterization,
    samples,
    complete: relationship !== "unresolved",
  });
}
