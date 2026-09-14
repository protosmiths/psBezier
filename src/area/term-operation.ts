import {
  materializeLoopPairTransitionPlan,
  planLoopPairTransitions,
  type BinaryLoopOperation,
  type LoopPairTransitionPlan,
  type TransitionMaterializationReport,
} from "../boolean/index.js";
import type { CubicIntersectionDiscoveryOptions } from "../intersection/index.js";
import type { ToleranceContext } from "../numeric/index.js";
import { reverseBezierPath, type BezierPath } from "../path/index.js";
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
import {
  resolveWholeLoopOperation,
  type SignedAreaBinaryOperation,
} from "./whole-loop-operation.js";

export type AreaTermOperationIssueCode =
  | "whole-loop-resolution-failed"
  | "unresolved-level-relationship"
  | "incomplete-level-plan"
  | "incomplete-level-materialization"
  | "invalid-result-area";

export interface AreaTermOperationIssue {
  readonly code: AreaTermOperationIssueCode;
  readonly level: number | null;
  readonly sign: 1 | -1 | null;
  readonly message: string;
}

export interface AreaLevelOperationReport {
  readonly level: number;
  readonly sign: 1 | -1;
  readonly operation: BinaryLoopOperation;
  readonly firstActive: boolean;
  readonly secondActive: boolean;
  readonly relationship: SimpleLoopPairRelationshipReport | null;
  readonly plan: LoopPairTransitionPlan | null;
  readonly materialization: TransitionMaterializationReport | null;
  readonly paths: readonly BezierPath[];
  readonly complete: boolean;
}

export interface AreaTermOperationReport {
  readonly operation: SignedAreaBinaryOperation;
  readonly first: AreaTerm;
  readonly second: AreaTerm;
  readonly levels: readonly AreaLevelOperationReport[];
  readonly seeds: readonly AreaTermSeed[];
  readonly construction: AreaConstructionReport | null;
  readonly area: Area | null;
  readonly complete: boolean;
  readonly issues: readonly AreaTermOperationIssue[];
}

function issue(
  code: AreaTermOperationIssueCode,
  level: number | null,
  sign: 1 | -1 | null,
  message: string,
): AreaTermOperationIssue {
  return Object.freeze({ code, level, sign, message });
}

function wholePositivePaths(
  first: BezierPath,
  second: BezierPath,
  relationship: SimpleLoopPairRelationshipReport["relationship"],
  operation: BinaryLoopOperation,
): readonly BezierPath[] {
  if (relationship === "full-coincidence") return Object.freeze([first]);
  if (relationship === "zero-switch-disjoint")
    return operation === "union" ? Object.freeze([first, second]) : Object.freeze([]);
  if (relationship === "zero-switch-first-inside-second")
    return Object.freeze([operation === "union" ? second : first]);
  if (relationship === "zero-switch-second-inside-first")
    return Object.freeze([operation === "union" ? first : second]);
  return Object.freeze([]);
}

function operatePositiveLoops(
  first: BezierPath,
  second: BezierPath,
  operation: BinaryLoopOperation,
  tolerance: ToleranceContext,
  options: CubicIntersectionDiscoveryOptions,
): AreaLevelOperationReport {
  const relationship = classifySimpleLoopPairRelationship(first, second, tolerance, options);
  if (!relationship.complete || relationship.relationship === "unresolved")
    return Object.freeze({
      level: 0,
      sign: 1,
      operation,
      firstActive: true,
      secondActive: true,
      relationship,
      plan: null,
      materialization: null,
      paths: Object.freeze([]),
      complete: false,
    });
  if (relationship.relationship !== "switching-topology")
    return Object.freeze({
      level: 0,
      sign: 1,
      operation,
      firstActive: true,
      secondActive: true,
      relationship,
      plan: null,
      materialization: null,
      paths: wholePositivePaths(first, second, relationship.relationship, operation),
      complete: true,
    });

  const plan = planLoopPairTransitions(
    relationship.classification!.interpretation,
    relationship.characterization!,
    operation,
    { first: 1, second: 1 },
  );
  const materialization = materializeLoopPairTransitionPlan(plan, tolerance);
  return Object.freeze({
    level: 0,
    sign: 1,
    operation,
    firstActive: true,
    secondActive: true,
    relationship,
    plan,
    materialization,
    paths: materialization.paths,
    complete: plan.complete && materialization.complete,
  });
}

function levelOperation(operation: "join" | "meet", sign: 1 | -1): BinaryLoopOperation {
  if (sign === 1) return operation === "join" ? "union" : "intersection";
  return operation === "join" ? "intersection" : "union";
}

