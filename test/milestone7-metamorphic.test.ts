import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  BezierPathBuilder,
  INNER,
  OUTER,
  buildIntersectionArrangement,
  buildLoopPairClassification,
  characterizeLoopPairEvents,
  classifyLoopPairEdgesDetailed,
  circle,
  compose,
  createToleranceContext,
  evaluatePathIntervalAtFraction,
  intersectPathsDetailed,
  intersectionEventSeed,
  loopPairClassificationScope,
  outgoingIntersectionEdge,
  pathOccurrenceSeed,
  point,
  reflectionAcrossX,
  rotation,
  scale,
  transformPoint,
  translation,
  vector,
  type AffineTransform,
  type BezierPath,
  type GeometricEdgeState,
  type Point,
} from "../src/index.js";

const tolerance = createToleranceContext({
  coordinate: 1e-8,
  discovery: 1e-5,
  intersection: 1e-9,
  parameter: 1e-10,
  relative: 1e-12,
});

function lineTo(builder: BezierPathBuilder, start: Point, end: Point): Point {
  builder.appendCubic(
    point(start.x + (end.x - start.x) / 3, start.y + (end.y - start.y) / 3),
    point(start.x + (2 * (end.x - start.x)) / 3, start.y + (2 * (end.y - start.y)) / 3),
    end,
  );
  return end;
}

function squareAt(x: number, y: number, size = 1): BezierPath {
  const start = point(x, y);
  const builder = new BezierPathBuilder(start);
  let current = lineTo(builder, start, point(x + size, y));
  current = lineTo(builder, current, point(x + size, y + size));
  current = lineTo(builder, current, point(x, y + size));
  lineTo(builder, current, start);
  return builder.close().build();
}

function reversePath(path: BezierPath): BezierPath {
  const builder = new BezierPathBuilder(path.first.start);
  for (const segment of [...path.segments].reverse())
    builder.appendCubic(segment.control2, segment.control1, segment.start);
  return builder.close().build();
}

function transformPath(path: BezierPath, transform: AffineTransform): BezierPath {
  const builder = new BezierPathBuilder(transformPoint(transform, path.first.start));
  for (const segment of path.segments)
    builder.appendCubic(
      transformPoint(transform, segment.control1),
      transformPoint(transform, segment.control2),
      transformPoint(transform, segment.end),
    );
  return builder.close().build();
}

interface StateSample {
  readonly point: Point;
  readonly state: GeometricEdgeState;
}

function classify(first: BezierPath, second: BezierPath, activeTolerance = tolerance) {
  const intersection = intersectPathsDetailed(first, second, activeTolerance);
  assert.equal(intersection.complete, true);
  assert.notEqual(intersection.arrangement, null);
  return classifyLoopPairEdgesDetailed(
    intersection.arrangement!,
    loopPairClassificationScope("audit", first, second),
    activeTolerance,
    { requiredUsableSamples: 2 },
  );
}

function stateSamples(report: ReturnType<typeof classify>): StateSample[] {
  return report.edges.map((value) => {
    assert.notEqual(value.state, null);
    const edge = outgoingIntersectionEdge(value.incidence)!;
    return {
      point: evaluatePathIntervalAtFraction(edge.path, edge.fromGlobalT, edge.toGlobalT, 0.5, {
        fullCycle: edge.fullCycle,
      }),
      state: value.state!,
    };
  });
}

function assertStatesAtTransformedSamples(
  expected: readonly StateSample[],
  actual: readonly StateSample[],
  transform: AffineTransform | null = null,
): void {
  assert.equal(actual.length, expected.length);
  for (const value of expected) {
    const expectedPoint = transform === null ? value.point : transformPoint(transform, value.point);
    const match = actual.find(
      (candidate) =>
        Math.hypot(candidate.point.x - expectedPoint.x, candidate.point.y - expectedPoint.y) <=
        1e-6,
    );
    assert.notEqual(match, undefined);
    assert.equal(match!.state, value.state);
  }
}

