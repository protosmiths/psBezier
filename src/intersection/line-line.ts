import type { ToleranceContext } from "../numeric/index.js";
import { cross, dot, point, subtractPoints, vector } from "../numeric/index.js";
import type { AnalyticIntersection, LineSegment } from "./intersection-types.js";
import { overlapIntersection, pairedPoint, pointIntersection } from "./intersection-types.js";

function clampParameter(value: number): number {
  return Math.min(1, Math.max(0, value));
}

function pointAt(line: LineSegment, t: number) {
  return point(
    line.start.x + (line.end.x - line.start.x) * t,
    line.start.y + (line.end.y - line.start.y) * t,
  );
}

function parameterOnLine(
  line: LineSegment,
  unitDirection: { readonly x: number; readonly y: number },
  length: number,
  value: { readonly x: number; readonly y: number },
): number {
  return dot(subtractPoints(value, line.start), unitDirection) / length;
}

function pointAgainstLine(
  first: LineSegment,
  second: LineSegment,
  tolerance: ToleranceContext,
): readonly AnalyticIntersection[] {
  const secondDirection = subtractPoints(second.end, second.start);
  const secondLength = Math.hypot(secondDirection.x, secondDirection.y);
  if (secondLength <= tolerance.coordinate) {
    const dx = first.start.x - second.start.x;
    const dy = first.start.y - second.start.y;
    return dx * dx + dy * dy <= tolerance.coordinate * tolerance.coordinate
      ? Object.freeze([pointIntersection(pairedPoint(0, first.start, 0, second.start))])
      : Object.freeze([]);
  }

  const secondUnit = vector(secondDirection.x / secondLength, secondDirection.y / secondLength);
  const rawParameter = parameterOnLine(second, secondUnit, secondLength, first.start);
  const parameterTolerance = Math.max(tolerance.parameter, tolerance.coordinate / secondLength);
  if (rawParameter < -parameterTolerance || rawParameter > 1 + parameterTolerance) {
    return Object.freeze([]);
  }
  const secondParameter = clampParameter(rawParameter);
  const secondPoint = pointAt(second, secondParameter);
  const dx = first.start.x - secondPoint.x;
  const dy = first.start.y - secondPoint.y;
  return dx * dx + dy * dy <= tolerance.coordinate * tolerance.coordinate
    ? Object.freeze([pointIntersection(pairedPoint(0, first.start, secondParameter, secondPoint))])
    : Object.freeze([]);
}

export function intersectLineLine(
  first: LineSegment,
  second: LineSegment,
  tolerance: ToleranceContext,
): readonly AnalyticIntersection[] {
  const firstDirection = subtractPoints(first.end, first.start);
  const secondDirection = subtractPoints(second.end, second.start);
  const firstLength = Math.hypot(firstDirection.x, firstDirection.y);
  const secondLength = Math.hypot(secondDirection.x, secondDirection.y);

  if (firstLength <= tolerance.coordinate) return pointAgainstLine(first, second, tolerance);
  if (secondLength <= tolerance.coordinate) {
    const swapped = pointAgainstLine(second, first, tolerance);
    return Object.freeze(
      swapped.map((result) => {
        if (result.kind !== "point") throw new Error("point-line result must be a point");
        return pointIntersection(
          pairedPoint(
            result.occurrences[1].parameter,
            result.occurrences[1].point,
            result.occurrences[0].parameter,
            result.occurrences[0].point,
          ),
        );
      }),
    );
  }

  const firstUnit = vector(firstDirection.x / firstLength, firstDirection.y / firstLength);
  const secondUnit = vector(secondDirection.x / secondLength, secondDirection.y / secondLength);
  const normalizedDenominator = cross(firstUnit, secondUnit);
  const fromFirstToSecond = subtractPoints(second.start, first.start);

  if (Math.abs(normalizedDenominator) > tolerance.relative) {
    const firstParameter =
      cross(fromFirstToSecond, secondUnit) / normalizedDenominator / firstLength;
    const secondParameter =
      cross(fromFirstToSecond, firstUnit) / normalizedDenominator / secondLength;
    const firstParameterTolerance = Math.max(
      tolerance.parameter,
      tolerance.coordinate / firstLength,
    );
    const secondParameterTolerance = Math.max(
      tolerance.parameter,
      tolerance.coordinate / secondLength,
    );
    if (
      firstParameter < -firstParameterTolerance ||
      firstParameter > 1 + firstParameterTolerance ||
      secondParameter < -secondParameterTolerance ||
      secondParameter > 1 + secondParameterTolerance
    ) {
      return Object.freeze([]);
    }
    const firstClamped = clampParameter(firstParameter);
    const secondClamped = clampParameter(secondParameter);
    return Object.freeze([
      pointIntersection(
        pairedPoint(
          firstClamped,
          pointAt(first, firstClamped),
          secondClamped,
          pointAt(second, secondClamped),
        ),
      ),
    ]);
  }

  if (Math.abs(cross(firstUnit, fromFirstToSecond)) > tolerance.coordinate) {
    return Object.freeze([]);
  }

  const secondStartOnFirst = parameterOnLine(first, firstUnit, firstLength, second.start);
  const secondEndOnFirst = parameterOnLine(first, firstUnit, firstLength, second.end);
  const firstTolerance = Math.max(tolerance.parameter, tolerance.coordinate / firstLength);
  const overlapStart = Math.max(0, Math.min(secondStartOnFirst, secondEndOnFirst));
  const overlapEnd = Math.min(1, Math.max(secondStartOnFirst, secondEndOnFirst));
  if (overlapEnd < overlapStart - firstTolerance) return Object.freeze([]);

  if (overlapEnd - overlapStart <= firstTolerance) {
    const firstParameter = clampParameter((overlapStart + overlapEnd) / 2);
    const firstPoint = pointAt(first, firstParameter);
    const secondParameter = clampParameter(
      parameterOnLine(second, secondUnit, secondLength, firstPoint),
    );
    return Object.freeze([
      pointIntersection(
        pairedPoint(firstParameter, firstPoint, secondParameter, pointAt(second, secondParameter)),
      ),
    ]);
  }

  const startFirstParameter = clampParameter(overlapStart);
  const endFirstParameter = clampParameter(overlapEnd);
  const startFirstPoint = pointAt(first, startFirstParameter);
  const endFirstPoint = pointAt(first, endFirstParameter);
  const startSecondParameter = clampParameter(
    parameterOnLine(second, secondUnit, secondLength, startFirstPoint),
  );
  const endSecondParameter = clampParameter(
    parameterOnLine(second, secondUnit, secondLength, endFirstPoint),
  );
  return Object.freeze([
    overlapIntersection(
      pairedPoint(
        startFirstParameter,
        startFirstPoint,
        startSecondParameter,
        pointAt(second, startSecondParameter),
      ),
      pairedPoint(
        endFirstParameter,
        endFirstPoint,
        endSecondParameter,
        pointAt(second, endSecondParameter),
      ),
      dot(firstDirection, secondDirection) >= 0 ? "same" : "opposite",
    ),
  ]);
}
