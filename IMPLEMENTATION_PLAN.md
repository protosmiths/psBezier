# psBezier — Implementation Plan

## Strategy
Build a new clean implementation from the specification upward. Do not begin by refactoring legacy `Area.js` or reproducing the old hierarchy.

The first milestone deliberately stops before Area boolean traversal. We want to inspect the foundation before encoding the remaining signed-area decisions.

## Milestone 0 — Repository foundation
- Establish modern module/package structure.
- Choose/configure TypeScript unless the project owner explicitly chooses JavaScript before bootstrap.
- Configure tests, linting, formatting, and build.
- Add `DESIGN.md`, `AGENTS.md`, `IMPLEMENTATION_PLAN.md`, and `ATTRIBUTION.md`.
- No application framework dependency.

## Milestone 1 — Numeric/vector primitives
Implement and thoroughly test:
- Point/Vector value types;
- add/subtract/scale;
- dot;
- 2-D cross;
- lengthSquared/distanceSquared;
- projection/orientation helpers where justified;
- tolerance/context types.

No trig-based substitute for vector operations.

## Milestone 1A — Immutable affine transforms
Implement before curve and path transformation APIs:

- immutable six-scalar 2-D affine representation;
- identity, translation, scale, rotation, shear, reflection, and pivoted construction;
- unambiguous composition order;
- pure point and vector transformation;
- determinant, orientation, and tolerance-aware inverse;
- tests for identity, composition order, inverse round trips, reflections, singular and
  near-singular transforms, and non-mutation.

Specify and test canonical decomposition separately before implementing transform
interpolation. Do not port the legacy `affine.js` object or its ambiguous `getX` methods.
When cubic Béziers are available, add the invariant that transforming a curve then evaluating
it agrees with evaluating it and then transforming the resulting point.

## Milestone 2 — Free cubic Bézier
Implement the minimal immutable free Bézier API needed by later work:
- evaluation;
- derivative/tangent;
- split/subcurve;
- bounding box/extrema;
- reversal;
- linear recognition using squared cross-product test.

Port/reimplement proven Pomax mathematics selectively with attribution where code is adapted.

Test exact subdivision reconstruction and linear detection extensively.

## Milestone 3 — Analytic line handling and intersection dispatch
Implement:
- line-line crossing;
- endpoint contact;
- parallel/collinear classification;
- analytic overlap intervals and direction;
- line-cubic intersection;
- dispatch layer.

Do not route line-line through general cubic subdivision.

## Milestone 4 — BezierPathBuilder and immutable BezierPath
Implement:
- mutable builder/editor;
- immutable snapshot on `build()`;
- PathBezier nodes;
- doubly linked topology;
- array reference index;
- open/closed terminalPoint semantics;
- computed `end` getter;
- globalT evaluation/normalization;
- seam/wrap behavior;
- extraction/subdivision of path intervals.

Test insertion/removal/reindexing in builder and immutability of built paths.

## Milestone 5 — Construction utilities
Implement only broadly useful primitives required by tests/app migration:
- canonical quarter-circle/circle;
- arc by canonical subdivision;
- selected tangent/offset/fillet helpers.

Keep arcs as Bézier output, never a kernel primitive.

## Milestone 6 — Two-pass cubic/cubic intersection engine
Implement discovery and refinement as separate internal stages.

Discovery:
- recursive subdivision/pruning;
- preserve original t intervals;
- identify isolated vs overlap candidates using the configured discovery tolerance.

Refinement:
- restart from saved intervals;
- use tighter tolerance;
- refine isolated intersections;
- refine/verify overlap endpoints.

Expose diagnostics sufficient to visualize/debug candidate intervals and errors.

The exact overlap-candidate criterion is still a design question: implement only after it is explicitly approved.

## Milestone 7 — Intersection topology and edges
Implement:
- canonical averaged intersection point + errorSquared;
- globalT on both paths;
- dual next/prev intersection rings;
- outgoing edge state on each path;
- lazy path-interval derivation;
- states `OUTER=+1`, `COINCIDENT=0`, `INNER=-1`;
- balance invariant `A_in+A_out+B_in+B_out=0`;
- same/opposite overlap relationships.

Build validation tools before any boolean walker.

## STOP / DESIGN REVIEW
Do not proceed automatically into Area boolean traversal.

Review:
- API ergonomics;
- performance at accuracy-first tolerances;
- intersection/overlap diagnostics;
- topology invariants;
- registration-number stress cases.

Then resolve the remaining Area questions in `DESIGN.md`.

## Later milestones — intentionally unresolved
After design approval:
- signed Area construction/normalization;
- containment;
- zero-intersection cases;
- boolean walk;
- union/intersection/subtraction;
- large registration-number fuzz/visual harness;
- SVG I/O and application migrations.

## Acceptance philosophy
Correctness is relative to configured tolerance. Prefer smaller tolerances when practical. Performance optimization follows correctness and profiling.

A production-style sweep of many realistic registration-number variants, combined with hard topology invariants and permanent regression fixtures, is a primary confidence target.
