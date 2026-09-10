import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  createToleranceContext,
  cubicBezier,
  intersectAnalytic,
  intersectLineCubic,
  intersectLineLine,
  lineSegment,
  point,
} from "../src/index.js";
import type { AnalyticIntersection, PointIntersection } from "../src/index.js";

const tolerance = createToleranceContext({
  coordinate: 1e-9,
  discovery: 1e-6,
  intersection: 1e-10,
  parameter: 1e-12,
  relative: 1e-14,
});

function requireSingle(results: readonly AnalyticIntersection[]): AnalyticIntersection {
  assert.equal(results.length, 1);
  const result = results[0];
  if (result === undefined) assert.fail("expected one intersection");
  return result;
}

function requirePoint(result: AnalyticIntersection): PointIntersection {
  if (result.kind !== "point") assert.fail("expected a point intersection");
  return result;
}

function assertNear(actual: number, expected: number, epsilon = 1e-9): void {
  assert.ok(Math.abs(actual - expected) <= epsilon, `${actual} is not near ${expected}`);
}

describe("analytic line-line intersections", () => {
  it("finds a crossing with paired parameters and a canonical point", () => {
    const first = lineSegment(point(0, 0), point(10, 10));
    const second = lineSegment(point(0, 10), point(10, 0));
    const result = requirePoint(requireSingle(intersectLineLine(first, second, tolerance)));

    assertNear(result.occurrences[0].parameter, 0.5);
    assertNear(result.occurrences[1].parameter, 0.5);
    assertNear(result.point.x, 5);
    assertNear(result.point.y, 5);
    assert.ok(result.errorSquared <= tolerance.intersection * tolerance.intersection);
  });

  it("canonicalizes endpoint contact without double representations", () => {
    const result = requirePoint(
      requireSingle(
        intersectLineLine(
          lineSegment(point(0, 0), point(2, 0)),
          lineSegment(point(2, 0), point(2, 3)),
          tolerance,
        ),
      ),
    );
    assert.equal(result.occurrences[0].parameter, 1);
    assert.equal(result.occurrences[1].parameter, 0);
  });

  it("distinguishes parallel, collinear-disjoint, and degenerate cases", () => {
    assert.deepEqual(
      intersectLineLine(
        lineSegment(point(0, 0), point(2, 0)),
        lineSegment(point(0, 1), point(2, 1)),
        tolerance,
      ),
      [],
    );
    assert.deepEqual(
      intersectLineLine(
        lineSegment(point(0, 0), point(2, 0)),
        lineSegment(point(3, 0), point(4, 0)),
        tolerance,
      ),
      [],
    );
    const pointResult = requirePoint(
      requireSingle(
        intersectLineLine(
          lineSegment(point(1, 0), point(1, 0)),
          lineSegment(point(0, 0), point(2, 0)),
          tolerance,
        ),
      ),
    );
    assert.equal(pointResult.occurrences[0].parameter, 0);
    assert.equal(pointResult.occurrences[1].parameter, 0.5);
  });

  it("reports same-direction partial overlap as two paired endpoint events", () => {
    const result = requireSingle(
      intersectLineLine(
        lineSegment(point(0, 0), point(10, 0)),
        lineSegment(point(4, 0), point(12, 0)),
        tolerance,
      ),
    );
    assert.equal(result.kind, "overlap");
    if (result.kind !== "overlap") return;
    assert.equal(result.direction, "same");
    assertNear(result.start.occurrences[0].parameter, 0.4);
    assertNear(result.start.occurrences[1].parameter, 0);
    assertNear(result.end.occurrences[0].parameter, 1);
    assertNear(result.end.occurrences[1].parameter, 0.75);
  });

  it("preserves opposite traversal correspondence for overlap endpoints", () => {
    const result = requireSingle(
      intersectLineLine(
        lineSegment(point(0, 0), point(10, 0)),
        lineSegment(point(8, 0), point(2, 0)),
        tolerance,
      ),
    );
    assert.equal(result.kind, "overlap");
    if (result.kind !== "overlap") return;
    assert.equal(result.direction, "opposite");
    assertNear(result.start.occurrences[0].parameter, 0.2);
    assertNear(result.start.occurrences[1].parameter, 1);
    assertNear(result.end.occurrences[0].parameter, 0.8);
    assertNear(result.end.occurrences[1].parameter, 0);
  });

  it("reports full coincidence in either direction", () => {
    const first = lineSegment(point(0, 0), point(10, 0));
    const same = requireSingle(
      intersectLineLine(first, lineSegment(point(0, 0), point(10, 0)), tolerance),
    );
    const opposite = requireSingle(
      intersectLineLine(first, lineSegment(point(10, 0), point(0, 0)), tolerance),
    );
    assert.equal(same.kind, "overlap");
    assert.equal(opposite.kind, "overlap");
    if (same.kind === "overlap") assert.equal(same.direction, "same");
    if (opposite.kind === "overlap") assert.equal(opposite.direction, "opposite");
  });
});

