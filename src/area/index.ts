export { createArea, createAreaDetailed } from "./area.js";
export { classifySimpleLoopPairRelationship } from "./loop-pair-relationship.js";
export { resolveWholeLoopOperation } from "./whole-loop-operation.js";
export type {
  Area,
  AreaConstructionIssue,
  AreaConstructionIssueCode,
  AreaConstructionReport,
  AreaTerm,
  AreaTermConstructionReport,
  AreaTermSeed,
} from "./area.js";
export type {
  LoopRelationshipSample,
  SimpleLoopPairRelationship,
  SimpleLoopPairRelationshipReport,
} from "./loop-pair-relationship.js";
export type {
  SignedAreaBinaryOperation,
  WholeLoopOperationIssue,
  WholeLoopOperationIssueCode,
  WholeLoopOperationReport,
  WholeLoopTermSelection,
} from "./whole-loop-operation.js";