/** Apply one signed field operation to two valid simple Area terms. */
export function operateAreaTermsDetailed(
  first: AreaTerm,
  second: AreaTerm,
  operation: SignedAreaBinaryOperation,
  tolerance: ToleranceContext,
  options: CubicIntersectionDiscoveryOptions = {},
): AreaTermOperationReport {
  const issues: AreaTermOperationIssue[] = [];
  const levels: AreaLevelOperationReport[] = [];
  const seeds: AreaTermSeed[] = [];

  if (operation === "add") {
    const relationship = classifySimpleLoopPairRelationship(
      first.path,
      second.path,
      tolerance,
      options,
    );
    if (relationship.relationship === "full-coincidence" && relationship.complete) {
      const resolved = resolveWholeLoopOperation(first, second, relationship.relationship, "add");
      if (!resolved.complete)
        issues.push(
          issue(
            "whole-loop-resolution-failed",
            null,
            null,
            "coincident addition could not produce a safe field jump",
          ),
        );
      else
        seeds.push(
          ...resolved.terms.map((value) => ({
            path: value.path,
            multiplicity: value.multiplicity!,
          })),
        );
    } else {
      seeds.push(
        { path: first.path, multiplicity: first.multiplicity },
        { path: second.path, multiplicity: second.multiplicity },
      );
    }
  } else {
    const normalizedFirst =
      first.orientationSign === 1 ? first.path : reverseBezierPath(first.path);
    const normalizedSecond =
      second.orientationSign === 1 ? second.path : reverseBezierPath(second.path);
    const reversedOutputs = new Map<BezierPath, BezierPath>();
    const accumulated = new Map<BezierPath, number>();
    const cache = new Map<string, AreaLevelOperationReport>();

    for (const sign of [1, -1] as const) {
      const firstMagnitude = first.orientationSign === sign ? first.multiplicity : 0;
      const secondMagnitude = second.orientationSign === sign ? second.multiplicity : 0;
      const maximum = Math.max(firstMagnitude, secondMagnitude);
      const ordinaryOperation = levelOperation(operation, sign);
      for (let level = 1; level <= maximum; level += 1) {
        const firstActive = firstMagnitude >= level;
        const secondActive = secondMagnitude >= level;
        let base: AreaLevelOperationReport;
        if (!firstActive || !secondActive) {
          const paths =
            ordinaryOperation === "union"
              ? Object.freeze([firstActive ? normalizedFirst : normalizedSecond] as BezierPath[])
              : Object.freeze([] as BezierPath[]);
          base = Object.freeze({
            level: 0,
            sign: 1,
            operation: ordinaryOperation,
            firstActive,
            secondActive,
            relationship: null,
            plan: null,
            materialization: null,
            paths,
            complete: true,
          });
        } else {
          const key = `${sign}:${ordinaryOperation}`;
          base =
            cache.get(key) ??
            operatePositiveLoops(
              normalizedFirst,
              normalizedSecond,
              ordinaryOperation,
              tolerance,
              options,
            );
          cache.set(key, base);
        }
        const paths =
          sign === 1
            ? base.paths
            : Object.freeze(
                base.paths.map((path) => {
                  const existing = reversedOutputs.get(path);
                  if (existing !== undefined) return existing;
                  const reversed = reverseBezierPath(path);
                  reversedOutputs.set(path, reversed);
                  return reversed;
                }),
              );
        const report = Object.freeze({
          ...base,
          level,
          sign,
          firstActive,
          secondActive,
          paths,
        });
        levels.push(report);
        if (!report.complete) {
          const code =
            report.relationship?.complete === false
              ? "unresolved-level-relationship"
              : report.plan?.complete === false
                ? "incomplete-level-plan"
                : "incomplete-level-materialization";
          issues.push(issue(code, level, sign, "integer field level could not be constructed"));
          continue;
        }
        for (const path of paths) accumulated.set(path, (accumulated.get(path) ?? 0) + 1);
      }
    }
    for (const [path, multiplicity] of accumulated) seeds.push({ path, multiplicity });
  }

  let construction: AreaConstructionReport | null = null;
  let area: Area | null = null;
  if (issues.length === 0) {
    construction = createAreaDetailed(seeds, tolerance, options);
    area = construction.area;
    if (area === null)
      issues.push(
        issue("invalid-result-area", null, null, "result boundaries did not form a valid Area"),
      );
  }
  return Object.freeze({
    operation,
    first,
    second,
    levels: Object.freeze(levels),
    seeds: Object.freeze(seeds),
    construction,
    area,
    complete: issues.length === 0 && area !== null,
    issues: Object.freeze(issues),
  });
}
