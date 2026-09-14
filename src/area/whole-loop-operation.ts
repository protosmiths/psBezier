import type { AreaTerm, AreaTermSeed } from "./area.js";
import type { SimpleLoopPairRelationship } from "./loop-pair-relationship.js";

export type SignedAreaBinaryOperation = "add" | "join" | "meet";

export type WholeLoopOperationIssueCode =
  | "requires-switching-walk"
  | "unresolved-relationship"
  | "unsafe-result-multiplicity"
  | "field-jump-direction-mismatch";

export interface WholeLoopOperationIssue {
  readonly code: WholeLoopOperationIssueCode;
  readonly message: string;
}

export interface WholeLoopTermSelection extends AreaTermSeed {
  readonly source: "first" | "second";
  readonly fieldJump: number;
}

export interface WholeLoopOperationReport {
  readonly operation: SignedAreaBinaryOperation;
  readonly relationship: SimpleLoopPairRelationship;
  readonly terms: readonly WholeLoopTermSelection[];
  readonly complete: boolean;
  readonly issues: readonly WholeLoopOperationIssue[];
}

function applyOperation(
  operation: SignedAreaBinaryOperation,
  first: number,
  second: number,
): number {
  switch (operation) {
    case "add":
      return first + second;
    case "join":
      return Math.max(first, second);
    case "meet":
      return Math.min(first, second);
  }
}

function comparePaths(first: AreaTerm, second: AreaTerm): number {
  if (first.path.segmentCount !== second.path.segmentCount)
    return first.path.segmentCount - second.path.segmentCount;
  for (let index = 0; index < first.path.segmentCount; index += 1) {
    const firstSegment = first.path.segments[index]!;
    const secondSegment = second.path.segments[index]!;
    const firstValues = [
      firstSegment.start.x,
      firstSegment.start.y,
      firstSegment.control1.x,
      firstSegment.control1.y,
      firstSegment.control2.x,
      firstSegment.control2.y,
    ];
    const secondValues = [
      secondSegment.start.x,
      secondSegment.start.y,
      secondSegment.control1.x,
      secondSegment.control1.y,
      secondSegment.control2.x,
      secondSegment.control2.y,
    ];
    for (let valueIndex = 0; valueIndex < firstValues.length; valueIndex += 1) {
      const difference = firstValues[valueIndex]! - secondValues[valueIndex]!;
      if (difference !== 0) return difference;
    }
  }
  return 0;
}

function issue(code: WholeLoopOperationIssueCode, message: string): WholeLoopOperationIssue {
  return Object.freeze({ code, message });
}

function selection(
  source: "first" | "second",
  term: AreaTerm,
  fieldJump: number,
  issues: WholeLoopOperationIssue[],
): WholeLoopTermSelection | null {
  if (fieldJump === 0) return null;
  const multiplicity = Math.abs(fieldJump);
  if (!Number.isSafeInteger(multiplicity)) {
    issues.push(
      issue("unsafe-result-multiplicity", "the result field jump is not a positive safe integer"),
    );
    return null;
  }
  if (Math.sign(fieldJump) !== term.orientationSign) {
    issues.push(
      issue(
        "field-jump-direction-mismatch",
        "the result field jump would require reversing a retained source boundary",
      ),
    );
    return null;
  }
  return Object.freeze({ source, path: term.path, multiplicity, fieldJump });
}

/** Resolve a complete full-coincidence or zero-switch pair without constructing a walk graph. */
export function resolveWholeLoopOperation(
  first: AreaTerm,
  second: AreaTerm,
  relationship: SimpleLoopPairRelationship,
  operation: SignedAreaBinaryOperation,
): WholeLoopOperationReport {
  const issues: WholeLoopOperationIssue[] = [];
  if (relationship === "switching-topology") {
    issues.push(
      issue(
        "requires-switching-walk",
        "switching topology must be resolved by the transition walker",
      ),
    );
  } else if (relationship === "unresolved") {
    issues.push(
      issue("unresolved-relationship", "whole-loop geometry was not conclusively classified"),
    );
  }
  if (issues.length > 0)
    return Object.freeze({
      operation,
      relationship,
      terms: Object.freeze([]),
      complete: false,
      issues: Object.freeze(issues),
    });

  const firstValue = first.signedContribution;
  const secondValue = second.signedContribution;
  const result: WholeLoopTermSelection[] = [];

  if (relationship === "full-coincidence") {
    const fieldJump = applyOperation(operation, firstValue, secondValue);
    if (fieldJump !== 0) {
      const candidates = [first, second]
        .filter((term) => term.orientationSign === Math.sign(fieldJump))
        .sort(comparePaths);
      const owner = candidates[0];
      if (owner === undefined) {
        issues.push(
          issue("field-jump-direction-mismatch", "no coincident source has the result orientation"),
        );
      } else {
        const value = selection(owner === first ? "first" : "second", owner, fieldJump, issues);
        if (value !== null) result.push(value);
      }
    }
  } else {
    let firstJump: number;
    let secondJump: number;
    if (relationship === "zero-switch-disjoint") {
      firstJump = applyOperation(operation, firstValue, 0);
      secondJump = applyOperation(operation, 0, secondValue);
    } else if (relationship === "zero-switch-first-inside-second") {
      const middle = applyOperation(operation, 0, secondValue);
      firstJump = applyOperation(operation, firstValue, secondValue) - middle;
      secondJump = middle;
    } else {
      const middle = applyOperation(operation, firstValue, 0);
      firstJump = middle;
      secondJump = applyOperation(operation, firstValue, secondValue) - middle;
    }
    const firstSelection = selection("first", first, firstJump, issues);
    const secondSelection = selection("second", second, secondJump, issues);
    if (firstSelection !== null) result.push(firstSelection);
    if (secondSelection !== null) result.push(secondSelection);
  }

  return Object.freeze({
    operation,
    relationship,
    terms: Object.freeze(result),
    complete: issues.length === 0,
    issues: Object.freeze(issues),
  });
}
