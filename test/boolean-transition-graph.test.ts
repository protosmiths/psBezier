import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  analyzeDirectedTransitionGraph,
  type DirectedTransitionCorridor,
  type DirectedTransitionEdge,
} from "../src/index.js";

const identity = () => Object.freeze({});

function edge(from: object, to: object, additions = {}): DirectedTransitionEdge {
  return Object.freeze({ identity: identity(), from, to, ...additions });
}

describe("Milestone 8 topology-only transition graph", () => {
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
