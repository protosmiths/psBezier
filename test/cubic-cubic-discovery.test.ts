import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  analyzeCubicCubicDiscovery,
  createToleranceContext,
  cubicBezier,
  discoverCubicCubicIntersections,
  intersectCubicCubicDetailed,
  point,
  refineCubicIntersectionPoint,
  refineCubicIntersectionPointWithSubdivision,
  refineCubicOverlapBoundaries,
  reverseCubic,
} from "../src/index.js";

const tolerance = createToleranceContext({
  coordinate: 1e-8,
  discovery: 1e-3,
  intersection: 1e-9,
  parameter: 1e-10,
  relative: 1e-12,
});

describe("public cubic/cubic orchestration", () => {
  it("retains discovery classification while emitting a refined point", () => {
    const vertical = cubicBezier(point(0, -1), point(0, -1 / 3), point(0, 1 / 3), point(0, 1));
    const report = intersectCubicCubicDetailed(horizontal, vertical, tolerance);
    assert.equal(report.complete, true);
    assert.equal(report.intersections.length, 1);
    assert.equal(report.intersections[0]!.kind, "point");
    assert.equal(report.components[0]!.component.kind, "ambiguous");
    assert.equal(report.components[0]!.resolution, "point");
  });

  it("emits a certified overlap with boundary diagnostics", () => {
    const report = intersectCubicCubicDetailed(horizontal, horizontal, tolerance);
    assert.equal(report.complete, true);
    assert.equal(report.intersections[0]!.kind, "overlap");
    assert.equal(report.components[0]!.startBoundaryKind, "exact");
    assert.equal(report.components[0]!.endBoundaryKind, "exact");
  });

  it("preserves discovery exhaustion in public diagnostics", () => {
    const report = intersectCubicCubicDetailed(horizontal, horizontal, tolerance, { maxCells: 1 });
    assert.equal(report.complete, false);
    assert.equal(report.discovery.exhausted, true);
    assert.deepEqual(report.intersections, []);
  });

  it("keeps three distinct parameter-pair events from one cubic pair", () => {
    const oscillating = cubicBezier(
      point(1, -0.08),
      point(1 / 3, 0.14),
      point(-1 / 3, -0.14),
      point(-1, 0.08),
    );
    const report = intersectCubicCubicDetailed(horizontal, oscillating, tolerance);
    assert.equal(report.complete, true);
    assert.equal(report.intersections.length, 3);
    const pairs = report.intersections.map((result) => {
      return result.kind === "point"
        ? [result.occurrences[0].parameter, result.occurrences[1].parameter]
        : [result.start.occurrences[0].parameter, result.start.occurrences[1].parameter];
    });
    const [firstPair, secondPair, thirdPair] = pairs;
    assert.ok(firstPair !== undefined && secondPair !== undefined && thirdPair !== undefined);
    assert.ok(firstPair[0]! < secondPair[0]! && secondPair[0]! < thirdPair[0]!);
    assert.ok(new Set(pairs.map((pair) => pair.join("/"))).size === 3);
  });

  it("is input-order symmetric and deterministic", () => {
    const vertical = cubicBezier(point(0, -1), point(0, -1 / 3), point(0, 1 / 3), point(0, 1));
    const forward = intersectCubicCubicDetailed(horizontal, vertical, tolerance);
    const repeated = intersectCubicCubicDetailed(horizontal, vertical, tolerance);
    const reversed = intersectCubicCubicDetailed(vertical, horizontal, tolerance);
    assert.deepEqual(repeated, forward);
    assert.equal(reversed.complete, forward.complete);
    const forwardPoint = forward.intersections[0];
    const reversedPoint = reversed.intersections[0];
    assert.ok(forwardPoint?.kind === "point" && reversedPoint?.kind === "point");
    assert.ok(
      Math.abs(forwardPoint.occurrences[0].parameter - reversedPoint.occurrences[1].parameter) <=
        tolerance.parameter,
    );
    assert.ok(
      Math.abs(forwardPoint.occurrences[1].parameter - reversedPoint.occurrences[0].parameter) <=
        tolerance.parameter,
    );
  });
});

