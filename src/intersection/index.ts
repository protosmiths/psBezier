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
} from "./cubic-cubic-refinement.js";
export type {
  CubicPointRefinement,
  CubicPointRefinementOptions,
} from "./cubic-cubic-refinement.js";
