import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  BezierPathBuilder,
  COINCIDENT,
  INNER,
  OUTER,
  classifyLoopPairEdgesDetailed,
  characterizeLoopPairEvents,
  createToleranceContext,
  intersectPathsDetailed,
  loopPairClassificationScope,
  point,
  type BezierPath,
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

describe("incidence-edge loop-side classification", () => {
  it("classifies every edge of two ordinarily overlapping loops", () => {
    const first = squareAt(0, 0);
    const second = squareAt(0.5, 0.5);
    const intersection = intersectPathsDetailed(first, second, tolerance);
    assert.equal(intersection.complete, true);
    const report = classifyLoopPairEdgesDetailed(
      intersection.arrangement!,
      loopPairClassificationScope("test", first, second),
      tolerance,
      { requiredUsableSamples: 2 },
    );

    assert.equal(report.complete, true);
    assert.equal(report.edges.length, 4);
    assert.equal(
      report.edges.every((edge) => edge.samples.length === 2),
      true,
    );
    assert.deepEqual(new Set(report.edges.map((edge) => edge.state)), new Set([INNER, OUTER]));
    const events = characterizeLoopPairEvents(report.interpretation, tolerance);
    assert.equal(events.complete, true);
    assert.equal(
      events.events.every((event) => event.kind === "transverse"),
      true,
    );
    assert.equal(
      events.events.every((event) => event.balanceValid === true),
      true,
    );
  });

  it("assigns exact coincident state to a completely shared boundary without sampling", () => {
    const first = squareAt(0, 0);
    const second = squareAt(0, 0);
    const intersection = intersectPathsDetailed(first, second, tolerance);
    assert.equal(intersection.complete, true);
    const report = classifyLoopPairEdgesDetailed(
      intersection.arrangement!,
      loopPairClassificationScope("coincident", first, second),
      tolerance,
    );
    assert.equal(report.complete, true);
    assert.equal(
      report.edges.every((edge) => edge.state === COINCIDENT),
      true,
    );
    assert.equal(
      report.edges.every((edge) => edge.samples.length === 0),
      true,
    );
    const events = characterizeLoopPairEvents(report.interpretation, tolerance);
    assert.equal(events.complete, true);
    assert.equal(
      events.events.every((event) => event.kind === "overlap-frontier"),
      true,
    );
  });

  it("keeps the interpretation incomplete when no candidate ray is usable", () => {
    const first = squareAt(0, 0);
    const second = squareAt(0.5, 0.5);
    const arrangement = intersectPathsDetailed(first, second, tolerance).arrangement!;
    const report = classifyLoopPairEdgesDetailed(
      arrangement,
      loopPairClassificationScope("unresolved", first, second),
      tolerance,
      { containment: { externalPoints: [point(0.5, 0.5)] } },
    );
    assert.equal(report.complete, false);
    assert.ok(report.edges.some((edge) => edge.status === "no-safe-edge-sample"));
    assert.ok(report.validation.issues.some((issue) => issue.code === "missing-classification"));
  });

  it("characterizes an external tangency without applying transverse balance", () => {
    const first = squareAt(0, 0);
    const second = squareAt(1, 1);
    const arrangement = intersectPathsDetailed(first, second, tolerance).arrangement!;
    const classification = classifyLoopPairEdgesDetailed(
      arrangement,
      loopPairClassificationScope("contact", first, second),
      tolerance,
    );
    assert.equal(classification.complete, true);
    const events = characterizeLoopPairEvents(classification.interpretation, tolerance);
    assert.equal(events.complete, true);
    assert.equal(events.events.length, 1);
    assert.equal(events.events[0]!.kind, "contact");
    assert.equal(events.events[0]!.zeroSum, null);
    assert.equal(events.events[0]!.balanceValid, null);
  });
});
