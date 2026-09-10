import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  analyzeCubicCubicDiscovery,
  createToleranceContext,
  cubicBezier,
  discoverCubicCubicIntersections,
  point,
  reverseCubic,
} from "../src/index.js";

const tolerance = createToleranceContext({
  coordinate: 1e-8,
  discovery: 1e-3,
  intersection: 1e-9,
  parameter: 1e-10,
  relative: 1e-12,
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
