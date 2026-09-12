# psBezier — Implementation Plan

## Strategy
Build a new clean implementation from the specification upward. Do not begin by refactoring legacy `Area.js` or reproducing the old hierarchy.

The first milestones deliberately stop before Area boolean traversal and robust closed-path offset regularization. We want to inspect the common geometry/topology foundation before encoding the remaining signed-area and offset-retention decisions.

Read `OFFSET_TOPOLOGY.md` before designing intersection topology or path-offset APIs.

## Milestone 0 — Repository foundation
- Establish modern module/package structure.
- Choose/configure TypeScript unless the project owner explicitly chooses JavaScript before bootstrap.
- Configure tests, linting, formatting, and build.
- Add architecture/design documents.
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
- tests for identity, composition order, inverse round trips, reflections, singular and near-singular transforms, and non-mutation.

Specify and test canonical decomposition separately before implementing transform interpolation. Do not port the legacy `affine.js` object or its ambiguous `getX` methods. When cubic Béziers are available, add the invariant that transforming a curve then evaluating it agrees with evaluating it and then transforming the resulting point.

## Milestone 2 — Free cubic Bézier
Implement the minimal immutable free Bézier API needed by later work:
- evaluation;
- derivative/tangent/normal;
- split/subcurve;
- bounding box/extrema;
- reversal;
- linear recognition using squared cross-product test.

Port/reimplement proven Pomax mathematics selectively with attribution where code is adapted.

Test exact subdivision reconstruction and linear detection extensively.

### Future-offset awareness
Milestone 2 does **not** implement robust offsets. However, avoid APIs that would prevent later offset approximation from:
- evaluating position/tangent/normal robustly;
- subdividing/refining a cubic adaptively;
- producing multiple cubic pieces for one true offset segment;
- measuring approximation error under the geometry tolerance policy.

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

The path representation must permit later self-intersection processing; a path may have multiple distinct globalT occurrences at the same geometric point.

## Milestone 5 — Basic construction utilities
Implement broadly useful local construction primitives required by tests/app migration:
- canonical quarter-circle/circle;
- arc by canonical subdivision;
- selected tangent/parallel/perpendicular helpers;
- local join construction where requirements are settled.

Keep arcs as Bézier output, never a kernel primitive.

Do **not** treat robust closed-path offset as a trivial per-curve utility in this milestone. A local cubic offset approximation may be prototyped/tested if useful, but global contiguous offset regularization waits for self-intersection/incidence topology.

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

### Self-intersection requirement
The engine must support invoking the same path against itself while excluding trivial adjacency/identity cases appropriately. The output model must be capable of representing two distinct parameter occurrences on the same path.

## Milestone 7 — Intersection incidence topology and edges
Do **not** hard-code the topology as intrinsically `pathA/tA` plus `pathB/tB` with separate A/B rings.

Implement the more general model described in `OFFSET_TOPOLOGY.md`:
- one conceptual geometric Intersection;
- one binary IntersectionEvent with two IntersectionIncidences (final names may vary);
- each incidence references a path and globalT occurrence;
- the two incidences may reference different paths or the same path at different globalTs;
- distinct event identity when multiple events share one geometric point, without prematurely
  deciding the final higher-valence vertex-grouping model;
- next/previous incidence ordering along each path traversal;
- canonical averaged intersection point + errorSquared;
- outgoing edge state/metadata associated with the appropriate incidence/consumer;
- lazy path-interval derivation between consecutive incidences;
- loop-relative states `OUTER=+1`, `COINCIDENT=0`, `INNER=-1` where applicable;
- local balance validation for ordinary two-loop boolean topology;
- same/opposite overlap relationships;
- self-intersection validation cases.

Keep path-occurrence adjacency separate from consumer-scoped classification when the same
incidence topology can be reused by Boolean and offset operations.

Build validation tools before any boolean walker or offset regularizer.

The consumer-scoped storage, overlap constraints, and local balance-validation contract are
specified in `MILESTONE7_EDGE_CLASSIFICATION_DESIGN.md`. Implement that interpretation layer
without mutating the base arrangement. Design and approve the geometric loop-side classifier
separately before computing noncoincident states.

The proposed loop-side classifier is specified in
`MILESTONE7_LOOP_SIDE_CLASSIFICATION_DESIGN.md`: point/path distance, adaptive signed-crossing
containment rays, directed edge sampling, event characterization, then conditional balance
validation. Review this design before implementation.

## Milestone 7A — Boundary reconstruction infrastructure
Design/implement a reusable boundary assembly mechanism only after incidence topology is stable.

It must be capable of building a new immutable path from:
- selected source path intervals;
- reversed intervals where semantically valid;
- newly constructed line connectors;
- newly constructed cubic/round-join connectors.

Do not assume every result boundary is only a subset of the original edges.

This infrastructure is intended to be shared by Area booleans and robust offset cleanup, while their retention/classification policies remain separate.

## STOP / DESIGN REVIEW
Do not proceed automatically into Area boolean traversal or robust closed-offset regularization.

Review:
- API ergonomics;
- performance at accuracy-first tolerances;
- intersection/overlap diagnostics;
- self-intersection incidence behavior;
- topology invariants;
- boundary reconstruction requirements;
- registration-number stress cases.

Then resolve the remaining Area and offset-retention questions in the design documents.

## Milestone 8 — Binary simple-loop Boolean walk

Design the binary walk before implementation. Its inputs are exactly two simple closed loops with
complete Milestone 7 topology and classification. Union and intersection are the only local walk
policies; subtraction is represented later through signed Area reversal/intersection semantics.

The detailed contract is in `MILESTONE8_BOOLEAN_WALK_DESIGN.md`. In particular:

- consume validated directed transitions rather than recomputing containment;
- materialize selected source intervals through `extractPathInterval()`;
- walk every disconnected result cycle and consume each result-bearing directed exit once;
- settle coincident-edge ownership and contact transitions before implementing the full walker;
- keep multi-loop Area algebra and zero-intersection containment policy separate;
- reject self-intersecting Area-boundary inputs rather than repairing them inside the walker.

Self-intersection cycle decomposition is reusable topology, but cycle retention is consumer-specific.
General fill interpretation and offset regularization must not share one implicit “discard inner
loops” policy.

## Later milestones — intentionally unresolved
After design approval:
- signed Area construction/normalization;
- containment;
- zero-intersection cases;
- boolean walk;
- union/intersection/subtraction;
- local cubic offset approximation to configured accuracy;
- contiguous raw path offset with explicit join policies;
- positive/outward offset regularization;
- negative/inward offset regularization;
- multi-loop/Area offset behavior;
- large registration-number fuzz/visual harness;
- SVG I/O and application migrations.

## Acceptance philosophy
Correctness is relative to configured tolerance. Prefer smaller tolerances when practical. Performance optimization follows correctness and profiling.

A production-style sweep of many realistic registration-number variants, combined with hard topology invariants and permanent regression fixtures, is a primary confidence target.
