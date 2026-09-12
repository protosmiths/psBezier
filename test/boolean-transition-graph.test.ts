import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  BezierPathBuilder,
  analyzeDirectedTransitionGraph,
  characterizeLoopPairEvents,
  classifyLoopPairEdgesDetailed,
  createToleranceContext,
  intersectPathsDetailed,
  loopPairClassificationScope,
  planLoopPairTransitions,
  point,
  type BezierPath,
  type DirectedTransitionCorridor,
  type DirectedTransitionEdge,
  type LoopPairOrientationSigns,
  type Point,
} from "../src/index.js";

const identity = () => Object.freeze({});

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

function plan(
  first: BezierPath,
  second: BezierPath,
  operation: "union" | "intersection",
  orientations: LoopPairOrientationSigns = { first: 1, second: 1 },
) {
  const intersections = intersectPathsDetailed(first, second, tolerance);
  assert.equal(intersections.complete, true);
  assert.notEqual(intersections.arrangement, null);
  const classification = classifyLoopPairEdgesDetailed(
    intersections.arrangement!,
    loopPairClassificationScope("transition-fixture", first, second),
    tolerance,
  );
  assert.equal(classification.complete, true);
  const characterization = characterizeLoopPairEvents(classification.interpretation, tolerance);
  return {
    arrangement: intersections.arrangement!,
    result: planLoopPairTransitions(
      classification.interpretation,
      characterization,
      operation,
      orientations,
    ),
  };
}

function reversePath(path: BezierPath): BezierPath {
  const builder = new BezierPathBuilder(path.first.start);
  for (const segment of [...path.segments].reverse())
    builder.appendCubic(segment.control2, segment.control1, segment.start);
  return builder.close().build();
}

function edge(from: object, to: object, additions = {}): DirectedTransitionEdge {
  return Object.freeze({ identity: identity(), from, to, ...additions });
}

