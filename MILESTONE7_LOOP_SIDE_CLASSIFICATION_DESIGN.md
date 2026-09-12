# Milestone 7 — Loop-side classification design

## Purpose and sequencing

Given a complete intersection arrangement for two closed loops, classify every noncoincident
outgoing incidence edge of either loop as `INNER` or `OUTER` relative to the other loop.

The design has three layers:

1. point-to-loop boundary distance;
2. point relative to a closed loop (`INSIDE / OUTSIDE / BOUNDARY / UNRESOLVED`); and
3. classification of an incidence-split edge from consistent interior samples.

This remains pairwise even when an arrangement contains additional paths. An incidence introduced
by a third path splits the sampled edge, but an A edge is still classified only relative to B.

No Boolean operation, Area-wide membership, edge-retention rule, or walker belongs in this layer.

## 1. Why sampling is sufficient

After all A/B intersections and coincident intervals have been discovered, the containment state
of a noncoincident A edge relative to B is constant over its open interval. A change from inside to
outside requires another encounter with B's boundary, which should have introduced another event
or overlap frontier.

This is an invariant to validate, not an excuse to hide incomplete discovery. If well-separated
samples on one incidence edge produce conflicting states, classification is unresolved and the
arrangement/search diagnostics must be investigated. The classifier never votes between
conflicting states.

## 2. Point-to-loop boundary distance

Containment first needs to distinguish an ordinary query point from a point at meaningful boundary
distance. The primitive should return a detailed result:

```ts
interface PointPathDistanceReport {
  distanceSquared: number;
  pathGlobalT: number;
  point: Point;
  complete: boolean;
  diagnostics: ...;
}
```

It minimizes squared distance to every cubic and retains the closest path occurrence. Because the
stationary equation for squared point-to-cubic distance is generally quintic, it must not be
forced through the existing cubic polynomial solver. Use bounded adaptive subdivision followed by
safe local refinement, with an explicit budget and conservative lower bounds. Budget exhaustion is
diagnostic and cannot establish that a point is off the boundary.

For a query point `P`:

- established distance `<= tolerance.coordinate` means `BOUNDARY`;
- established lower bound `> tolerance.coordinate` permits containment rays;
- an incomplete distance result spanning the threshold means `UNRESOLVED`.

Proximity beyond the boundary threshold does not itself weaken containment. A clean test segment
can classify a point arbitrarily close to the loop. Numerical difficulty belongs to a particular
test segment—overlap, tangency, knot contact, or poor conditioning—not globally to the query point.
Change the external point when a ray is unsuitable.

An edge sample near B may indicate a missing contact or tolerance-coincident interval, but proximity
alone does not prove that the curves intersect. It triggers resampling/diagnostics rather than a
fabricated event.

## 3. Point relative to a closed loop

The public geometric result is four-valued:

```ts
type PointLoopRelation = "inside" | "outside" | "boundary" | "unresolved";
```

The detailed report retains boundary-distance evidence and every attempted containment segment.
The convenience API may return the four-valued relation but must never coerce `unresolved` to a
Boolean.

The loop must be closed. This classifier describes a single loop using the nonzero winding rule;
it is not complete signed-Area membership. `winding === 0` is `OUTSIDE`; nonzero winding is
`INSIDE`. The sign is diagnostic/orientation information, while inside/outside depends only on
whether it is zero.

### Deterministic external points

Choose a deterministic sequence of points comfortably outside an expanded tight loop bounding
box. Use asymmetric candidates around several sides/corners so repeated alignment with knots and
extrema is unlikely. Expansion must be scale-aware and strictly larger than coordinate/discovery
tolerances. Every candidate is verified outside the unexpanded bounds before use.

For each candidate Q, test the finite segment `P -> Q`. Do not use randomness; repeated calls with
identical inputs and tolerances must produce identical reports.

### Clean signed-crossing test

Intersect the test segment with every loop cubic using the analytic line/cubic machinery, lift
parameters to canonical path `globalT`, and deduplicate only identical path occurrences. Do not
construct a second full path arrangement merely for containment.

For direction `D = Q - P` and loop tangent `T` at a clean occurrence, the sign of `cross(D, T)` is
the signed crossing contribution. No angle or trigonometric calculation is needed.

A containment segment is accepted only when every relevant event is a clean transverse crossing:

- no finite overlap with the test segment;
- no unresolved/incomplete segment intersection;
- no occurrence at either endpoint of the test segment;
- no occurrence within parameter tolerance of a loop knot;
- no stationary/undefined loop tangent;
- and `cross(D, T)` is safely separated from zero by a scale-relative conditioning test.

If any condition fails, reject the entire candidate Q and try the next one. A ray through a knot is
not counted using only the following segment's tangent: canonical knot ownership prevents duplicate
event identity, but one outgoing tangent alone does not prove whether the boundary crosses or merely
touches the test segment.

For a clean candidate, sum `+1/-1` crossing signs. Sum zero gives `OUTSIDE`; nonzero gives `INSIDE`.
Candidate rays are alternative numerical constructions of the same query, so two accepted rays
must agree on zero versus nonzero winding. Disagreement yields `UNRESOLVED`, never majority vote.

