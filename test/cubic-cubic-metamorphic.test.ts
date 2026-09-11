import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  compose,
  createToleranceContext,
  cubicBezier,
  intersectCubicCubicDetailed,
  point,
  reflectionAcrossY,
  reverseCubic,
  rotation,
  scale,
  transformCubic,
  translation,
  vector,
} from "../src/index.js";
import type { AnalyticIntersection, CubicBezier } from "../src/index.js";

const tolerance = createToleranceContext({
  coordinate: 1e-8,
  discovery: 1e-3,
  intersection: 1e-9,
  parameter: 1e-10,
  relative: 1e-12,
});

const horizontal = cubicBezier(point(-1, 0), point(-1 / 3, 0), point(1 / 3, 0), point(1, 0));
const vertical = cubicBezier(point(0, -1), point(0, -1 / 3), point(0, 1 / 3), point(0, 1));

function parameters(result: AnalyticIntersection): readonly [number, number] {
  return result.kind === "point"
    ? [result.occurrences[0].parameter, result.occurrences[1].parameter]
    : [result.start.occurrences[0].parameter, result.start.occurrences[1].parameter];
}

function requireComplete(first: CubicBezier, second: CubicBezier, context = tolerance) {
  const report = intersectCubicCubicDetailed(first, second, context);
  assert.equal(report.complete, true);
  return report;
}

describe("cubic/cubic reversal and swap invariants", () => {
  it("maps point parameters under input reversal and swapping", () => {
    const base = requireComplete(horizontal, vertical).intersections[0]!;
    const reverseFirst = requireComplete(reverseCubic(horizontal), vertical).intersections[0]!;
    const reverseSecond = requireComplete(horizontal, reverseCubic(vertical)).intersections[0]!;
    const swapped = requireComplete(vertical, horizontal).intersections[0]!;
    const [a, b] = parameters(base);
    const [ra, rb] = parameters(reverseFirst);
    const [sa, sb] = parameters(reverseSecond);
    const [wa, wb] = parameters(swapped);
    assert.ok(
      Math.abs(ra - (1 - a)) <= tolerance.parameter && Math.abs(rb - b) <= tolerance.parameter,
    );
    assert.ok(
      Math.abs(sa - a) <= tolerance.parameter && Math.abs(sb - (1 - b)) <= tolerance.parameter,
    );
    assert.ok(Math.abs(wa - b) <= tolerance.parameter && Math.abs(wb - a) <= tolerance.parameter);
  });

  it("changes overlap direction only when one input is reversed", () => {
    const same = requireComplete(horizontal, horizontal).intersections[0]!;
    const oneReversed = requireComplete(horizontal, reverseCubic(horizontal)).intersections[0]!;
    const bothReversed = requireComplete(reverseCubic(horizontal), reverseCubic(horizontal))
      .intersections[0]!;
    assert.ok(
      same.kind === "overlap" && oneReversed.kind === "overlap" && bothReversed.kind === "overlap",
    );
    assert.equal(same.direction, "same");
    assert.equal(oneReversed.direction, "opposite");
    assert.equal(bothReversed.direction, "same");
  });
});

describe("cubic/cubic affine invariance", () => {
  it("preserves topology under translation, rotation, reflection, and uniform scale", () => {
    const factor = 7;
    const transform = compose(
      translation(vector(11, -4)),
      compose(rotation(0.731), compose(reflectionAcrossY(), scale(factor))),
    );
    const transformedTolerance = createToleranceContext({
      ...tolerance,
      coordinate: tolerance.coordinate * factor,
      discovery: tolerance.discovery * factor,
      intersection: tolerance.intersection * factor,
    });
    const original = requireComplete(horizontal, vertical);
    const transformed = requireComplete(
      transformCubic(transform, horizontal),
      transformCubic(transform, vertical),
      transformedTolerance,
    );
    assert.equal(transformed.intersections.length, original.intersections.length);
    assert.deepEqual(
      transformed.intersections.map((value) => value.kind),
      original.intersections.map((value) => value.kind),
    );
    const [originalA, originalB] = parameters(original.intersections[0]!);
    const [transformedA, transformedB] = parameters(transformed.intersections[0]!);
    assert.ok(Math.abs(originalA - transformedA) <= tolerance.parameter);
    assert.ok(Math.abs(originalB - transformedB) <= tolerance.parameter);
  });
});

