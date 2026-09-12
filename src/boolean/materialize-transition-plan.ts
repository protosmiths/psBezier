import { distanceSquared, type ToleranceContext } from "../numeric/index.js";
import type { CubicBezier } from "../bezier/index.js";
import { BezierPathBuilder, type BezierPath } from "../path/index.js";
import {
  materializeIntersectionEdge,
  outgoingIntersectionEdge,
  type IntersectionIncidence,
} from "../intersection/index.js";
import type { LoopPairTransitionPlan } from "./loop-pair-transition-planner.js";

export type TransitionMaterializationIssueCode =
  | "incomplete-plan"
  | "empty-cycle"
  | "non-incidence-edge"
  | "missing-source-edge"
  | "discontinuous-join"
  | "discontinuous-closure";

export interface TransitionMaterializationIssue {
  readonly code: TransitionMaterializationIssueCode;
  readonly cycleIndex: number | null;
  readonly edgeIndex: number | null;
  readonly message: string;
}

export interface TransitionMaterializationReport {
  readonly paths: readonly BezierPath[];
  readonly complete: boolean;
  readonly issues: readonly TransitionMaterializationIssue[];
}

function issue(
  code: TransitionMaterializationIssueCode,
  cycleIndex: number | null,
  edgeIndex: number | null,
  message: string,
): TransitionMaterializationIssue {
  return Object.freeze({ code, cycleIndex, edgeIndex, message });
}

function isIncidence(value: object): value is IntersectionIncidence {
  const candidate = value as Partial<IntersectionIncidence>;
  return (
    typeof candidate.globalT === "number" &&
    candidate.path !== undefined &&
    candidate.event !== undefined &&
    candidate.arrangement !== undefined
  );
}

/** Materializes exactly the source intervals selected by a completed transition plan. */
export function materializeLoopPairTransitionPlan(
  plan: LoopPairTransitionPlan,
  tolerance: ToleranceContext,
): TransitionMaterializationReport {
  const issues: TransitionMaterializationIssue[] = [];
  const paths: BezierPath[] = [];
  if (!plan.valid || !plan.complete) {
    issues.push(
      issue(
        "incomplete-plan",
        null,
        null,
        "only a complete valid transition plan can be materialized",
      ),
    );
    return Object.freeze({
      paths: Object.freeze(paths),
      complete: false,
      issues: Object.freeze(issues),
    });
  }

  const thresholdSquared = tolerance.coordinate * tolerance.coordinate;
  for (let cycleIndex = 0; cycleIndex < plan.graph.cycles.length; cycleIndex += 1) {
    const cycle = plan.graph.cycles[cycleIndex]!;
    if (cycle.edges.length === 0) {
      issues.push(
        issue("empty-cycle", cycleIndex, null, "a result cycle contains no directed edges"),
      );
      continue;
    }
    const pieces: CubicBezier[] = [];
    let failed = false;
    for (let edgeIndex = 0; edgeIndex < cycle.edges.length; edgeIndex += 1) {
      const planned = cycle.edges[edgeIndex]!;
      if (!isIncidence(planned.identity)) {
        issues.push(
          issue(
            "non-incidence-edge",
            cycleIndex,
            edgeIndex,
            "a planned result edge is not identified by its owning incidence",
          ),
        );
        failed = true;
        break;
      }
      const source = outgoingIntersectionEdge(planned.identity);
      if (source === null) {
        issues.push(
          issue(
            "missing-source-edge",
            cycleIndex,
            edgeIndex,
            "the owning incidence has no directed source interval",
          ),
        );
        failed = true;
        break;
      }
      const extracted = materializeIntersectionEdge(source);
      if (
        pieces.length > 0 &&
        extracted.length > 0 &&
        distanceSquared(pieces.at(-1)!.end, extracted[0]!.start) > thresholdSquared
      ) {
        issues.push(
          issue(
            "discontinuous-join",
            cycleIndex,
            edgeIndex,
            "consecutive planned source intervals do not meet within coordinate tolerance",
          ),
        );
        failed = true;
        break;
      }
      pieces.push(...extracted);
    }
    if (failed || pieces.length === 0) continue;
    if (distanceSquared(pieces.at(-1)!.end, pieces[0]!.start) > thresholdSquared) {
      issues.push(
        issue(
          "discontinuous-closure",
          cycleIndex,
          cycle.edges.length - 1,
          "the final planned interval does not close within coordinate tolerance",
        ),
      );
      continue;
    }

    const builder = new BezierPathBuilder(pieces[0]!.start);
    for (const piece of pieces) builder.appendCubic(piece.control1, piece.control2, piece.end);
    paths.push(builder.close().build());
  }

  return Object.freeze({
    paths: Object.freeze(paths),
    complete: issues.length === 0 && paths.length === plan.graph.cycles.length,
    issues: Object.freeze(issues),
  });
}
