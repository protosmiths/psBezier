# psBezier --- Architectural Decisions

This file records important architectural decisions for psBezier and,
especially, the reasoning behind them.

`DESIGN.md` is the authoritative description of the current design. This
file exists so future maintainers and coding agents can understand why
choices were made and avoid accidentally "improving" away properties
that are intentional.

------------------------------------------------------------------------

## ADR-001 --- New implementation rather than legacy refactor

**Decision:** Build the new psBezier from a clean architecture. Retain
psBezier-Legacy as reference material rather than preserving its class
hierarchy or API.

**Reasoning:** The legacy implementation contains valuable algorithms,
experiments, and discovered edge cases, but it also contains
architectural choices accumulated over several generations of
development. Coding agents should not inherit those structures merely
because they already exist.

**Consequence:** Legacy code may be consulted deliberately for
mathematics, behavior, and regression cases. It is not architectural
authority.

------------------------------------------------------------------------

## ADR-002 --- Bézier-native geometry

**Decision:** Preserve Bézier geometry through core geometric operations
rather than flattening curves into polygons.

**Reasoning:** Polygon approximation trades precision against
subdivision density and can turn exact or intentionally coincident curve
relationships into near-coincident line segments. Precision graphics and
manufacturing geometry benefit from retaining the original parametric
curves.

**Consequence:** Intersection, containment, and boolean systems are
designed around Bézier paths. Flattening is reserved for
rendering/export contexts that require it.

------------------------------------------------------------------------

## ADR-003 --- Cubic curves plus analytically recognized lines

**Decision:** Cubic Béziers are the core curved primitive. Straight
lines receive explicit analytic treatment.

**Reasoning:** Cubics are sufficient for the intended geometry.
Quadratics can be degree-elevated to cubics without changing their
locus. Lines occur frequently in the target applications and have more
deterministic and efficient mathematics than general cubic/cubic
processing.

**Consequence:** Intersection dispatch has three important cases:
line-line, line-cubic, and cubic-cubic.

------------------------------------------------------------------------

## ADR-004 --- Vector/matrix mathematics preferred over trigonometry

**Decision:** Prefer cross products, dot products, determinants,
projections, affine matrices, squared lengths, and squared distances
when they directly answer the geometric question.

**Reasoning:** Many geometric questions do not require an angle.
Converting to angles introduces unnecessary trig, quadrant handling,
normalization, and numerical complexity.

**Consequence:** Trigonometry remains appropriate when an angle itself
is genuinely an input or output, such as a requested slant angle.

------------------------------------------------------------------------

## ADR-005 --- Squared cross-product linearity test

**Decision:** Determine whether a cubic is effectively linear by testing
the perpendicular deviation of its interior controls from the endpoint
baseline using squared cross products.

For baseline `D = P3 - P0` and interior control `Pi`:

`cross(D, Pi-P0)^2 <= epsilon^2 * lengthSquared(D)`

**Reasoning:** This expresses the desired geometric distance test
without rotating coordinates, computing angles, or taking a square root.

**Consequence:** Cubics within configured tolerance of a line can use
analytic line fast paths.

------------------------------------------------------------------------

## ADR-006 --- One BezierPath model for open and closed paths

**Decision:** Use one `BezierPath` abstraction rather than separate
open-path and loop classes.

**Reasoning:** Open and closed paths have the same fundamental
contiguity requirement. Their only structural difference is the final
endpoint relationship.

**Consequence:** A valid terminal point means the path is open. A `null`
terminal point means it is closed and the final segment wraps to the
first.

------------------------------------------------------------------------

## ADR-007 --- Linked list is topology; array is an index

**Decision:** The authoritative topology of a BezierPath is a doubly
linked sequence of path-owned Bézier nodes. Maintain an array of
references as an indexing shortcut.

**Reasoning:** Linked topology naturally expresses forward/backward
traversal, insertion, removal, and closed wraparound. The array provides
O(1) segment access needed by globalT. Reindexing after structural edits
is inexpensive for expected path sizes.

**Consequence:** The array must never become a second independent
representation of connectivity.

------------------------------------------------------------------------

## ADR-008 --- Path Bézier endpoints are computed

**Decision:** A path-owned Bézier does not separately store its ending
point.

