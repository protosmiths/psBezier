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