describe("Milestone 7 metamorphic classification audit", () => {
  it("preserves raw states under swapping and reversal of either loop", () => {
    const first = squareAt(0, 0);
    const second = squareAt(0.5, 0.5);
    const baseline = classify(first, second);
    assert.equal(baseline.complete, true);
    const expected = stateSamples(baseline);

    assertStatesAtTransformedSamples(expected, stateSamples(classify(second, first)));
    assertStatesAtTransformedSamples(expected, stateSamples(classify(reversePath(first), second)));
    assertStatesAtTransformedSamples(expected, stateSamples(classify(first, reversePath(second))));
  });

  it("preserves classified topology under affine families with scaled tolerances", () => {
    const first = squareAt(0, 0);
    const second = squareAt(0.5, 0.5);
    const expected = stateSamples(classify(first, second));
    const cases: readonly [AffineTransform, number][] = [
      [translation(vector(7, -11)), 1],
      [rotation(0.713), 1],
      [reflectionAcrossX(), 1],
      [compose(translation(vector(3, 4)), scale(25)), 25],
    ];
    for (const [transform, factor] of cases) {
      const scaled = createToleranceContext({
        coordinate: tolerance.coordinate * factor,
        discovery: tolerance.discovery * factor,
        intersection: tolerance.intersection * factor,
        parameter: tolerance.parameter,
        relative: tolerance.relative,
      });
      const actual = classify(
        transformPath(first, transform),
        transformPath(second, transform),
        scaled,
      );
      assert.equal(actual.complete, true);
      assertStatesAtTransformedSamples(expected, stateSamples(actual), transform);
    }
  });

  it("transitions conservatively across an external tangency", () => {
    const first = squareAt(0, 0);
    const contactSecond = squareAt(1, 1);
    const contact = classify(first, contactSecond);
    assert.equal(
      characterizeLoopPairEvents(contact.interpretation, tolerance).events[0]!.kind,
      "contact",
    );

    const crossingSecond = squareAt(1 - 1e-4, 1 - 1e-4);
    const crossing = classify(first, crossingSecond);
    assert.equal(
      characterizeLoopPairEvents(crossing.interpretation, tolerance).events.every(
        (event) => event.kind === "transverse",
      ),
      true,
    );

    const separated = intersectPathsDetailed(first, squareAt(1 + 1e-4, 1 + 1e-4), tolerance);
    assert.equal(separated.complete, true);
    assert.equal(separated.arrangement!.events.length, 0);
  });

  it("resolves short incidence edges with several agreeing samples", () => {
    const report = classify(squareAt(0, 0), squareAt(1e-4, 1e-4));
    assert.equal(report.complete, true);
    assert.equal(
      report.edges.every((edge) => edge.samples.length === 2),
      true,
    );
  });

  it("propagates deliberately incomplete distance evidence into incomplete classification", () => {
    const first = squareAt(-0.1, -0.1, 0.2);
    const second = circle(point(0, 0), 1);
    const firstEvent = intersectionEventSeed(
      pathOccurrenceSeed(first, 0),
      pathOccurrenceSeed(second, 0),
    );
    const secondEvent = intersectionEventSeed(
      pathOccurrenceSeed(first, 2),
      pathOccurrenceSeed(second, 2),
    );
    const arrangement = buildIntersectionArrangement([firstEvent, secondEvent]);
    const report = classifyLoopPairEdgesDetailed(
      arrangement,
      loopPairClassificationScope("limited", first, second),
      tolerance,
      { containment: { distance: { maxDepth: 0 } } },
    );
    assert.equal(report.complete, false);
    assert.ok(report.edges.some((edge) => edge.state === null));
  });

  it("leaves a state-changing corner event unresolved when one branch is tangent", () => {
    const first = squareAt(0, 0);
    const second = squareAt(0, 2);
    const eventAtCorner = intersectionEventSeed(
      pathOccurrenceSeed(first, 1),
      pathOccurrenceSeed(second, 0.5),
    );
    const otherEvent = intersectionEventSeed(
      pathOccurrenceSeed(first, 3),
      pathOccurrenceSeed(second, 2.5),
    );
    const arrangement = buildIntersectionArrangement([eventAtCorner, otherEvent]);
    const scope = loopPairClassificationScope("corner", first, second);
    const interpretation = buildLoopPairClassification(
      arrangement,
      scope,
      arrangement.incidences.map((incidence) => ({
        incidence,
        state:
          (incidence.path === first && incidence.globalT === 1) ||
          (incidence.path === second && incidence.globalT === 2.5)
            ? INNER
            : OUTER,
      })),
    );
    const events = characterizeLoopPairEvents(interpretation, tolerance);
    const corner = events.events.find((value) => value.event === arrangement.events[0]);
    assert.equal(corner!.kind, "unresolved");
    assert.equal(corner!.tangentsWellConditioned, false);
  });
});