If every deterministic ray is unsuitable, return `UNRESOLVED` with reasons.

## 4. Directed edge sampling

Samples must lie on the actual source interval, not on a chord between its endpoints. For an
`IntersectionEdge`, sample at traversal fractions initially ordered:

```text
1/2, 1/4, 3/4, 1/8, 3/8, 5/8, 7/8
```

Map a fraction through the directed path interval, including closed-seam wrap, then evaluate the
source path. This mapping should be a reusable path operation; callers must not need to enumerate
crossed cubic segments.

The fraction is parameter progress through the directed globalT interval, not arc length. Arc-length
uniformity is unnecessary for containment, although subdivision may become highly nonuniform for a
very short or poorly parameterized interval.

Skip samples classified `BOUNDARY`; retain their distance diagnostics. Continue deterministically
until:

- at least one usable sample is found and all additional required validation samples agree;
- the configured sample set/budget is exhausted; or
- contradictory usable states are found.

One midpoint with a conclusive nonboundary containment result is normally sufficient, regardless
of its distance beyond `tolerance.coordinate`. Additional samples are required when containment is
unresolved, the edge is very short relative to tolerance, or diagnostics request stronger
validation. Test/audit modes may require multiple agreeing samples on every edge.

Results:

- every usable sample `INSIDE` -> `INNER`;
- every usable sample `OUTSIDE` -> `OUTER`;
- mixed inside/outside -> unresolved `inconsistent-edge-state`;
- no usable sample -> unresolved `no-safe-edge-sample`.

Very short edges are not assigned state from an endpoint perturbation that may leave the edge. If
no evaluable interior sample is safely separated from the other loop, the result remains unresolved.

## 5. Overlaps and frontiers

Edges constrained by a nonstationary overlap bypass containment and are `COINCIDENT`. This includes
all edges created by unrelated intervening incidences inside the overlap interval.

At a tolerance-induced or exact overlap frontier, only the coincident interval receives zero. The
adjacent noncoincident edge is sampled in its own open interval. If every available sample remains
boundary-near, the frontier classification is unresolved rather than inferred from tangents.

Stationary overlap relationships remain unresolved as already required by the consumer-scoped
classification layer.

## 6. Transverse/tangent event characterization

Tangents and cross products remain valuable diagnostics, but they are not the primary source of
edge state. Sampling plus point-to-loop relation determines raw `INNER/OUTER` directly and without
using loop orientation.

After edge states exist, each binary A/B event may be characterized from its incoming/outgoing
state transitions and differential conditioning:

- transverse crossing: both paths change side with well-conditioned transverse tangents;
- contact/tangency: one or both paths retain side and tangents are tangent/degenerate;
- overlap frontier: incident coincident constraint plus classified noncoincident branches;
- unresolved: insufficient or contradictory evidence.

Only an event positively identified as a transverse crossing enables the four-edge zero-sum
validation. Tangencies and contacts are never rejected merely because their sum is nonzero.

## 7. Completeness and diagnostics

The detailed loop-pair classifier reports independently:

- intersection arrangement completeness inherited from discovery;
- point-distance completeness;
- containment-ray suitability and winding sums;
- samples attempted for each edge;
- overlap-imposed states;
- unresolved edge classifications;
- inconsistent constant-state evidence;
- event characterization; and
- conditional invariant failures.

It publishes a complete `LoopPairClassification` only when every outgoing incidence edge on both
scoped loops has a resolved state and all applicable validations pass. Partial classifications may
be returned diagnostically but cannot feed a Boolean walker.

## 8. Implementation order

1. Directed path-fraction evaluation, including closed seam and very short intervals.
2. Point-to-cubic/path distance with explicit completeness diagnostics.
3. Deterministic external-candidate generation.
4. Clean signed-crossing point-to-loop classifier.
5. Multi-sample incidence-edge classifier with overlap constraints.
6. Event characterization and conditional zero-sum validation.
7. Metamorphic/adversarial audit before any Boolean walker.

## 9. Required tests

- point clearly inside, outside, and within boundary tolerance;
- candidate segment through a knot rejected, alternate candidate succeeds;
- tangent/overlapping candidate segment rejected, alternate succeeds;
- deterministic agreement across several accepted external points;
- signed winding preserved under loop reversal while inside/outside is unchanged;
- containment near stationary/cusp-like geometry;
- midpoint evaluated on a multi-cubic interval and across the closed seam;
- edge split only by a third-loop event classified relative to the scoped other loop;
- exact and tolerance-induced overlap frontiers;
- short edge with no safe sample remains unresolved;
- multiple edge samples agree for a valid arrangement;
- conflicting samples diagnose a missing event instead of voting;
- translation, rotation, reflection, and uniform-scale metamorphic families with scaled tolerances;
- deterministic results under small perturbations around boundary tolerance; and
- zero-sum checked for positively characterized transverse crossings but not tangencies.
