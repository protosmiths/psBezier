function evaluateBezierScalar(
  values: readonly [number, number, number, number],
  t: number,
): number {
  const oneMinusT = 1 - t;
  return (
    oneMinusT * oneMinusT * oneMinusT * values[0] +
    3 * oneMinusT * oneMinusT * t * values[1] +
    3 * oneMinusT * t * t * values[2] +
    t * t * t * values[3]
  );
}

function quadraticRoots(aValue: number, bValue: number, cValue: number): number[] {
  const scale = Math.max(Math.abs(aValue), Math.abs(bValue), Math.abs(cValue));
  if (scale === 0) return [];
  const a = aValue / scale;
  const b = bValue / scale;
  const c = cValue / scale;
  if (Math.abs(a) <= Number.EPSILON * Math.max(1, Math.abs(b), Math.abs(c))) {
    return b === 0 ? [] : [-c / b];
  }
  const discriminant = b * b - 4 * a * c;
  if (discriminant < 0) return [];
  if (discriminant === 0) return [-b / (2 * a)];
  const root = Math.sqrt(discriminant);
  const q = -0.5 * (b + Math.sign(b || 1) * root);
  return [q / a, c / q].sort((left, right) => left - right);
}

function appendRoot(roots: number[], root: number, parameterTolerance: number): void {
  if (root < -parameterTolerance || root > 1 + parameterTolerance || !Number.isFinite(root)) return;
  const clamped = Math.min(1, Math.max(0, root));
  if (!roots.some((existing) => Math.abs(existing - clamped) <= parameterTolerance)) {
    roots.push(clamped);
  }
}

/** Isolate all roots of a scalar cubic Bézier on [0,1], including tangent roots. */
export function cubicBezierRoots(
  values: readonly [number, number, number, number],
  valueTolerance: number,
  parameterTolerance: number,
): readonly number[] {
  const a = -values[0] + 3 * values[1] - 3 * values[2] + values[3];
  const b = 3 * values[0] - 6 * values[1] + 3 * values[2];
  const c = -3 * values[0] + 3 * values[1];
  const critical = quadraticRoots(3 * a, 2 * b, c)
    .filter((value) => value > 0 && value < 1)
    .sort((left, right) => left - right);
  const boundaries = [0, ...critical, 1];
  const roots: number[] = [];

  for (const boundary of boundaries) {
    if (Math.abs(evaluateBezierScalar(values, boundary)) <= valueTolerance) {
      appendRoot(roots, boundary, parameterTolerance);
    }
  }

  for (let index = 0; index < boundaries.length - 1; index += 1) {
    const lowBoundary = boundaries[index];
    const highBoundary = boundaries[index + 1];
    if (lowBoundary === undefined || highBoundary === undefined) continue;
    let low: number = lowBoundary;
    let high: number = highBoundary;
    let lowValue = evaluateBezierScalar(values, low);
    const highValue = evaluateBezierScalar(values, high);
    if (lowValue === 0 || highValue === 0 || Math.sign(lowValue) === Math.sign(highValue)) continue;

    for (let iteration = 0; iteration < 128 && high - low > parameterTolerance; iteration += 1) {
      const middle = (low + high) / 2;
      if (middle === low || middle === high) break;
      const middleValue = evaluateBezierScalar(values, middle);
      if (Math.sign(middleValue) === Math.sign(lowValue)) {
        low = middle;
        lowValue = middleValue;
      } else {
        high = middle;
      }
    }
    appendRoot(roots, (low + high) / 2, parameterTolerance);
  }

  roots.sort((left, right) => left - right);
  return Object.freeze(roots);
}

export function cubicBezierCriticalParameters(
  values: readonly [number, number, number, number],
): readonly number[] {
  const a = -values[0] + 3 * values[1] - 3 * values[2] + values[3];
  const b = 3 * values[0] - 6 * values[1] + 3 * values[2];
  const c = -3 * values[0] + 3 * values[1];
  return Object.freeze(
    quadraticRoots(3 * a, 2 * b, c)
      .filter((value) => value > 0 && value < 1)
      .sort((left, right) => left - right),
  );
}

export { evaluateBezierScalar };

export function scalarBezierIsZero(
  values: readonly [number, number, number, number],
  tolerance: number,
): boolean {
  return values.every((value) => Math.abs(value) <= tolerance);
}