describe("cubic/cubic tolerance boundaries", () => {
  it("changes deterministically across the discovery epsilon", () => {
    for (const multiplier of [0.99, 1, 1.01]) {
      const offset = tolerance.discovery * multiplier;
      const nearby = cubicBezier(
        point(-1, offset),
        point(-1 / 3, offset),
        point(1 / 3, offset),
        point(1, offset),
      );
      const report = requireComplete(horizontal, nearby);
      if (multiplier <= 1) {
        assert.equal(report.intersections.length, 1);
        assert.equal(report.intersections[0]!.kind, "overlap");
      } else {
        assert.deepEqual(report.intersections, []);
      }
    }
  });

  it("does not duplicate a crossing near a parameter-domain boundary", () => {
    const nearStart = cubicBezier(
      point(-0.99998, -1),
      point(-0.99998, -1 / 3),
      point(-0.99998, 1 / 3),
      point(-0.99998, 1),
    );
    const report = requireComplete(horizontal, nearStart);
    assert.equal(report.intersections.length, 1);
    const [firstParameter] = parameters(report.intersections[0]!);
    assert.ok(Math.abs(firstParameter - 0.00001) <= 1e-8);
  });
});

describe("cubic/cubic stationary and event-identity cases", () => {
  it("handles a stationary cusp-like contact without incompleteness", () => {
    const cusp = cubicBezier(point(-1, 1), point(1, -1 / 3), point(-1, -1 / 3), point(1, 1));
    const report = requireComplete(horizontal, cusp);
    assert.ok(report.intersections.length >= 1);
    assert.ok(
      report.intersections.some(
        (result) =>
          result.kind === "point" &&
          Math.abs(result.point.x) <= tolerance.intersection &&
          Math.abs(result.point.y) <= tolerance.intersection &&
          result.errorSquared <= tolerance.intersection ** 2,
      ),
    );
  });

  it("preserves distinct events that share a parameter on only one curve", () => {
    // x(t) = (t - 0.3)(t - 0.7),
    // y(t) = (t - 0.5)(t - 0.3)(t - 0.7).
    // The curve meets the horizontal cubic three times. The events at t=0.3
    // and t=0.7 both map to x=0, hence parameter 0.5 on the horizontal.
    const repeatedPosition = cubicBezier(
      point(0.21, -0.105),
      point(0.21 - 1 / 3, -0.105 + 0.71 / 3),
      point(0.21 - 1 / 3, 0.105 - 0.71 / 3),
      point(0.21, 0.105),
    );
    const report = requireComplete(horizontal, repeatedPosition);
    assert.equal(report.intersections.length, 3);
    const spans = report.intersections.map((result) => {
      const pairs =
        result.kind === "point"
          ? [result.occurrences]
          : [result.start.occurrences, result.end.occurrences];
      return {
        first: [
          Math.min(...pairs.map((pair) => pair[0].parameter)),
          Math.max(...pairs.map((pair) => pair[0].parameter)),
        ],
        second: [
          Math.min(...pairs.map((pair) => pair[1].parameter)),
          Math.max(...pairs.map((pair) => pair[1].parameter)),
        ],
      };
    });
    for (const secondParameter of [0.3, 0.7]) {
      assert.ok(
        spans.some(
          (span) =>
            span.first[0]! <= 0.5 &&
            span.first[1]! >= 0.5 &&
            span.second[0]! <= secondParameter &&
            span.second[1]! >= secondParameter,
        ),
      );
    }
  });
});
