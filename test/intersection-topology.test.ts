import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  BezierPathBuilder,
  buildIntersectionArrangement,
  createToleranceContext,
  evaluateCubic,
  incidencesForPath,
  intersectionEventSeed,
  intersectionOverlapSeed,
  materializeIntersectionEdge,
  outgoingIntersectionEdge,
  pathOccurrenceSeed,
  point,
  validateIntersectionArrangement,
} from "../src/index.js";
import type { BezierPath, IntersectionEventSeed, Point } from "../src/index.js";

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

function square(): BezierPath {
  const start = point(0, 0);
  const builder = new BezierPathBuilder(start);
  let current = lineTo(builder, start, point(1, 0));
  current = lineTo(builder, current, point(1, 1));
  current = lineTo(builder, current, point(0, 1));
  lineTo(builder, current, start);
  return builder.close().build();
}

function reversedSquare(): BezierPath {
  const start = point(0, 0);
  const builder = new BezierPathBuilder(start);
  let current = lineTo(builder, start, point(0, 1));
  current = lineTo(builder, current, point(1, 1));
  current = lineTo(builder, current, point(1, 0));
  lineTo(builder, current, start);
  return builder.close().build();
}

function openLine(): BezierPath {
  const start = point(0, 0);
  const builder = new BezierPathBuilder(start);
  lineTo(builder, start, point(1, 0));
  return builder.build();
}

function seed(
  firstPath: BezierPath,
  firstGlobalT: number,
  secondPath: BezierPath,
  secondGlobalT: number,
): IntersectionEventSeed {
  return intersectionEventSeed(
    pathOccurrenceSeed(firstPath, firstGlobalT),
    pathOccurrenceSeed(secondPath, secondGlobalT),
  );
}

describe("intersection incidence arrangement", () => {
  it("orders ordinary binary incidences independently on each closed path", () => {
    const first = square();
    const second = square();
    const later = seed(first, 2.5, second, 2.5);
    const earlier = seed(first, 0.5, second, 0.5);
    const arrangement = buildIntersectionArrangement([later, earlier]);

    for (const path of [first, second]) {
      const incidences = incidencesForPath(arrangement, path);
      assert.deepEqual(
        incidences.map((incidence) => incidence.globalT),
        [0.5, 2.5],
      );
      assert.equal(incidences[0]!.next, incidences[1]);
      assert.equal(incidences[1]!.next, incidences[0]);
      assert.equal(incidences[0]!.previous, incidences[1]);
    }
    assert.equal(validateIntersectionArrangement(arrangement, tolerance).valid, true);
    assert.ok(Object.isFrozen(arrangement.events[0]));
    assert.ok(Object.isFrozen(arrangement.incidences[0]));
  });

  it("keeps open-path incidence topology linear", () => {
    const first = openLine();
    const second = openLine();
    const arrangement = buildIntersectionArrangement([
      seed(first, 0.25, second, 0.25),
      seed(first, 0.75, second, 0.75),
    ]);
    const incidences = incidencesForPath(arrangement, first);
    assert.equal(incidences[0]!.previous, null);
    assert.equal(incidences[1]!.next, null);
    assert.equal(outgoingIntersectionEdge(incidences[1]!), null);
  });

  it("represents one closed-path incidence as one complete lazy cycle", () => {
    const first = square();
    const second = square();
    const arrangement = buildIntersectionArrangement([seed(first, 0.5, second, 0.5)]);
    const incidence = incidencesForPath(arrangement, first)[0]!;
    const edge = outgoingIntersectionEdge(incidence)!;
    assert.equal(edge.from, edge.to);
    assert.equal(edge.fullCycle, true);
    const pieces = materializeIntersectionEdge(edge);
    assert.equal(pieces.length, 5);
    assert.deepEqual(evaluateCubic(pieces[0]!, 0), evaluateCubic(pieces.at(-1)!, 1));
  });

  it("supports two distinct incidences of one self-intersecting path", () => {
    const start = point(0, 0);
    const builder = new BezierPathBuilder(start);
    let current = lineTo(builder, start, point(1, 1));
    current = lineTo(builder, current, point(0, 1));
    current = lineTo(builder, current, point(1, 0));
    lineTo(builder, current, start);
    const bowtie = builder.close().build();
    const event = seed(bowtie, 0.5, bowtie, 2.5);
    const arrangement = buildIntersectionArrangement([event]);
    assert.equal(arrangement.events[0]!.incidences[0].path, bowtie);
    assert.equal(arrangement.events[0]!.incidences[1].path, bowtie);
    assert.deepEqual(
      incidencesForPath(arrangement, bowtie).map((incidence) => incidence.globalT),
      [0.5, 2.5],
    );
    assert.equal(validateIntersectionArrangement(arrangement, tolerance).valid, true);
  });

  it("materializes an edge naturally across the closed seam", () => {
    const first = square();
    const second = square();
    const arrangement = buildIntersectionArrangement([
      seed(first, 3.5, second, 3.5),
      seed(first, 0.5, second, 0.5),
    ]);
    const from = incidencesForPath(arrangement, first)[1]!;
    const edge = outgoingIntersectionEdge(from)!;
    assert.equal(edge.toGlobalT, 0.5);
    assert.equal(materializeIntersectionEdge(edge).length, 2);
  });
});

describe("overlap and unresolved vertex topology", () => {
  it("retains same- and opposite-direction overlap relationships", () => {
    const first = square();
    const second = square();
    const reversed = reversedSquare();
    const sameStart = seed(first, 0.25, second, 0.25);
    const sameEnd = seed(first, 0.75, second, 0.75);
    const oppositeStart = seed(first, 1.25, reversed, 2.75);
    const oppositeEnd = seed(first, 1.75, reversed, 2.25);
    const arrangement = buildIntersectionArrangement(
      [sameStart, sameEnd, oppositeStart, oppositeEnd],
      [
        intersectionOverlapSeed(sameStart, sameEnd, "same"),
        intersectionOverlapSeed(oppositeStart, oppositeEnd, "opposite"),
      ],
    );
    assert.deepEqual(
      arrangement.overlaps.map((overlap) => overlap.direction),
      ["same", "opposite"],
    );
    assert.equal(validateIntersectionArrangement(arrangement, tolerance).valid, true);
  });

  it("retains binary event identity at one point and diagnoses a tied path occurrence", () => {
    const first = square();
    const second = square();
    const third = square();
    const arrangement = buildIntersectionArrangement([
      seed(first, 0.5, second, 0.5),
      seed(first, 0.5, third, 0.5),
    ]);
    assert.equal(arrangement.events.length, 2);
    assert.notEqual(arrangement.events[0], arrangement.events[1]);
    assert.deepEqual(arrangement.events[0]!.point, arrangement.events[1]!.point);
    const validation = validateIntersectionArrangement(arrangement, tolerance);
    assert.equal(validation.valid, true);
    assert.ok(validation.issues.some((value) => value.code === "tied-path-occurrences"));
  });

  it("reports a same-path event that repeats one occurrence as invalid", () => {
    const path = square();
    const arrangement = buildIntersectionArrangement([seed(path, 0.5, path, 0.5)]);
    const validation = validateIntersectionArrangement(arrangement, tolerance);
    assert.equal(validation.valid, false);
    assert.ok(validation.issues.some((value) => value.code === "same-path-same-occurrence"));
  });
});
