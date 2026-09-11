import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  BezierPathBuilder,
  buildIntersectionArrangement,
  createToleranceContext,
  evaluateCubic,
  eventSeedFromSegmentPoint,
  incidencesForPath,
  intersectionEventSeed,
  intersectionOverlapSeed,
  intersectPathsDetailed,
  materializeIntersectionEdge,
  outgoingIntersectionEdge,
  pathBezierAsCubic,
  pathOccurrenceSeed,
  point,
  pairedPoint,
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
  it("does not snap an interior occurrence merely because it is geometrically near a knot", () => {
    const firstBuilder = new BezierPathBuilder(point(0, 0));
    firstBuilder.appendCubic(point(1e-10, 0), point(2e-10, 0), point(3e-10, 0));
    const secondBuilder = new BezierPathBuilder(point(0, 0));
    secondBuilder.appendCubic(point(1e-10, 0), point(2e-10, 0), point(3e-10, 0));
    const first = firstBuilder.build();
    const second = secondBuilder.build();
    const localT = 0.35;
    const location = evaluateCubic(pathBezierAsCubic(first.segments[0]!), localT);
    const event = eventSeedFromSegmentPoint(
      first.segments[0]!,
      second.segments[0]!,
      pairedPoint(localT, location, localT, location),
      tolerance,
    );

    assert.equal(event.occurrences[0].globalT, localT);
    assert.equal(event.occurrences[1].globalT, localT);
  });

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

describe("whole-path intersection lifting", () => {
  it("does not substitute analytic line parameters for merely near-canonical cubics", () => {
    const first = new BezierPathBuilder(point(-1, 0))
      .appendCubic(point(-1 / 3, 5e-9), point(1 / 3, -5e-9), point(1, 0))
      .build();
    const second = new BezierPathBuilder(point(0, -1))
      .appendCubic(point(5e-9, -1 / 3), point(-5e-9, 1 / 3), point(0, 1))
      .build();

    const report = intersectPathsDetailed(first, second, tolerance);

    assert.equal(report.complete, true);
    assert.equal(report.arrangement!.events.length, 1);
    assert.notEqual(report.pairs[0]!.cubicReport, null);
  });

  it("deduplicates one knot event discovered by four adjacent segment pairs", () => {
    const firstBuilder = new BezierPathBuilder(point(0, 0));
    lineTo(firstBuilder, point(0, 0), point(1, 0));
    lineTo(firstBuilder, point(1, 0), point(2, 0));
    const secondBuilder = new BezierPathBuilder(point(1, -1));
    lineTo(secondBuilder, point(1, -1), point(1, 0));
    lineTo(secondBuilder, point(1, 0), point(1, 1));

    const report = intersectPathsDetailed(firstBuilder.build(), secondBuilder.build(), tolerance);
    assert.equal(report.complete, true);
    assert.equal(report.arrangement!.events.length, 1);
    for (const incidence of report.arrangement!.events[0]!.incidences) {
      assert.ok(Math.abs(incidence.globalT - 1) <= tolerance.parameter);
    }
  });

  it("deduplicates a closed-seam knot without merging another path occurrence", () => {
    const closed = square();
    const lineBuilder = new BezierPathBuilder(point(0, -1));
    lineTo(lineBuilder, point(0, -1), point(0, 0));
    const report = intersectPathsDetailed(closed, lineBuilder.build(), tolerance);
    assert.equal(report.complete, true);
    assert.equal(report.arrangement!.events.length, 1);
    assert.equal(report.arrangement!.events[0]!.incidences[0].globalT, 0);
    assert.equal(report.arrangement!.events[0]!.incidences[1].globalT, 1);
  });

  it("excludes structural self-neighbors but discovers nonadjacent crossings", () => {
    const start = point(0, 0);
    const builder = new BezierPathBuilder(start);
    let current = lineTo(builder, start, point(1, 1));
    current = lineTo(builder, current, point(0, 1));
    current = lineTo(builder, current, point(1, 0));
    lineTo(builder, current, start);
    const bowtie = builder.close().build();
    const report = intersectPathsDetailed(bowtie, bowtie, tolerance);
    assert.equal(report.complete, true);
    assert.equal(report.arrangement!.events.length, 1);
    assert.deepEqual(
      report.arrangement!.events[0]!.incidences.map((incidence) => incidence.globalT),
      [0.5, 2.5],
    );
    const seamPair = report.pairs.find(
      (pair) => pair.first.index === 0 && pair.second.index === bowtie.segmentCount - 1,
    );
    assert.equal(seamPair?.excluded, "adjacent-segments");
  });

  it("does not publish an arrangement from incomplete segment-pair discovery", () => {
    const first = new BezierPathBuilder(point(0, 0))
      .appendCubic(point(0, 1), point(1, 1), point(1, 0))
      .build();
    const second = new BezierPathBuilder(point(0, 0))
      .appendCubic(point(1, 0), point(0, 1), point(1, 1))
      .build();
    const report = intersectPathsDetailed(first, second, tolerance, { maxCells: 1 });
    assert.equal(report.complete, false);
    assert.equal(report.arrangement, null);
    assert.ok(report.pairs.some((pair) => pair.cubicReport?.discovery.exhausted));
  });

  it("shares knot events between consecutive finite overlap records", () => {
    const firstBuilder = new BezierPathBuilder(point(0, 0));
    lineTo(firstBuilder, point(0, 0), point(2, 0));
    const secondBuilder = new BezierPathBuilder(point(0, 0));
    lineTo(secondBuilder, point(0, 0), point(1, 0));
    lineTo(secondBuilder, point(1, 0), point(2, 0));
    const report = intersectPathsDetailed(firstBuilder.build(), secondBuilder.build(), tolerance);
    assert.equal(report.complete, true);
    assert.equal(report.arrangement!.overlaps.length, 2);
    assert.equal(report.arrangement!.events.length, 3);
    assert.equal(report.arrangement!.overlaps[0]!.end, report.arrangement!.overlaps[1]!.start);
  });
});