describe("cubic/cubic point refinement", () => {
  it("refines a transverse candidate inside its saved parameter rectangle", () => {
    const vertical = cubicBezier(point(0, -1), point(0, -1 / 3), point(0, 1 / 3), point(0, 1));
    const component = analyzeCubicCubicDiscovery(
      discoverCubicCubicIntersections(horizontal, vertical, tolerance),
      tolerance,
    )[0]!;
    const result = refineCubicIntersectionPoint(horizontal, vertical, component, tolerance);
    assert.ok(result !== null);
    assert.ok(Math.abs(result.occurrences[0].parameter - 0.5) <= tolerance.parameter);
    assert.ok(Math.abs(result.occurrences[1].parameter - 0.5) <= tolerance.parameter);
    assert.ok(result.errorSquared <= tolerance.intersection * tolerance.intersection);
  });

  it("does not reinterpret an ill-conditioned failed solve as geometry", () => {
    const parallel = cubicBezier(
      point(-1, 0.0005),
      point(-1 / 3, 0.0005),
      point(1 / 3, 0.0005),
      point(1, 0.0005),
    );
    const component = analyzeCubicCubicDiscovery(
      discoverCubicCubicIntersections(horizontal, parallel, tolerance),
      tolerance,
    )[0]!;
    assert.equal(refineCubicIntersectionPoint(horizontal, parallel, component, tolerance), null);
  });

  it("refines an off-grid tangency without assuming a nonsingular crossing", () => {
    const tangentParameter = 0.523456789;
    const startY = tangentParameter * tangentParameter;
    const endY = (1 - tangentParameter) * (1 - tangentParameter);
    const tangent = cubicBezier(
      point(-1, startY),
      point(-1 / 3, startY - (2 * tangentParameter) / 3),
      point(1 / 3, endY - (2 - 2 * tangentParameter) / 3),
      point(1, endY),
    );
    const component = analyzeCubicCubicDiscovery(
      discoverCubicCubicIntersections(horizontal, tangent, tolerance),
      tolerance,
    )[0]!;
    const tangentTolerance = createToleranceContext({
      ...tolerance,
      coordinate: 1e-14,
      intersection: 1e-14,
    });
    const result = refineCubicIntersectionPointWithSubdivision(
      horizontal,
      tangent,
      component,
      tangentTolerance,
    );
    assert.equal(result.exhausted, false);
    assert.ok(result.intersection !== null);
    assert.ok(
      result.intersection.errorSquared <=
        tangentTolerance.intersection * tangentTolerance.intersection,
    );
  });

  it("can conclusively prune a saved near-parallel component at tighter tolerance", () => {
    const parallel = cubicBezier(
      point(-1, 0.0005),
      point(-1 / 3, 0.0005),
      point(1 / 3, 0.0005),
      point(1, 0.0005),
    );
    const component = analyzeCubicCubicDiscovery(
      discoverCubicCubicIntersections(horizontal, parallel, tolerance),
      tolerance,
    )[0]!;
    const result = refineCubicIntersectionPointWithSubdivision(
      horizontal,
      parallel,
      component,
      tolerance,
    );
    assert.equal(result.intersection, null);
    assert.equal(result.exhausted, false);
    assert.equal(result.usedSubdivision, true);
  });
});

describe("cubic/cubic discovery components", () => {
  it("recognizes and certifies same-direction coincidence", () => {
    const components = analyzeCubicCubicDiscovery(
      discoverCubicCubicIntersections(horizontal, horizontal, tolerance),
      tolerance,
    );
    assert.equal(components.length, 1);
    assert.equal(components[0]!.kind, "overlap");
    assert.equal(components[0]!.correspondence, "same");
    assert.ok(components[0]!.certificates.some((certificate) => certificate.certified));
    assert.ok(components[0]!.certifiedSpine.length > 0);
    assert.ok(components[0]!.certifiedSpine.every((certificate) => certificate.certified));
  });

  it("recognizes and certifies opposite-direction coincidence", () => {
    const components = analyzeCubicCubicDiscovery(
      discoverCubicCubicIntersections(horizontal, reverseCubic(horizontal), tolerance),
      tolerance,
    );
    assert.equal(components.length, 1);
    assert.equal(components[0]!.kind, "overlap");
    assert.equal(components[0]!.correspondence, "opposite");
    assert.ok(components[0]!.certificates.some((certificate) => certificate.certified));
    assert.ok(components[0]!.certifiedSpine.length > 0);
  });

  it("does not promote a transverse crossing to certified overlap", () => {
    const vertical = cubicBezier(point(0, -1), point(0, -1 / 3), point(0, 1 / 3), point(0, 1));
    const components = analyzeCubicCubicDiscovery(
      discoverCubicCubicIntersections(horizontal, vertical, tolerance),
      tolerance,
    );
    assert.ok(components.length > 0);
    assert.ok(components.every((component) => component.kind !== "overlap"));
    assert.ok(components.some((component) => component.kind === "ambiguous"));
  });
});