describe("Milestone 8 topology-only transition graph", () => {
  it("selects positive union and negative intersection exits at transverse events", () => {
    const first = squareAt(0, 0);
    const second = squareAt(0.5, 0.5);
    const unionFixture = plan(first, second, "union");
    const intersectionFixture = plan(first, second, "intersection");
    const union = unionFixture.result;
    const intersection = intersectionFixture.result;
    assert.equal(union.valid, true, JSON.stringify(union.issues));
    assert.equal(union.complete, true);
    assert.equal(union.graph.cycles.length, 1);
    assert.equal(intersection.valid, true, JSON.stringify(intersection.issues));
    assert.equal(intersection.complete, true);
    assert.equal(intersection.graph.cycles.length, 1);
    assert.equal(
      union.edges.every((value) =>
        unionFixture.arrangement.incidences.some((incidence) => incidence === value.identity),
      ),
      true,
    );
  });

  it("keeps contact continuations on separate source incidences", () => {
    const first = squareAt(0, 0);
    const second = squareAt(1, 1);
    const union = plan(first, second, "union").result;
    const intersection = plan(first, second, "intersection").result;
    assert.equal(union.valid, true, JSON.stringify(union.issues));
    assert.equal(union.graph.cycles.length, 2);
    assert.equal(intersection.valid, true, JSON.stringify(intersection.issues));
    assert.equal(intersection.edges.length, 0);
  });

  it("discards the opposite-direction shared edge between adjacent solids", () => {
    const first = squareAt(0, 0);
    const second = squareAt(1, 0);
    const union = plan(first, second, "union").result;
    const intersection = plan(first, second, "intersection").result;
    assert.equal(union.valid, true, JSON.stringify(union.issues));
    assert.equal(union.graph.cycles.length, 1);
    assert.equal(intersection.valid, true, JSON.stringify(intersection.issues));
    assert.equal(intersection.edges.length, 0);
  });

  it("retains a whole owned corridor when same-direction overlap connects the boundary", () => {
    const first = squareAt(0, 0, 2);
    const second = squareAt(1, 0, 2);
    for (const operation of ["union", "intersection"] as const) {
      const result = plan(first, second, operation).result;
      assert.equal(result.valid, true, JSON.stringify(result.issues));
      assert.equal(result.graph.cycles.length, 1);
      const corridorEdges = result.edges.filter((edge) => edge.corridor !== undefined);
      assert.ok(corridorEdges.length > 0);
      for (const corridor of new Set(corridorEdges.map((edge) => edge.corridor))) {
        const owned = corridorEdges.filter((edge) => edge.corridor === corridor);
        assert.equal(new Set(owned.map((edge) => edge.owner)).size, 1);
        assert.equal(owned.length, corridor!.tiles.length);
      }
    }
  });

  it("keeps swap-equivalent transition topology", () => {
    const first = squareAt(0, 0);
    const second = squareAt(0.5, 0.5);
    for (const operation of ["union", "intersection"] as const) {
      const direct = plan(first, second, operation).result;
      const swapped = plan(second, first, operation).result;
      assert.equal(direct.valid, true);
      assert.equal(swapped.valid, true);
      assert.equal(swapped.edges.length, direct.edges.length);
      assert.deepEqual(
        swapped.graph.cycles.map((cycle) => cycle.edges.length),
        direct.graph.cycles.map((cycle) => cycle.edges.length),
      );
    }
  });

  it("uses reversed contribution sign for subtraction-style intersection selection", () => {
    const first = squareAt(0, 0);
    const reversedSecond = reversePath(squareAt(0.5, 0.5));
    const result = plan(first, reversedSecond, "intersection", {
      first: 1,
      second: -1,
    }).result;
    assert.equal(result.valid, true);
    assert.equal(result.complete, true);
    assert.equal(result.graph.cycles.length, 1);
  });

  it("enumerates every disconnected result cycle exactly once", () => {
    const [a, b, c, d] = [identity(), identity(), identity(), identity()];
    const report = analyzeDirectedTransitionGraph([edge(a, b), edge(b, a), edge(c, d), edge(d, c)]);
    assert.equal(report.valid, true);
    assert.equal(report.complete, true);
    assert.deepEqual(
      report.cycles.map((cycle) => cycle.edges.length),
      [2, 2],
    );
  });

  it("rejects a corridor that repairs only one frontier", () => {
    const [start, end, balanced] = [identity(), identity(), identity()];
    const report = analyzeDirectedTransitionGraph([
      edge(start, end),
      edge(end, balanced),
      edge(balanced, end),
    ]);
    assert.equal(report.valid, false);
    assert.ok(report.issues.some((value) => value.code === "unbalanced-vertex"));
  });

  it("requires one owner for every tile in a selected overlap corridor", () => {
    const [a, split, b] = [identity(), identity(), identity()];
    const [firstTile, secondTile] = [identity(), identity()];
    const corridor: DirectedTransitionCorridor = Object.freeze({
      identity: identity(),
      tiles: Object.freeze([firstTile, secondTile]),
    });
    const firstOwner = identity();
    const secondOwner = identity();
    const report = analyzeDirectedTransitionGraph([
      edge(a, split, { corridor, corridorTile: firstTile, owner: firstOwner }),
      edge(split, b, { corridor, corridorTile: secondTile, owner: secondOwner }),
      edge(b, a),
    ]);
    assert.equal(report.valid, false);
    assert.ok(report.issues.some((value) => value.code === "mixed-corridor-owner"));
  });

  it("accepts an atomically owned corridor split by an unrelated incidence", () => {
    const [a, split, b] = [identity(), identity(), identity()];
    const [firstTile, secondTile] = [identity(), identity()];
    const corridor: DirectedTransitionCorridor = Object.freeze({
      identity: identity(),
      tiles: Object.freeze([firstTile, secondTile]),
    });
    const owner = identity();
    const report = analyzeDirectedTransitionGraph([
      edge(a, split, { corridor, corridorTile: firstTile, owner }),
      edge(split, b, { corridor, corridorTile: secondTile, owner }),
      edge(b, a),
    ]);
    assert.equal(report.valid, true);
    assert.equal(report.complete, true);
    assert.equal(report.cycles.length, 1);
  });

  it("rejects selecting only part of a tiled corridor", () => {
    const [a, b] = [identity(), identity()];
    const [firstTile, secondTile] = [identity(), identity()];
    const corridor: DirectedTransitionCorridor = Object.freeze({
      identity: identity(),
      tiles: Object.freeze([firstTile, secondTile]),
    });
    const owner = identity();
    const report = analyzeDirectedTransitionGraph([
      edge(a, b, { corridor, corridorTile: firstTile, owner }),
      edge(b, a),
    ]);
    assert.equal(report.valid, false);
    assert.ok(report.issues.some((value) => value.code === "partial-corridor"));
  });

  it("keeps touching contact cycles distinct despite shared geometry", () => {
    const contact = identity();
    const firstChannel = identity();
    const secondChannel = identity();
    const report = analyzeDirectedTransitionGraph([
      edge(contact, firstChannel),
      edge(firstChannel, contact),
      edge(contact, secondChannel),
      edge(secondChannel, contact),
    ]);
    assert.equal(report.valid, false);
    assert.ok(report.issues.some((value) => value.code === "unbalanced-vertex"));

    // Contact path occurrences are distinct transition vertices even at one XY point.
    const firstContactIncidence = identity();
    const secondContactIncidence = identity();
    const corrected = analyzeDirectedTransitionGraph([
      edge(firstContactIncidence, firstChannel),
      edge(firstChannel, firstContactIncidence),
      edge(secondContactIncidence, secondChannel),
      edge(secondChannel, secondContactIncidence),
    ]);
    assert.equal(corrected.valid, true);
    assert.equal(corrected.cycles.length, 2);
  });
});
