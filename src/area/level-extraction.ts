import { pointLoopRelationDetailed, type PointLoopRelationReport } from "../containment/index.js";
import type { CubicIntersectionDiscoveryOptions } from "../intersection/index.js";
import type { ToleranceContext } from "../numeric/index.js";
import { evaluatePath, reverseBezierPath, type BezierPath } from "../path/index.js";
import {
  createAreaDetailed,
  type Area,
  type AreaConstructionReport,
  type AreaTerm,
  type AreaTermSeed,
} from "./area.js";
import {
  classifySimpleLoopPairRelationship,
  type SimpleLoopPairRelationshipReport,
} from "./loop-pair-relationship.js";

export type AreaLevelExtractionIssueCode =
  | "unresolved-pair-relationship"
  | "unsupported-switching-topology"
  | "unsupported-coincident-boundary"
  | "no-safe-boundary-sample"
  | "invalid-level-area";

export interface AreaLevelExtractionIssue {
  readonly code: AreaLevelExtractionIssueCode;
  readonly termIndex: number | null;
  readonly otherTermIndex: number | null;
  readonly message: string;
}

export interface CollectiveBoundarySample {
  readonly term: AreaTerm;
  readonly termIndex: number;
  readonly globalT: number;
  readonly relations: readonly PointLoopRelationReport[];
  readonly outsideField: number;
  readonly insideField: number;
}

export interface ExtractedAreaLevel {
  readonly sign: 1 | -1;
  readonly level: number;
  readonly paths: readonly BezierPath[];
}

export interface AreaLevelExtractionReport {
  readonly source: Area;
  readonly pairRelationships: readonly SimpleLoopPairRelationshipReport[];
  readonly boundarySamples: readonly CollectiveBoundarySample[];
  readonly levels: readonly ExtractedAreaLevel[];
  readonly seeds: readonly AreaTermSeed[];
  readonly construction: AreaConstructionReport | null;
  readonly area: Area | null;
  readonly complete: boolean;
  readonly issues: readonly AreaLevelExtractionIssue[];
}

function issue(
  code: AreaLevelExtractionIssueCode,
  termIndex: number | null,
  otherTermIndex: number | null,
  message: string,
): AreaLevelExtractionIssue {
  return Object.freeze({ code, termIndex, otherTermIndex, message });
}

function sampleBoundary(
  terms: readonly AreaTerm[],
  termIndex: number,
  tolerance: ToleranceContext,
): CollectiveBoundarySample | null {
  const term = terms[termIndex]!;
  for (const segment of term.path.segments) {
    for (const fraction of [0.5, 0.25, 0.75]) {
      const globalT = segment.index + fraction;
      const query = evaluatePath(term.path, globalT);
      const relations: PointLoopRelationReport[] = [];
      let outsideField = 0;
      let usable = true;
      for (let otherIndex = 0; otherIndex < terms.length; otherIndex += 1) {
        if (otherIndex === termIndex) continue;
        const other = terms[otherIndex]!;
        const relation = pointLoopRelationDetailed(other.path, query, tolerance);
        relations.push(relation);
        if (relation.relation === "inside") outsideField += other.signedContribution;
        else if (relation.relation !== "outside") {
          usable = false;
          break;
        }
      }
      if (usable)
        return Object.freeze({
          term,
          termIndex,
          globalT,
          relations: Object.freeze(relations),
          outsideField,
          insideField: outsideField + term.signedContribution,
        });
    }
  }
  return null;
}

/**
 * Extract collective integer levels when all Area boundaries have zero-switch relationships.
 * Intersecting and coincident atomic edge classes deliberately remain a later arrangement slice.
 */