describe("cubic/cubic overlap boundary refinement", () => {
  it("localizes exact same-direction overlap endpoints", () => {
    const component = analyzeCubicCubicDiscovery(
      discoverCubicCubicIntersections(horizontal, horizontal, tolerance),
      tolerance,
    )[0]!;
    const result = refineCubicOverlapBoundaries(horizontal, horizontal, component, tolerance);
    assert.ok(result.intersection !== null);
    assert.equal(result.intersection.direction, "same");
    assert.deepEqual(
      result.intersection.start.occurrences.map((value) => value.parameter),
      [0, 0],
    );
    assert.deepEqual(
      result.intersection.end.occurrences.map((value) => value.parameter),
      [1, 1],
    );
    assert.equal(result.intersection.start.errorSquared, 0);
    assert.equal(result.intersection.end.errorSquared, 0);
    assert.equal(result.startKind, "exact");
    assert.equal(result.endKind, "exact");
  });

  it("preserves opposite endpoint correspondence", () => {
    const reversed = reverseCubic(horizontal);
    const component = analyzeCubicCubicDiscovery(
      discoverCubicCubicIntersections(horizontal, reversed, tolerance),
      tolerance,
    )[0]!;
    const result = refineCubicOverlapBoundaries(horizontal, reversed, component, tolerance);
    assert.ok(result.intersection !== null);
    assert.equal(result.intersection.direction, "opposite");
    assert.deepEqual(
      result.intersection.start.occurrences.map((value) => value.parameter),
      [0, 1],
    );
    assert.deepEqual(
      result.intersection.end.occurrences.map((value) => value.parameter),
      [1, 0],
    );
  });

  it("retains discovery-tolerance displacement for tolerance-induced overlap", () => {
    const nearby = cubicBezier(
      point(-1, 0.0005),
      point(-1 / 3, 0.0005),
      point(1 / 3, 0.0005),
      point(1, 0.0005),
    );
    const component = analyzeCubicCubicDiscovery(
      discoverCubicCubicIntersections(horizontal, nearby, tolerance),
      tolerance,
    )[0]!;
    const result = refineCubicOverlapBoundaries(horizontal, nearby, component, tolerance);
    assert.ok(result.intersection !== null);
    assert.ok(result.intersection.start.errorSquared > tolerance.intersection ** 2);
    assert.ok(result.intersection.start.errorSquared <= tolerance.discovery ** 2);
    assert.equal(result.startKind, "domain");
    assert.equal(result.endKind, "domain");
  });

  it("localizes shallow-crossing snap transitions at discovery tolerance", () => {
    const shallow = cubicBezier(
      point(-1, -0.01),
      point(-1 / 3, -0.01 / 3),
      point(1 / 3, 0.01 / 3),
      point(1, 0.01),
    );
    const component = analyzeCubicCubicDiscovery(
      discoverCubicCubicIntersections(horizontal, shallow, tolerance),
      tolerance,
    ).find((value) => value.kind === "overlap");
    assert.ok(component !== undefined);
    const result = refineCubicOverlapBoundaries(horizontal, shallow, component, tolerance);
    assert.ok(result.intersection !== null);
    assert.equal(result.startKind, "tolerance");
    assert.equal(result.endKind, "tolerance");
    assert.ok(result.intersection.start.errorSquared <= tolerance.discovery ** 2);
    assert.ok(result.intersection.end.errorSquared <= tolerance.discovery ** 2);
  });

  it("localizes snap transitions with unequal parameter speed", () => {
    const shallowSmoothstep = cubicBezier(
      point(-1, -0.01),
      point(-1, -0.01),
      point(1, 0.01),
      point(1, 0.01),
    );
    const component = analyzeCubicCubicDiscovery(
      discoverCubicCubicIntersections(horizontal, shallowSmoothstep, tolerance),
      tolerance,
    ).find((value) => value.kind === "overlap");
    assert.ok(component !== undefined);
    const result = refineCubicOverlapBoundaries(
      horizontal,
      shallowSmoothstep,
      component,
      tolerance,
    );
    assert.ok(result.intersection !== null);
    assert.equal(result.startKind, "tolerance");
    assert.equal(result.endKind, "tolerance");
    assert.ok(result.intersection.start.errorSquared <= tolerance.discovery ** 2);
    assert.ok(result.intersection.end.errorSquared <= tolerance.discovery ** 2);
    assert.ok(
      Math.abs(
        result.intersection.start.occurrences[0].parameter -
          result.intersection.start.occurrences[1].parameter,
      ) > 0.01,
    );
  });
});