describe("analytic line-cubic intersections", () => {
  const horizontal = lineSegment(point(0, 0), point(10, 0));

  it("finds three crossings with accurate parameters", () => {
    const curve = cubicBezier(
      point(0, -0.08),
      point(10 / 3, 0.14),
      point(20 / 3, -0.14),
      point(10, 0.08),
    );
    const results = intersectLineCubic(horizontal, curve, tolerance);
    assert.equal(results.length, 3);
    const parameters = results.map((result) => {
      assert.equal(result.kind, "point");
      return result.kind === "point" ? result.occurrences[1].parameter : Number.NaN;
    });
    assertNear(parameters[0] ?? Number.NaN, 0.2, 1e-8);
    assertNear(parameters[1] ?? Number.NaN, 0.5, 1e-8);
    assertNear(parameters[2] ?? Number.NaN, 0.8, 1e-8);
  });

  it("detects a tangent contact at a double root", () => {
    const tangentCurve = cubicBezier(
      point(0, 0.25),
      point(10 / 3, -1 / 12),
      point(20 / 3, -1 / 12),
      point(10, 0.25),
    );
    const result = requirePoint(
      requireSingle(intersectLineCubic(horizontal, tangentCurve, tolerance)),
    );
    assertNear(result.occurrences[1].parameter, 0.5);
    assertNear(result.occurrences[0].parameter, 0.5);
  });

  it("filters intersections on the infinite line but outside the finite segment", () => {
    const shortLine = lineSegment(point(0, 0), point(2, 0));
    const curve = cubicBezier(point(5, -1), point(5, -0.5), point(5, 0.5), point(5, 1));
    assert.deepEqual(intersectLineCubic(shortLine, curve, tolerance), []);
  });

  it("reports collinear same- and opposite-direction cubic overlap", () => {
    const same = cubicBezier(point(2, 0), point(4, 0), point(6, 0), point(8, 0));
    const opposite = cubicBezier(point(8, 0), point(6, 0), point(4, 0), point(2, 0));
    const sameResult = requireSingle(intersectLineCubic(horizontal, same, tolerance));
    const oppositeResult = requireSingle(intersectLineCubic(horizontal, opposite, tolerance));
    assert.equal(sameResult.kind, "overlap");
    assert.equal(oppositeResult.kind, "overlap");
    if (sameResult.kind === "overlap") assert.equal(sameResult.direction, "same");
    if (oppositeResult.kind === "overlap") assert.equal(oppositeResult.direction, "opposite");
  });

  it("splits a collinear backtracking cubic into monotone overlap incidences", () => {
    const backtracking = cubicBezier(point(-2, 0), point(18, 0), point(-8, 0), point(12, 0));
    const results = intersectLineCubic(horizontal, backtracking, tolerance);
    assert.ok(results.length >= 3);
    assert.ok(results.every((result) => result.kind === "overlap"));
    const directions = new Set(
      results.map((result) => (result.kind === "overlap" ? result.direction : "point")),
    );
    assert.equal(directions.has("same"), true);
    assert.equal(directions.has("opposite"), true);
  });

  it("handles a degenerate line as a point query without losing the curve parameter", () => {
    const curve = cubicBezier(point(0, 0), point(10 / 3, 0), point(20 / 3, 0), point(10, 0));
    const result = requirePoint(
      requireSingle(intersectLineCubic(lineSegment(point(4, 0), point(4, 0)), curve, tolerance)),
    );
    assert.equal(result.occurrences[0].parameter, 0);
    assertNear(result.occurrences[1].parameter, 0.4);
  });
});

describe("analytic intersection dispatch", () => {
  it("preserves input order in paired occurrences", () => {
    const line = lineSegment(point(0, 0), point(10, 0));
    const curve = cubicBezier(point(5, -2), point(5, -1), point(5, 1), point(5, 2));
    const lineFirst = intersectAnalytic(line, curve, tolerance);
    const curveFirst = intersectAnalytic(curve, line, tolerance);
    assert.notEqual(lineFirst, null);
    assert.notEqual(curveFirst, null);
    if (lineFirst === null || curveFirst === null) return;
    const firstResult = requirePoint(requireSingle(lineFirst));
    const reversedResult = requirePoint(requireSingle(curveFirst));
    assertNear(firstResult.occurrences[0].parameter, reversedResult.occurrences[1].parameter);
    assertNear(firstResult.occurrences[1].parameter, reversedResult.occurrences[0].parameter);
    assert.deepEqual(firstResult.point, reversedResult.point);
  });

  it("sorts multiple results by the first input after dispatch reversal", () => {
    const line = lineSegment(point(0, 0), point(10, 0));
    const curve = cubicBezier(
      point(10, -0.08),
      point(20 / 3, 0.14),
      point(10 / 3, -0.14),
      point(0, 0.08),
    );
    const results = intersectAnalytic(curve, line, tolerance);
    assert.notEqual(results, null);
    if (results === null) return;
    assert.equal(results.length, 3);
    const curveParameters = results.map((result) =>
      result.kind === "point" ? result.occurrences[0].parameter : Number.NaN,
    );
    assert.ok(
      curveParameters.every(
        (value, index) => index === 0 || value >= (curveParameters[index - 1] ?? value),
      ),
    );
  });

  it("defers cubic-cubic work to the later subdivision milestone", () => {
    const first = cubicBezier(point(0, 0), point(1, 2), point(2, -2), point(3, 0));
    const second = cubicBezier(point(0, 1), point(1, -1), point(2, 3), point(3, 1));
    assert.equal(intersectAnalytic(first, second, tolerance), null);
  });
});