export function extractZeroSwitchAreaLevelsDetailed(
  source: Area,
  tolerance: ToleranceContext,
  options: CubicIntersectionDiscoveryOptions = {},
): AreaLevelExtractionReport {
  const issues: AreaLevelExtractionIssue[] = [];
  const pairRelationships: SimpleLoopPairRelationshipReport[] = [];
  for (let firstIndex = 0; firstIndex < source.terms.length; firstIndex += 1) {
    for (let secondIndex = firstIndex + 1; secondIndex < source.terms.length; secondIndex += 1) {
      const relationship = classifySimpleLoopPairRelationship(
        source.terms[firstIndex]!.path,
        source.terms[secondIndex]!.path,
        tolerance,
        options,
      );
      pairRelationships.push(relationship);
      if (!relationship.complete || relationship.relationship === "unresolved")
        issues.push(
          issue(
            "unresolved-pair-relationship",
            firstIndex,
            secondIndex,
            "collective level extraction requires a complete pair relationship",
          ),
        );
      else if (relationship.relationship === "switching-topology")
        issues.push(
          issue(
            "unsupported-switching-topology",
            firstIndex,
            secondIndex,
            "the zero-switch extractor does not yet build incidence-split edge classes",
          ),
        );
      else if (relationship.relationship === "full-coincidence")
        issues.push(
          issue(
            "unsupported-coincident-boundary",
            firstIndex,
            secondIndex,
            "coincident terms require proven atomic edge-class ownership",
          ),
        );
    }
  }

  const boundarySamples: CollectiveBoundarySample[] = [];
  if (issues.length === 0) {
    for (let termIndex = 0; termIndex < source.terms.length; termIndex += 1) {
      const sample = sampleBoundary(source.terms, termIndex, tolerance);
      if (sample === null)
        issues.push(
          issue(
            "no-safe-boundary-sample",
            termIndex,
            null,
            "no source-boundary point had conclusive relationships to every other term",
          ),
        );
      else boundarySamples.push(sample);
    }
  }

  const levels: ExtractedAreaLevel[] = [];
  const accumulated = new Map<BezierPath, number>();
  const reversed = new Map<BezierPath, BezierPath>();
  if (issues.length === 0) {
    const maximumPositive = Math.max(
      0,
      ...boundarySamples.flatMap((sample) => [sample.outsideField, sample.insideField]),
    );
    const maximumNegative = Math.max(
      0,
      ...boundarySamples.flatMap((sample) => [-sample.outsideField, -sample.insideField]),
    );
    for (const sign of [1, -1] as const) {
      const maximum = sign === 1 ? maximumPositive : maximumNegative;
      for (let level = 1; level <= maximum; level += 1) {
        const paths: BezierPath[] = [];
        for (const sample of boundarySamples) {
          const outsideSelected =
            sign === 1 ? sample.outsideField >= level : sample.outsideField <= -level;
          const insideSelected =
            sign === 1 ? sample.insideField >= level : sample.insideField <= -level;
          if (outsideSelected === insideSelected) continue;
          const wantsCounterClockwise = insideSelected;
          const sourceIsCounterClockwise = sample.term.orientationSign === 1;
          let path = sample.term.path;
          if (wantsCounterClockwise !== sourceIsCounterClockwise) {
            const existing = reversed.get(path);
            if (existing !== undefined) path = existing;
            else {
              const sourcePath = path;
              path = reverseBezierPath(sourcePath);
              reversed.set(sourcePath, path);
            }
          }
          paths.push(path);
          accumulated.set(path, (accumulated.get(path) ?? 0) + 1);
        }
        levels.push(Object.freeze({ sign, level, paths: Object.freeze(paths) }));
      }
    }
  }

  const seeds = Object.freeze(
    [...accumulated].map(([path, multiplicity]) => Object.freeze({ path, multiplicity })),
  );
  let construction: AreaConstructionReport | null = null;
  let area: Area | null = null;
  if (issues.length === 0) {
    construction = createAreaDetailed(seeds, tolerance, options);
    area = construction.area;
    if (area === null)
      issues.push(
        issue(
          "invalid-level-area",
          null,
          null,
          "extracted collective level boundaries did not construct a valid Area",
        ),
      );
  }
  return Object.freeze({
    source,
    pairRelationships: Object.freeze(pairRelationships),
    boundarySamples: Object.freeze(boundarySamples),
    levels: Object.freeze(levels),
    seeds,
    construction,
    area,
    complete: issues.length === 0 && area !== null,
    issues: Object.freeze(issues),
  });
}
