# psBezier — Design Specification

## Purpose
psBezier is a modern, Bézier-native 2-D geometry library for precision graphics, manufacturing geometry, and educational visualization. The rewrite is specification-driven. Legacy psBezier and Pomax/bezierjs are references for algorithms and edge cases, not architectural authorities.

> Preserve Bézier geometry through geometric operations. Do not flatten curves into polygons merely to perform intersections, containment, or boolean operations.

## Core geometry
- Curved kernel geometry is cubic Bézier.
- Straight lines are recognized and receive analytic fast paths.
- Quadratics may be imported by lossless degree elevation to cubic.
- Circular arcs are construction operations, not kernel primitives.
- A circle is four canonical 90° cubic approximations. Smaller arcs are transformed canonical quarters or exact subdivisions of them, favoring consistent coincidence over negligible gains from independently optimized arc approximations.
- Bézier subdivision is exact relative to the original Bézier.

## Vector/matrix-first mathematics
Prefer dot/cross products, determinants, projections, affine matrices, squared lengths, and squared distances over trigonometry when the requested result is not itself angular. Use trig when an angle is genuinely an input or output.

## Affine transforms
Affine transforms are first-class geometry in psBezier. They are used for construction,
layout, slant, reflection, coordinate-system conversion, display, and manufacturing output.
They are not merely a rendering adapter.

The core representation is an immutable 2-D affine transform stored as six scalar values.
It maps a point by:

`x' = a*x + c*y + e`

`y' = b*x + d*y + f`

This matches the conventional SVG/Canvas six-value layout. Public APIs use named values;
nested mutable arrays are not authoritative storage.

Core affine operations are pure and include:

- identity, translation, scale, rotation, shear, and reflection construction;
- explicit composition whose order is documented and tested;
- application to points and to displacement vectors, with translation omitted for vectors;
- determinant/orientation and invertibility queries;
- tolerance-aware inversion; and
- transformation of Bézier control points and complete paths.

Operations do not mutate their transform, point, vector, curve, or path arguments. Pivoted
operations are constructed explicitly by composition around a supplied pivot; a pivot is
not recoverable from a composed matrix.

### Decomposition and interpolation
An affine matrix does not uniquely retain the historical sequence of settings that created
it. APIs must not claim to recover an original rotation, scale, shear, reflection, or pivot
from an arbitrary composed transform.

Applications that need editable source settings retain those settings separately and derive
the affine transform from them. When only a matrix is available, psBezier may produce a
documented canonical decomposition for analysis and interpolation. That decomposition is a
stable factorization, not recovered history.

Transform interpolation is a higher-level affine facility. It canonically decomposes each
endpoint, resolves equivalent representations consistently, interpolates translation,
rotation, scale, and shear according to explicit policies, and recomposes the result.
Rotation defaults to the shortest angular path. Reflection transitions, near-singular
transforms, deliberate multiple rotations, and moving pivots require explicit caller policy
or retained source parameters.

Do not expose ambiguous getters such as `getScale()` for a general affine transform. Offer
precisely named quantities instead, such as determinant, basis-vector lengths, singular
values/principal stretches, or components from the documented canonical decomposition.

## Numeric model and tolerance
The kernel is unitless. Applications supply tolerances in the active coordinate system. Applications are responsible for mapping physical accuracy and coordinate scale into numeric tolerance.

Accuracy is favored over speed. Do not enlarge tolerance to hide a geometry/topology bug.

Keep these concepts distinct:
- **discovery/overlap tolerance:** coarser; used to discover topology and possible coincident intervals;
- **refinement/intersection tolerance:** tighter; used to localize isolated intersections and overlap endpoints;
- **parameter tolerance:** dimensionless comparisons in parameter space.
- **relative tolerance:** dimensionless conditioning tests whose meaning must remain stable under uniform scale.

## Free Bézier vs path Bézier
A free Bézier owns start, two controls, and end.

A path-owned Bézier owns start, two controls, `prev`, `next`, and index. Its `end` is a computed getter:
- normally `next.start`;
- for the last segment of an open path, `path.terminalPoint`;
- for a closed path, `last.next === first`, therefore `last.end === first.start`.