It owns its start and controls. Its `end` is a getter derived from: -
`next.start`, normally; - the path terminal point for the final segment
of an open path.

For a closed path, `last.next === first`, so `last.end === first.start`.

**Reasoning:** Contiguity should be true by representation, not
maintained by synchronizing duplicate endpoint values.

**Consequence:** Gaps between adjacent path segments cannot arise from
independently edited duplicate endpoints.

------------------------------------------------------------------------

## ADR-009 --- GlobalT addresses the whole path

**Decision:** Use:

`globalT = segmentIndex + localT`

**Reasoning:** A single scalar address for every point on a contiguous
path greatly simplifies intersection ordering, midpoint selection, path
extraction, and boolean traversal.

**Consequence:** Internal segment endpoints are canonically represented
by the following segment at local `t=0`. Closed paths wrap at N; open
paths allow N as the unique terminal endpoint.

------------------------------------------------------------------------

## ADR-010 --- Finished geometry is immutable

**Decision:** Finished BezierPaths and geometry contained by Areas are
immutable.

**Reasoning:** Area operations generate new geometry. Mutating source
paths underneath cached bounds, intersections, classifications, or Areas
creates difficult aliasing and invalidation problems.

**Consequence:** Editing occurs through a mutable builder/editor.
`build()` creates an immutable snapshot. An editor created from an
existing path edits a copy and produces a new path.

------------------------------------------------------------------------

## ADR-011 --- Canonical 90-degree Bézier defines circular geometry

**Decision:** A circle is four canonical 90-degree cubic Bézier
approximations. Circular arcs are derived from transformed canonical
quarters and exact Bézier subdivision rather than introduced as a
separate Arc primitive.

**Reasoning:** A cubic cannot represent a true circle exactly. Using one
canonical approximation ensures that a 45-degree or 22.5-degree piece
derived from a circle is exactly the corresponding portion of the
library's canonical circle representation. Internal consistency and
exact coincidence are more valuable here than the insignificant accuracy
improvement obtainable by independently optimizing every smaller arc.

**Consequence:** Construction concepts such as circles and arcs do not
expand the kernel primitive set.

------------------------------------------------------------------------

## ADR-012 --- Kernel is unitless; tolerance comes from context

**Decision:** psBezier does not know about inches, pixels, plotter
units, Composer units, or other application units. Tolerances are
supplied in the active coordinate system.

**Reasoning:** The same physical geometry may be represented with
coordinate values differing by factors such as 100. Accuracy
requirements belong to the application/context that understands that
scale.

**Consequence:** Applications translate meaningful accuracy into
coordinate-space tolerances before invoking geometry algorithms.

------------------------------------------------------------------------

## ADR-013 --- Accuracy is favored over speed

**Decision:** When choosing between reasonable tolerances, bias toward
the smaller value unless profiling demonstrates unacceptable cost.

**Reasoning:** Intersection accuracy determines downstream topology.
Processing time is generally less important than correct manufacturing
geometry.

**Consequence:** Do not enlarge tolerance merely to make a difficult
test pass or to reduce recursion.

------------------------------------------------------------------------

## ADR-014 --- Intersection discovery and refinement are separate jobs

**Decision:** Cubic/cubic intersection processing uses two conceptual
passes.

1.  A wider-tolerance discovery pass identifies isolated-intersection
    and overlap candidates while retaining the original parameter
    intervals.
2.  A tighter refinement pass restarts from those saved intervals to
    accurately locate isolated intersections and overlap endpoints.

**Reasoning:** The old approach refined every possible interaction to
the same tolerance and only afterward inferred overlaps from dense
clusters of intersections. Topology discovery does not require the same
precision as final endpoint localization.

**Consequence:** High final accuracy need not impose fine-tolerance
recursion across the entire curve pair.

------------------------------------------------------------------------

## ADR-015 --- Preserve t intervals during recursive search

**Decision:** Every recursive intersection-search node retains the
original-curve parameter intervals represented by its subdivided pieces.

**Reasoning:** Those intervals are the bridge between coarse discovery
and local refinement. They allow the second pass to restart exactly
where the first pass found relevant geometry.

**Consequence:** Refinement must not restart from `[0,1] × [0,1]` unless
there is a specific reason to do so.

------------------------------------------------------------------------

## ADR-016 --- Canonical intersection point is symmetric

