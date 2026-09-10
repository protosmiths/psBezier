# psBezier — Offset Construction and Topology

This document records architectural requirements discovered while planning robust offsets. It supplements `DESIGN.md` and should be read before implementing path offsets, self-intersection topology, or the final boolean walker.

## 1. Offset is not merely per-curve displacement

A useful path offset must preserve path-level continuity and produce valid topology. Offsetting each source Bézier independently and returning an array of unrelated offset curves is insufficient.

A robust offset is conceptually:

1. generate local offsets of source segments;
2. construct joins between neighboring offset segments according to the requested join policy;
3. obtain a raw contiguous offset path;
4. discover self-intersections and other topology changes in that raw path;
5. classify/select surviving boundary pieces according to signed offset semantics;
6. reconstruct one or more valid result boundaries, adding connector/join geometry when required.

The cleanup stage is therefore **boundary reconstruction**, not merely edge deletion.

## 2. Offset of a cubic is approximate

A true constant-distance offset of a general cubic Bézier is not generally another cubic Bézier. The local offset algorithm therefore approximates the true offset using one or more cubic Béziers to a configured accuracy.

This approximation is different from Bézier subdivision, which is exact relative to the source Bézier.

Offset approximation accuracy belongs to the geometry/tolerance policy. The implementation should favor accuracy and subdivide/refine as required rather than silently accepting a coarse approximation.

## 3. Join construction is a separate concern

Adjacent local offsets require an explicit join policy. Expected construction policies include the traditional families such as:

- extended/intersected offset segments;
- mitered/trimmed joins;
- round joins represented by canonical circular Bézier geometry.

Join construction occurs before global regularization. Global cleanup may later remove a join, trim it, switch branches at an intersection, or require surviving pieces to be reconnected.

Do not entangle the local join policy with the global self-intersection cleanup algorithm.

## 4. Positive and negative offsets have different retention semantics

Offset cleanup is related to boolean boundary walking but is not itself simply union or intersection.

For a conventional positively oriented closed shape:

- an outward/positive offset must discard folded/interior portions and retain the outer regularized envelope;
- an inward/negative offset must discard portions that lie outside the eroded result and retain the inner regularized boundary.

The exact retention rule will be specified with the topology/Area machinery. The important architectural point is that positive and negative offsets use complementary signed semantics.

## 5. Closed offsets may change topology

A robust closed-path offset cannot promise to return one `BezierPath`.

Examples of possible topology changes include:

- an inward offset splitting one component into several;
- a narrow bridge disappearing;
- a component disappearing entirely;
- holes shrinking or disappearing under outward offset;
- nearby components merging under outward offset when offsetting Area-level geometry.

Therefore a regularized closed offset naturally produces an Area-like multi-loop result. The exact public return type should be finalized with Area semantics, but the implementation must not assume one input loop implies one output loop.

Open-path offset APIs may have different output semantics and should be specified separately.

## 6. Self-intersections are required intermediate topology

Public normalized Area boundaries may eventually prohibit self-intersection, but the topology engine must support self-intersecting **intermediate** paths because construction operations such as offsets naturally generate them.

This changes the fundamental intersection abstraction.

An intersection event should not be modeled as intrinsically `pathA/tA` plus `pathB/tB`. Instead, a binary intersection event has two **incidences** (two path passages through the same conceptual geometric point):

```text
Intersection
  incidence1: { path, globalT, ... }
  incidence2: { path, globalT, ... }
```

For ordinary two-path intersections, the incidence paths differ.

For a self-intersection:

```text
incidence1.path === incidence2.path
incidence1.globalT !== incidence2.globalT
```

Each incidence has its own incoming and outgoing branch on its path traversal.

### Binary event is not necessarily a complete geometric vertex

The two-incidence rule belongs to a binary intersection **event**. It must not silently assert
that only two path passages can occur at one geometric location. Several pairwise events may
be coincident within tolerance, such as three loops meeting at one point, a self-intersection
coinciding with another path, or several segment endpoints sharing a vertex.

Whether those events remain distinct and cross-referenced or are grouped under a higher-level
`IntersectionVertex` is still unresolved. Preserve enough event and incidence identity to
make that decision later. Do not deduplicate multiple events merely because their canonical
points are numerically equivalent.

## 7. Intersection incidence replaces hard-coded A/B topology

The current design language of `nextA/prevA` and `nextB/prevB` is convenient for two distinct paths but is not the most general topology model.

