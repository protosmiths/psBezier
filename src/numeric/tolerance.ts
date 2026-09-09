export interface ToleranceContext {
  /** Coordinate-space equality and boundary tolerance. */
  readonly coordinate: number;
  /** Coarser coordinate-space tolerance used to discover possible topology. */
  readonly discovery: number;
  /** Tighter coordinate-space tolerance used to refine intersections. */
  readonly intersection: number;
  /** Dimensionless tolerance for curve parameters. */
  readonly parameter: number;
  /** Dimensionless relative tolerance for conditioning tests. */
  readonly relative: number;
}

function requirePositiveFinite(value: number, name: string): void {
  if (!Number.isFinite(value) || value <= 0) {
    throw new RangeError(`${name} must be finite and greater than zero`);
  }
}

export function createToleranceContext(values: ToleranceContext): ToleranceContext {
  requirePositiveFinite(values.coordinate, "coordinate tolerance");
  requirePositiveFinite(values.discovery, "discovery tolerance");
  requirePositiveFinite(values.intersection, "intersection tolerance");
  requirePositiveFinite(values.parameter, "parameter tolerance");
  requirePositiveFinite(values.relative, "relative tolerance");

  if (values.intersection > values.discovery) {
    throw new RangeError("intersection tolerance must not exceed discovery tolerance");
  }

  return Object.freeze({ ...values });
}

export function squaredTolerance(tolerance: number): number {
  requirePositiveFinite(tolerance, "tolerance");
  return tolerance * tolerance;
}