**Decision:** An intersection has a parameter on each path. If
evaluating them gives slightly different points, use their arithmetic
mean as the canonical intersection point and retain the squared
discrepancy as a diagnostic.

**Reasoning:** Neither curve is privileged. The two t values remain the
authoritative parametric locations; the averaged point is a symmetric
representative of the conceptual shared point.

**Consequence:** Do not modify either t merely to force a source curve
through the averaged point.

------------------------------------------------------------------------

## ADR-017 --- Edges are intervals between intersections

**Decision:** An edge is the directed path interval from one
intersection to the next intersection along that path.

**Reasoning:** Boolean topology changes only at intersections. The
geometry between them can therefore be classified as one unit.

**Consequence:** Edge geometry is derived lazily from the immutable
source path and the two globalT values rather than eagerly copied.

------------------------------------------------------------------------

## ADR-018 --- Each intersection owns outgoing edge states

**Decision:** For each participating path, an intersection stores/owns
the state of the edge leaving that intersection. The incoming edge is
obtained from the previous intersection on that path.

**Reasoning:** The dual doubly linked intersection rings already define
edge adjacency. A separate linked edge structure would duplicate
topology.

**Consequence:** At intersection I: - A incoming = `I.prevA.edgeA` - A
outgoing = `I.edgeA` - B incoming = `I.prevB.edgeB` - B outgoing =
`I.edgeB`

------------------------------------------------------------------------

## ADR-019 --- Edge states are signed and locally balanced

**Decision:** Encode edge classification as:

-   `OUTER = +1`
-   `COINCIDENT = 0`
-   `INNER = -1`

At every valid intersection:

`A_in + A_out + B_in + B_out = 0`

The states are raw geometric classifications relative to the particular
other loop participating in the intersection. They exclude loop
orientation and complete opposite-Area membership.

**Reasoning:** The classifications around an intersection are not
independent. The zero-sum relationship provides a compact structural
invariant that detects misclassified or misinterpreted topology before
boolean walking.

**Consequence:** A boolean walk must not proceed when this invariant
fails.

------------------------------------------------------------------------

## ADR-020 --- Coincident sections are first-class topology

**Decision:** Coincident geometry is expected. A finite overlap is
represented by two intersection events and the coincident edge interval
between them.

**Reasoning:** Shadows, offsets, lettering, and other real graphics
routinely create shared boundaries. Treating them as degenerate
exceptions makes boolean operations fragile.

**Consequence:** Same-direction and opposite-direction overlaps are
explicitly understood through incoming/outgoing branch relationships. A
very short overlap may become topologically equivalent to a point
intersection under configured tolerance.

------------------------------------------------------------------------

## ADR-021 --- Area geometry is signed and directed

**Decision:** An Area contains closed immutable paths whose direction
carries signed meaning.

With screen/SVG coordinates (Y down): - CW contributes positive area; -
CCW contributes negative area; - area to the right of travel is
positive.

**Reasoning:** Direction provides a unified model for solids, holes, and
subtraction.

**Consequence:** A CW loop inside a CCW loop can represent a meaningful
negative annulus. It must not be discarded merely because the signed
geometry does not currently correspond to visible positive material.

------------------------------------------------------------------------

## ADR-022 --- Do not normalize away meaningful negative geometry

**Decision:** "Normalization" must preserve the signed geometric field,
not merely visible positive fill.

**Reasoning:** Removing negative-only regions can destroy information
required for later subtraction/intersection operations.

**Consequence:** Exact signed-Area normalization rules remain an
explicit design question. Future normalization must remove only
genuinely redundant/canceling representation while preserving meaningful
signed regions.

------------------------------------------------------------------------

## ADR-023 --- Boolean operations remain binary

**Decision:** The fundamental operation is `Area × Area -> Area`.
Multi-Area expressions are composed from binary operations with explicit
grouping.

**Reasoning:** Every individual intersection still belongs to two paths.
N-way intersection topology would add substantial complexity without a
demonstrated need.

**Consequence:** Union and intersection must satisfy commutativity and
associativity as semantic/test invariants. Subtraction retains explicit
grouping because it is not associative.

------------------------------------------------------------------------

## ADR-024 --- Area membership is separate from local edge classification

