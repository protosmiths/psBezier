export { intersectAnalytic } from "./dispatch.js";
export type { AnalyticGeometry } from "./dispatch.js";
export {
  lineSegment,
  overlapIntersection,
  pairedPoint,
  pointIntersection,
  swapIntersectionInputs,
} from "./intersection-types.js";
export type {
  AnalyticIntersection,
  IntersectionOccurrence,
  LineSegment,
  OverlapIntersection,
  PairedIntersectionPoint,
  PointIntersection,
} from "./intersection-types.js";
export { intersectLineCubic } from "./line-cubic.js";
export { intersectLineLine } from "./line-line.js";
export { intersectCubicCubic, intersectCubicCubicDetailed } from "./cubic-cubic.js";
export type {
  CubicComponentDiagnostic,
  CubicComponentResolution,
  CubicCubicIntersectionReport,
} from "./cubic-cubic.js";
export { discoverCubicCubicIntersections } from "./cubic-cubic-discovery.js";
export type {
  CubicIntersectionDiscovery,
  CubicIntersectionDiscoveryCell,
  CubicIntersectionDiscoveryOptions,
  DiscoveryTermination,
  ParameterInterval,
} from "./cubic-cubic-discovery.js";
export { analyzeCubicCubicDiscovery } from "./cubic-cubic-components.js";
export type {
  CertifiedDiscoveryCell,
  CubicIntersectionDiscoveryComponent,
  DiscoveryComponentKind,
  DiscoveryCorrespondence,
} from "./cubic-cubic-components.js";
export {
  refineCubicIntersectionPoint,
  refineCubicIntersectionPointWithSubdivision,
  refineCubicOverlapBoundaries,
} from "./cubic-cubic-refinement.js";
export type {
  CubicPointRefinement,
  CubicPointRefinementOptions,
  CubicOverlapRefinement,
  OverlapBoundaryKind,
} from "./cubic-cubic-refinement.js";
export {
  buildIntersectionArrangement,
  eventSeedFromSegmentPoint,
  incidencesForPath,
  intersectionEventSeed,
  intersectionOverlapSeed,
  materializeIntersectionEdge,
  outgoingIntersectionEdge,
  overlapSeedFromSegmentResult,
  pathOccurrenceSeed,
  validateIntersectionArrangement,
} from "./intersection-topology.js";
export type {
  IntersectionArrangement,
  IntersectionEdge,
  IntersectionEvent,
  IntersectionEventSeed,
  IntersectionIncidence,
  IntersectionOverlap,
  IntersectionOverlapSeed,
  IntersectionTopologyIssue,
  IntersectionTopologyIssueCode,
  IntersectionTopologyIssueSeverity,
  IntersectionTopologyValidation,
  PathOccurrenceSeed,
  SegmentOverlapSeedBundle,
} from "./intersection-topology.js";
export { intersectPaths, intersectPathsDetailed } from "./path-intersection.js";
export {
  COINCIDENT,
  INNER,
  OUTER,
  buildLoopPairClassification,
  effectiveWalkState,
  incomingEdgeClassification,
  loopPairClassificationScope,
  outgoingEdgeClassification,
  validateLoopPairClassification,
} from "./edge-classification.js";
export type {
  EdgeClassificationIssue,
  EdgeClassificationIssueCode,
  EdgeClassificationIssueSeverity,
  EdgeClassificationValidation,
  GeometricEdgeState,
  LoopPairClassification,
  LoopPairClassificationScope,
  OrientationSign,
  OutgoingEdgeClassification,
  OutgoingEdgeClassificationSeed,
} from "./edge-classification.js";
export type {
  PathIntersectionReport,
  PathSegmentPairDiagnostic,
  PathSegmentPairExclusion,
} from "./path-intersection.js";
