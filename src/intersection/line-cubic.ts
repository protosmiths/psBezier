import type { CubicBezier } from "../bezier/index.js";
import { evaluateCubic } from "../bezier/index.js";
import type { Point, ToleranceContext, Vector } from "../numeric/index.js";
import { cross, distanceSquared, dot, point, subtractPoints, vector } from "../numeric/index.js";
import type { AnalyticIntersection, LineSegment } from "./intersection-types.js";
import { overlapIntersection, pairedPoint, pointIntersection } from "./intersection-types.js";
import {
  cubicBezierCriticalParameters,
  cubicBezierRoots,
  evaluateBezierScalar,
  scalarBezierIsZero,
} from "./polynomial-roots.js";

function linePoint(line: LineSegment, parameter: number): Point {
  return point(
    line.start.x + (line.end.x - line.start.x) * parameter,
    line.start.y + (line.end.y - line.start.y) * parameter,
  );
}

function lineParameter(line: LineSegment, unitDirection: Vector, length: number, value: Point) {
  return dot(subtractPoints(value, line.start), unitDirection) / length;
}

function clampParameter(value: number): number {
  return Math.min(1, Math.max(0, value));
}

function curvePoints(curve: CubicBezier): readonly [Point, Point, Point, Point] {
  return [curve.start, curve.control1, curve.control2, curve.end];
}

function intersectPointCubic(
  value: Point,
  curve: CubicBezier,
  tolerance: ToleranceContext,
): readonly AnalyticIntersection[] {
  const points = curvePoints(curve);
  const xValues = points.map((candidate) => candidate.x - value.x) as [
    number,
    number,
    number,
    number,
  ];
  const yValues = points.map((candidate) => candidate.y - value.y) as [
    number,
    number,
    number,
    number,
  ];
  const xRange = Math.max(...xValues) - Math.min(...xValues);
  const yRange = Math.max(...yValues) - Math.min(...yValues);

  if (
    scalarBezierIsZero(xValues, tolerance.coordinate) &&
    scalarBezierIsZero(yValues, tolerance.coordinate)
  ) {
    return Object.freeze([
      overlapIntersection(
        pairedPoint(0, value, 0, curve.start),
        pairedPoint(0, value, 1, curve.end),
        "stationary",
      ),
    ]);
  }

  const selected = xRange >= yRange ? xValues : yValues;
  const roots = cubicBezierRoots(selected, tolerance.coordinate, tolerance.parameter);
  const results: AnalyticIntersection[] = [];
  for (const parameter of roots) {
    const curvePoint = evaluateCubic(curve, parameter);
    if (distanceSquared(value, curvePoint) <= tolerance.coordinate * tolerance.coordinate) {
      results.push(pointIntersection(pairedPoint(0, value, parameter, curvePoint)));
    }
  }
  return Object.freeze(results);
}

function collinearOverlaps(
  line: LineSegment,
  lineUnitDirection: Vector,
  lineLength: number,
  curve: CubicBezier,
  tolerance: ToleranceContext,
): readonly AnalyticIntersection[] {
  const projectionValues = curvePoints(curve).map((value) =>
    lineParameter(line, lineUnitDirection, lineLength, value),
  ) as [number, number, number, number];
  const projectionTolerance = Math.max(tolerance.parameter, tolerance.coordinate / lineLength);

  const rootsAtStart = cubicBezierRoots(projectionValues, projectionTolerance, tolerance.parameter);
  const rootsAtEnd = cubicBezierRoots(
    projectionValues.map((value) => value - 1) as [number, number, number, number],
    projectionTolerance,
    tolerance.parameter,
  );
  const boundaries = [
    0,
    ...rootsAtStart,
    ...rootsAtEnd,
    ...cubicBezierCriticalParameters(projectionValues),
    1,
  ]
    .sort((left, right) => left - right)
    .filter(
      (value, index, values) =>
        index === 0 || Math.abs(value - (values[index - 1] ?? value)) > tolerance.parameter,
    );

  const results: AnalyticIntersection[] = [];
  for (let index = 0; index < boundaries.length - 1; index += 1) {
    const curveStartParameter = boundaries[index];
    const curveEndParameter = boundaries[index + 1];
    if (curveStartParameter === undefined || curveEndParameter === undefined) continue;
    if (curveEndParameter - curveStartParameter <= tolerance.parameter) continue;
    const middleParameter = (curveStartParameter + curveEndParameter) / 2;
    const middleProjection = evaluateBezierScalar(projectionValues, middleParameter);
    if (middleProjection < -projectionTolerance || middleProjection > 1 + projectionTolerance)
      continue;

    const startCurvePoint = evaluateCubic(curve, curveStartParameter);
    const endCurvePoint = evaluateCubic(curve, curveEndParameter);
    const startLineParameter = clampParameter(
      lineParameter(line, lineUnitDirection, lineLength, startCurvePoint),
    );
    const endLineParameter = clampParameter(
      lineParameter(line, lineUnitDirection, lineLength, endCurvePoint),
    );
    const startPair = pairedPoint(
      startLineParameter,
      linePoint(line, startLineParameter),
      curveStartParameter,
      startCurvePoint,
    );
    const endPair = pairedPoint(
      endLineParameter,
      linePoint(line, endLineParameter),
      curveEndParameter,
      endCurvePoint,
    );
    const delta = endLineParameter - startLineParameter;
    const direction =
      Math.abs(delta) <= projectionTolerance ? "stationary" : delta > 0 ? "same" : "opposite";
    results.push(
      startLineParameter <= endLineParameter
        ? overlapIntersection(startPair, endPair, direction)
        : overlapIntersection(endPair, startPair, direction),
    );
  }

  return Object.freeze(results);
}

export function intersectLineCubic(
  line: LineSegment,
  curve: CubicBezier,
  tolerance: ToleranceContext,
): readonly AnalyticIntersection[] {
  const direction = subtractPoints(line.end, line.start);
  const lineLength = Math.hypot(direction.x, direction.y);
  if (lineLength <= tolerance.coordinate) return intersectPointCubic(line.start, curve, tolerance);

  const unitDirection = vector(direction.x / lineLength, direction.y / lineLength);
  const signedDistances = curvePoints(curve).map((value) =>
    cross(unitDirection, subtractPoints(value, line.start)),
  ) as [number, number, number, number];

  if (scalarBezierIsZero(signedDistances, tolerance.coordinate)) {
    return collinearOverlaps(line, unitDirection, lineLength, curve, tolerance);
  }

  const curveParameters = cubicBezierRoots(
    signedDistances,
    tolerance.coordinate,
    tolerance.parameter,
  );
  const lineParameterTolerance = Math.max(tolerance.parameter, tolerance.coordinate / lineLength);
  const results: AnalyticIntersection[] = [];

  for (const curveParameter of curveParameters) {
    const curvePoint = evaluateCubic(curve, curveParameter);
    const rawLineParameter = lineParameter(line, unitDirection, lineLength, curvePoint);
    if (
      rawLineParameter < -lineParameterTolerance ||
      rawLineParameter > 1 + lineParameterTolerance
    ) {
      continue;
    }
    const parameter = clampParameter(rawLineParameter);
    results.push(
      pointIntersection(
        pairedPoint(parameter, linePoint(line, parameter), curveParameter, curvePoint),
      ),
    );
  }

  const firstParameter = (result: AnalyticIntersection): number =>
    result.kind === "point"
      ? result.occurrences[0].parameter
      : result.start.occurrences[0].parameter;
  results.sort((left, right) => firstParameter(left) - firstParameter(right));
  return Object.freeze(results);
}