The more fundamental structure is an `IntersectionIncidence` (final name may vary) containing or referencing:

- the geometric Intersection;
- source path;
- globalT occurrence;
- previous incidence along that path traversal;
- next incidence along that path traversal;
- outgoing edge classification/state as appropriate to the consumer.

For an ordinary A/B intersection, the two incidences participate in two different path rings.

For a self-intersection, both incidences participate at different locations in the same path ring.

This preserves the core concept that an intersection has two path passages, each with one incoming and one outgoing branch, without requiring those passages to belong to different path objects.

An incidence identifies a path occurrence and its traversal adjacency. A raw geometric state
relative to another loop, Area-wide membership, or offset-retention decision is scoped to a
particular arrangement/consumer and is not necessarily an intrinsic permanent property of
that reusable occurrence. The implementation may store such state beside an incidence when
the owning arrangement makes that scope unambiguous; it must not make later consumers inherit
an unrelated classification accidentally.

The array/index/globalT model of `BezierPath` remains unchanged.

## 8. Edges remain lazy path intervals

An edge remains the directed interval from one intersection incidence to the next incidence along a path traversal.

Do not eagerly materialize its Bézier geometry. Derive the source interval from the path and the two globalT values when a consumer actually needs it.

This remains useful for both boolean operations and offset cleanup because many candidate edges will not appear in the final reconstructed boundary.

## 9. Shared topology infrastructure, different consumers

Boolean operations and offset regularization should share lower-level machinery:

- intersection discovery/refinement;
- self-intersection support;
- incidence ordering;
- edge/path-interval representation;
- overlap/coincidence handling;
- topology validation;
- boundary reconstruction utilities.

They should **not** be forced into the same high-level operation.

A useful layering is:

```text
intersection / incidence arrangement
        +
lazy directed path intervals
        +
classification / retention policy
        +
boundary reconstruction
```

Area booleans and offset regularization supply different classification/retention policies over that common infrastructure.

## 10. Boundary reconstruction may create new geometry

Do not assume every output boundary is only a concatenation of surviving source edges.

At an intersection, reconstruction may switch from one raw path branch to another. Some
construction operations may also require a newly constructed connector consistent with their
requested join semantics. Regularization must not invent a connector merely to hide a gap or
topology failure: when surviving branches meet at a discovered intersection, they should join
at that intersection. Any new connector must have an explicit operation-level geometric
reason and validation rule.

A future `BoundaryBuilder`, `PathAssembler`, or equivalent should be able to append:

- a source path interval;
- a reversed source interval when semantically valid;
- a newly constructed line connector;
- newly constructed cubic/round-join geometry.

It then builds a new immutable contiguous `BezierPath`.

The final name/API is unresolved; the capability is required.

## 11. Interaction with boolean edge-state design

Do not assume the boolean `INNER/OUTER/COINCIDENT` retention rule is automatically the offset rule.

The recently resolved boolean layering remains useful:

```text
local geometry/topology -> directed/signed interpretation -> operation-specific semantics
```

Offset regularization is another operation-specific consumer of the topology graph.

Positive and negative offsets must be tested independently because their desired surviving envelopes are complementary.

## 12. Testing requirements

Offset tests should include at least:

- straight polyline offsets with each join policy;
- convex closed shapes;
- concave closed shapes;
- curves with tight curvature;
- offsets that create a simple self-crossing;
- offsets that create several self-crossings;
- inward offsets that split a component;
- inward offsets that eliminate a narrow feature/component;
- outward offsets that remove concave foldbacks;
- same geometry under reversal/orientation changes;
- cases close to the configured tolerance;
- line-heavy registration-number/shadow geometry;
- round/semi-round font geometry.

Every discovered production failure becomes a permanent regression fixture.

## 13. Design consequences for current milestones

This requirement does **not** block Milestone 2 (free cubic Bézier mathematics).

It does affect later milestones:

- path topology must permit self-intersection occurrences;
- intersection topology should use incidences rather than hard-coded A/B links;
- offset construction should not be treated as a trivial Milestone-5 per-curve utility;
- robust offset regularization should occur only after the shared intersection/incidence topology is mature;
- boolean and offset systems should share topology and boundary-reconstruction infrastructure without sharing an inappropriate high-level retention rule.

Codex should account for these future requirements when choosing APIs now, but should not prematurely implement the unresolved offset regularization algorithm during Milestone 2.