const horizontal = cubicBezier(point(-1, 0), point(-1 / 3, 0), point(1 / 3, 0), point(1, 0));

describe("cubic/cubic discovery cells", () => {
  it("prunes disjoint curves without manufacturing candidates", () => {
    const distant = cubicBezier(point(-1, 2), point(-1 / 3, 2), point(1 / 3, 2), point(1, 2));
    const result = discoverCubicCubicIntersections(horizontal, distant, tolerance);
    assert.deepEqual(result.cells, []);
    assert.equal(result.exhausted, false);
  });

  it("localizes a crossing while preserving source parameter intervals", () => {
    const vertical = cubicBezier(point(0, -1), point(0, -1 / 3), point(0, 1 / 3), point(0, 1));
    const result = discoverCubicCubicIntersections(horizontal, vertical, tolerance);
    assert.equal(result.exhausted, false);
    assert.ok(result.cells.length > 0);
    assert.ok(
      result.cells.some((cell) => cell.firstInterval.start <= 0.5 && cell.firstInterval.end >= 0.5),
    );
    assert.ok(
      result.cells.some(
        (cell) => cell.secondInterval.start <= 0.5 && cell.secondInterval.end >= 0.5,
      ),
    );
    for (const cell of result.cells) {
      assert.ok(cell.firstInterval.start >= 0 && cell.firstInterval.end <= 1);
      assert.ok(cell.secondInterval.start >= 0 && cell.secondInterval.end <= 1);
      assert.ok(Object.isFrozen(cell));
      assert.equal(cell.termination, "geometric");
    }
  });

  it("produces a parameter-space chain for exact coincidence", () => {
    const result = discoverCubicCubicIntersections(horizontal, horizontal, tolerance);
    assert.equal(result.exhausted, false);
    assert.ok(result.cells.length > 100);
    assert.ok(result.cells[0]!.firstInterval.start === 0);
    assert.ok(result.cells.at(-1)!.firstInterval.end === 1);
    assert.ok(
      result.cells.every(
        (cell) =>
          Math.abs(cell.representativeParameters[0] - cell.representativeParameters[1]) < 0.002,
      ),
    );
  });

  it("balances successive one-axis splits for comparable geometry", () => {
    const coarseTolerance = createToleranceContext({
      ...tolerance,
      discovery: 0.75,
    });
    const result = discoverCubicCubicIntersections(horizontal, horizontal, coarseTolerance);
    assert.equal(result.exhausted, false);
    assert.ok(
      result.cells.every(
        (cell) =>
          cell.firstInterval.end - cell.firstInterval.start <= 0.5 &&
          cell.secondInterval.end - cell.secondInterval.start <= 0.5,
      ),
    );
  });

  it("reports budget exhaustion instead of turning it into geometry", () => {
    const result = discoverCubicCubicIntersections(horizontal, horizontal, tolerance, {
      maxCells: 1,
    });
    assert.equal(result.exhausted, true);
    assert.deepEqual(result.cells, []);
  });

  it("is deterministic", () => {
    const first = discoverCubicCubicIntersections(horizontal, horizontal, tolerance);
    const second = discoverCubicCubicIntersections(horizontal, horizontal, tolerance);
    assert.deepEqual(second, first);
  });
});
