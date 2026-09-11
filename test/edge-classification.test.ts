import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  BezierPathBuilder,
  COINCIDENT,
  OUTER,
  buildIntersectionArrangement,
  buildLoopPairClassification,
  createToleranceContext,
  effectiveWalkState,
  incomingEdgeClassification,
  intersectionEventSeed,
  intersectionOverlapSeed,
  loopPairClassificationScope,
  pathOccurrenceSeed,
  point,
  validateLoopPairClassification,
} from "../src/index.js";
import type {
  BezierPath,
  IntersectionEventSeed,
  OutgoingEdgeClassificationSeed,
} from "../src/index.js";

const tolerance = createToleranceContext({
  coordinate: 1e-8,
  discovery: 1e-5,
  intersection: 1e-9,
  parameter: 1e-10,
  relative: 1e-12,
});

function loop(y: number): BezierPath {
  return new BezierPathBuilder(point(0, y))
    .appendCubic(point(1 / 3, y), point(2 / 3, y), point(1, y))
    .appendCubic(point(1, y + 1 / 3), point(1, y + 2 / 3), point(1, y + 1))
    .appendCubic(point(2 / 3, y + 1), point(1 / 3, y + 1), point(0, y + 1))
    .appendCubic(point(0, y + 2 / 3), point(0, y + 1 / 3), point(0, y))
    .close()
    .build();
}

function event(first: BezierPath, firstT: number, second: BezierPath, secondT: number) {
  return intersectionEventSeed(
    pathOccurrenceSeed(first, firstT),
    pathOccurrenceSeed(second, secondT),
  );
}

describe("consumer-scoped edge classification", () => {
  it("stores immutable outgoing state and derives incoming state without mutating topology", () => {
    const first = loop(0);
    const second = loop(2);
    const seeds = [event(first, 0.5, second, 0.5), event(first, 2.5, second, 2.5)];
    const arrangement = buildIntersectionArrangement(seeds);
    const interpretation = buildLoopPairClassification(
      arrangement,
      loopPairClassificationScope("test", first, second),
      arrangement.incidences.map((incidence) => ({ incidence, state: OUTER })),
    );

    assert.equal(Object.isFrozen(interpretation), true);
    assert.equal(
      incomingEdgeClassification(interpretation, arrangement.events[1]!.incidences[0])?.state,
      OUTER,
    );
    assert.equal(effectiveWalkState(OUTER, -1), -1);
    assert.deepEqual(validateLoopPairClassification(interpretation, tolerance), {
      valid: true,
      complete: true,
      issues: [],
    });
  });

  it("does not reject a legitimate nonzero tangent/contact state pattern", () => {
    const first = loop(0);
    const second = loop(2);
    const arrangement = buildIntersectionArrangement([event(first, 0.5, second, 0.5)]);
    const interpretation = buildLoopPairClassification(
      arrangement,
      loopPairClassificationScope("tangent", first, second),
      arrangement.incidences.map((incidence) => ({ incidence, state: OUTER })),
    );
    const validation = validateLoopPairClassification(interpretation, tolerance);
    assert.equal(validation.valid, true);
    assert.equal(validation.complete, true);
  });

  it("constrains every incidence-split edge inside a same-direction overlap", () => {
    const first = loop(0);
    const second = loop(2);
    const seeds: IntersectionEventSeed[] = [
      event(first, 0.25, second, 0.25),
      event(first, 0.5, second, 0.5),
      event(first, 0.75, second, 0.75),
    ];
    const arrangement = buildIntersectionArrangement(seeds, [
      intersectionOverlapSeed(seeds[0]!, seeds[2]!, "same"),
    ]);
    const classifications = arrangement.incidences.map(
      (incidence): OutgoingEdgeClassificationSeed => ({
        incidence,
        state: incidence.globalT === 0.5 ? OUTER : COINCIDENT,
      }),
    );
    const interpretation = buildLoopPairClassification(
      arrangement,
      loopPairClassificationScope("overlap", first, second),
      classifications,
    );

    const validation = validateLoopPairClassification(interpretation, tolerance);
    assert.equal(validation.valid, false);
    assert.equal(validation.issues.filter((value) => value.code === "overlap-conflict").length, 2);
  });

  it("maps an opposite overlap onto the second loop's forward edge from end to start", () => {
    const first = loop(0);
    const second = loop(2);
    const start = event(first, 0.25, second, 0.75);
    const end = event(first, 0.75, second, 0.25);
    const arrangement = buildIntersectionArrangement(
      [start, end],
      [intersectionOverlapSeed(start, end, "opposite")],
    );
    const interpretation = buildLoopPairClassification(
      arrangement,
      loopPairClassificationScope("opposite", first, second),
      arrangement.incidences.map((incidence) => ({
        incidence,
        state:
          (incidence.path === first && incidence.globalT === 0.25) ||
          (incidence.path === second && incidence.globalT === 0.25)
            ? COINCIDENT
            : OUTER,
      })),
    );
    assert.equal(validateLoopPairClassification(interpretation, tolerance).valid, true);
  });

  it("requires an edge introduced by a third-loop event in the scoped-loop classification", () => {
    const first = loop(0);
    const second = loop(2);
    const third = loop(4);
    const firstSecondStart = event(first, 0.25, second, 0.25);
    const firstThird = event(first, 0.5, third, 0.5);
    const firstSecondEnd = event(first, 0.75, second, 0.75);
    const arrangement = buildIntersectionArrangement([
      firstSecondStart,
      firstThird,
      firstSecondEnd,
    ]);
    const scope = loopPairClassificationScope("three-loop", first, second);
    const scopedIncidences = arrangement.incidences.filter(
      (incidence) => incidence.path === first || incidence.path === second,
    );
    const intervening = firstThird.occurrences[0];
    const withoutThirdPartySplit = scopedIncidences
      .filter(
        (incidence) =>
          incidence.path !== intervening.path || incidence.globalT !== intervening.globalT,
      )
      .map((incidence) => ({ incidence, state: OUTER }) as const);

    const incomplete = validateLoopPairClassification(
      buildLoopPairClassification(arrangement, scope, withoutThirdPartySplit),
      tolerance,
    );
    assert.equal(incomplete.valid, true);
    assert.equal(incomplete.complete, false);
    assert.equal(
      incomplete.issues.filter((value) => value.code === "missing-classification").length,
      1,
    );

    const complete = validateLoopPairClassification(
      buildLoopPairClassification(
        arrangement,
        scope,
        scopedIncidences.map((incidence) => ({ incidence, state: OUTER })),
      ),
      tolerance,
    );
    assert.equal(complete.valid, true);
    assert.equal(complete.complete, true);
  });
});