Free and path Béziers share read-only mathematical behavior without forcing path topology to inherit free-Bézier storage.

## Linear recognition
For baseline `D = P3-P0`, each interior control `Pi` is sufficiently collinear when:

`cross(D, Pi-P0)^2 <= epsilon^2 * lengthSquared(D)`

This avoids rotation, trig, and square root. Degenerate baselines require explicit handling. Linearity may be cached on immutable geometry.

## BezierPath
One `BezierPath` class represents open and closed contiguous paths.

Authoritative topology is a doubly linked sequence of path Béziers. An array of node references provides O(1) indexing for globalT; it is an index, not the topology.

Closure is encoded by the terminal endpoint:
- valid `terminalPoint` => open;
- `terminalPoint === null` => closed.

Open:
- `first.prev = null`
- `last.next = null`
- `last.end = terminalPoint`

Closed:
- `first.prev = last`
- `last.next = first`
- `terminalPoint = null`

### GlobalT
For segment index `i` and local parameter `t`:

`globalT = i + t`

Internal segment endpoints use the next segment's `t=0` as canonical rather than duplicating the previous segment's `t=1`.

Closed N-segment path: `[0,N)` with N wrapping to 0.
Open N-segment path: `[0,N]`, with N the unique terminal endpoint.

## Construction/editing and immutability
Finished geometry used by Areas is immutable.

Use a mutable `BezierPathBuilder`; `build()` snapshots points, controls, topology, and index into an immutable `BezierPath`. A builder/editor may be created from an immutable path, but later edits must not alter the original.

Once a closed path is part of an Area, ordinary modification occurs through Area operations, not point/path mutation.

## Geometric construction layer
Higher-level construction utilities sit above the kernel: circles, arcs, fillets, tangencies, offsets, parallels/perpendiculars, registration-character helpers, etc. They operate on/produce Bézier geometry, preferably through builders.

## Intersection dispatch
- line × line: analytic vector/determinant method;
- line × cubic: line/cubic method;
- cubic × line: same method with parameters reordered;
- cubic × cubic: subdivision/search.

Line-line must explicitly handle crossing, endpoint contact, parallel/disjoint, collinear/disjoint, partial/full overlap, and same/opposite overlap direction.

Analytic intersection routines return topology-neutral binary records containing paired
parameter occurrences, canonical point/error data, and paired endpoints for finite overlaps.
They do not create path rings or store Boolean/offset classifications. The incidence-topology
layer later lifts each paired point into an `IntersectionEvent`; overlap endpoints naturally
become two such events. This same result shape is used for line-line and line-cubic work so
analytic fast paths do not become a separate topology model.

## Two-pass cubic intersection search
### Pass 1: topology discovery
Use wider discovery tolerance. Recursive nodes retain original parameter intervals `[tA0,tA1] × [tB0,tB1]`. Classify surviving regions as none, isolated-intersection candidate, or overlap candidate. Do not refine everything to final accuracy.

### Pass 2: local refinement
Restart/refine from saved parameter intervals using tighter tolerance. Refine isolated candidates locally. For overlap candidates, refine endpoints and verify the interior remains consistent with overlap.

This obtains high final accuracy without fine-tolerance recursion over the entire curve pair.

## Intersection model
An intersection is conceptually one point on both paths. Numerically:

`pA = A.get(tA)`
`pB = B.get(tB)`

Canonical point is normally `(pA+pB)/2`. Retain `distanceSquared(pA,pB)` as a diagnostic. Do not alter t values merely to force either curve through the averaged point.

An intersection retains globalT on both paths, canonical point/error, next/prev intersection on each path, and outgoing edge state for each path.

## Edges
An edge is the directed interval from one intersection to the next along a path. Geometry is derived lazily from the source path and the two globalT values.

Each intersection owns the outgoing edge state for each path. Incoming state comes from the previous intersection.

States:
- `OUTER = +1`
- `COINCIDENT = 0`
- `INNER = -1`