**Decision:** In a multi-loop Area operation, raw geometric edge state is
relative to the particular intersecting loop. Signed winding or membership
relative to the complete opposite Area is computed and represented
separately for Boolean selection.

**Reasoning:** The four-edge balance invariant describes local topology
between two loops and can be obscured if unrelated loops change Area-wide
membership around that intersection. Conversely, loop-relative state alone
cannot represent holes, islands, or disconnected signed components.

**Consequence:** Local intersection validation and Area-level Boolean
selection consume distinct state. Containment and signed-Area semantics
remain foundational dependencies of the final selection truth tables.

------------------------------------------------------------------------

## ADR-025 --- Validation precedes boolean walking

**Decision:** Intersection discovery, overlap interpretation, edge
construction, and classification must produce a validated topology
before the boolean walker runs.

**Reasoning:** A walker cannot reliably compensate for incorrect
topology. Attempting to do so hides the true source of geometry
failures.

**Consequence:** Validation failures should produce useful diagnostics
rather than corrupted output geometry.

------------------------------------------------------------------------

## ADR-026 --- Real application sweeps are part of correctness testing

**Decision:** The aircraft registration-number generator will be used as
a large integration/torture harness.

**Reasoning:** It naturally generates difficult combinations of straight
and curved fonts, slants, shadows, offsets, holes, and coincident
boundaries. Historical failures have generally been visually obvious.

**Consequence:** Sweep many common combinations, run hard topology
invariants automatically, render result sheets for visual review, and
turn every discovered failure into a permanent regression fixture.

------------------------------------------------------------------------

## ADR-027 --- Differences below configured tolerance are equivalent geometry

**Decision:** Correctness is judged relative to the configured
meaningful tolerance.

**Reasoning:** The target applications ultimately manufacture or display
geometry at finite resolution. Distinctions far below that resolution
are false precision.

**Consequence:** A subtle discrepancy below tolerance is not itself a
defect. Conversely, tolerance must not be used to excuse topology errors
above the intended accuracy.

------------------------------------------------------------------------

## ADR-028 --- Affine transforms are immutable first-class geometry

**Decision:** Represent a 2-D affine transform as an immutable six-scalar
value using the conventional SVG/Canvas mapping. Construction,
composition, inversion, and application are pure operations. Affine
transforms serve geometry construction and manufacturing as well as
display.

**Reasoning:** Slant, layout, reflection, coordinate conversion, and
manufacturing output all transform Bézier geometry. A shared precise
representation avoids duplicated matrix conventions and prevents mutation
of source geometry. The legacy nested-array utility mutates some inputs and
mixes matrix operations with attempts to infer source settings.

**Consequence:** Composition order is part of the tested contract. Points
and displacement vectors have distinct application methods. Bézier curves
are transformed exactly by transforming their control points.

------------------------------------------------------------------------

## ADR-029 --- Decomposition is canonical analysis, not recovered history

**Decision:** Do not expose general affine `getRotation` or `getScale`
methods that imply the original construction settings can be recovered.
Applications retain editable source parameters separately. A future affine
decomposition API will return a documented canonical factorization intended
for analysis and interpolation.

**Reasoning:** Multiple operation sequences, reflection choices, pivots,
and full rotations can produce the same affine matrix. Nevertheless, a
deterministic factorization is valuable for visually stable interpolation
between matrices.

**Consequence:** Matrix-only interpolation must define rotation-path,
reflection, singularity, and component-matching policies. Deliberate
multiple rotations and moving pivots require caller-supplied information
that is not present in the endpoint matrices.

------------------------------------------------------------------------

## ADR-030 --- Loop orientation derives effective walk state

**Decision:** Keep loop orientation separate from raw loop-relative edge
classification. With clockwise orientation `+1` and counter-clockwise
orientation `-1`, derive:

`effectiveWalkState = geometricState * orientationSign`

Do not rewrite stored `INNER` and `OUTER` states when a loop is reversed.

**Reasoning:** In overlapping-loop subtraction, the output can enter on an
outer edge of A and correctly leave on a geometrically inner edge of B
traversed in reverse. Multiplying by B's changed orientation sign supplies
the effective positive walk state without destroying the direction-neutral
local classification or its balance invariant.

**Consequence:** Coincident state remains zero under either orientation.
The effective state supports signed loop traversal but does not replace
complete opposite-Area winding or operation-specific Boolean selection.