These raw geometric states are relative to the particular other loop participating in the
intersection topology. They do not include either loop's orientation or the complete
opposite Area's signed membership.

Loop orientation is a separate sign:

- clockwise: `+1`;
- counter-clockwise: `-1`.

For a signed loop walk, derive rather than store:

`effectiveWalkState = geometricState * orientationSign`

Reversing a loop changes its orientation sign and traversal direction. It does not mutate or
swap the loop-relative raw `INNER` and `OUTER` classifications. Coincident state remains zero
under either orientation.

### Intersection balance invariant
At every valid intersection:

`A_in + A_out + B_in + B_out = 0`

Failure means detection, overlap interpretation, or classification is inconsistent; boolean walking must not proceed.

## Coincident sections
Coincidence is normal geometry. A finite coincident interval is represented by two intersection events.

Same-direction overlap: both paths traverse the shared interval the same way.
Opposite-direction overlap: one traverses it opposite the other.

Topology should encode which incoming/outgoing branches coincide. A sufficiently short overlap may be topologically indistinguishable from a point intersection under configured tolerance.

## Area
An `Area` contains one or more closed immutable BezierPaths.

With SVG/screen coordinates (Y down):
- CW contributes positive area;
- CCW contributes negative area.

As a boundary is traversed, area to the right is positive.

Area may contain solids, holes, disconnected components, and signed/negative intermediate regions required by boolean algebra. A CW loop inside a CCW loop can define a meaningful negative annulus and must not be normalized away merely because it currently contains no positive material.

Exact signed normalization remains an open design question; normalization must preserve meaningful signed geometry.

## Boolean operations
Fundamental public operation is binary: `Area × Area -> Area`.

Multi-Area expressions compose binary operations with explicit grouping. Union and intersection are semantically commutative and associative and must be tested as such. Subtraction is not associative; its intended implementation is related to intersection with/reversal of negative signed area.

Do not build N-way intersection topology without demonstrated need.

For multi-loop Areas, intersections and raw geometric edge states remain pairwise between
paths. Area-wide signed winding or membership is separate information used by the Boolean
operation; it must not be folded into the local loop-relative state.

Detailed signed normalization, containment, zero-intersection handling, and boolean walking are later design milestones.

## Validation/testing
Preprocessing must produce valid topology before walking. The walker must not compensate for invalid topology.

Use unit, invariant/property, metamorphic, regression, and large production-sweep tests.

Important invariants include structural closure, globalT consistency, overlap pairing, intersection balance, complete edge consumption, output closure, finite numbers, and commutativity/associativity of union/intersection.

The aircraft registration-number generator is a major integration/torture harness: sweep common fonts, characters, slants, shadow directions/offsets, and layouts; automatically validate topology and render result sheets for visual inspection. Every discovered failure becomes a permanent regression fixture.

Differences below configured tolerance are equivalent geometry, not defects.

## Open design questions
Do not silently resolve these during unrelated work:
1. Exact signed-Area normalization rules.
2. Final containment algorithm for signed multi-loop Areas.
3. Zero-intersection boolean rules under signed semantics.
4. Detailed boolean walk/state machine.
5. Self-intersecting Area input: support or prohibit.
6. Multiple distinct intersection events at one geometric point.
7. Exact cubic overlap discovery/verification criterion.
8. Additional tolerance categories, only if demonstrated necessary.
9. The canonical affine decomposition convention and reflection-matching policy used by
   matrix-only interpolation.

### Boolean Area-semantics boundary

The local edge-state model is resolved: raw state is loop-relative, orientation is separate,
and their product provides an orientation-derived effective walk state. The following remains
unresolved: how complete opposite-Area signed winding and the requested Boolean operation
select, discard, or reverse candidate directed edges.

Before approving the final walker, define Area-level data and truth tables beginning with the
two-intersection overlapping-loop subtraction case, then cover holes, disconnected signed
components, coincidence, and zero-intersection cases. An edge can be geometrically inside an
outer loop while lying inside one of that Area's holes, so effective loop walk state alone is
not a complete Boolean selection rule.
