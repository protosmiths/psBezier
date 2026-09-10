# Milestone 6 — Cubic/Cubic Implementation Design

This note turns the semantic contract in `MILESTONE6_INTERSECTION_DISCOVERY.md`
into a concrete implementation plan. It does not define path, Area, or boolean
semantics.

## 1. Preserve source intervals

Every search node contains two exact Bézier subcurves and their original-source
intervals `[tA0,tA1]` and `[tB0,tB1]`. Children are produced with de Casteljau
subdivision at local `0.5`; source intervals split at their midpoint. Discovery
results always report source parameters.

## 2. Bounding boxes prune; they do not prove coincidence

Tight cubic bounds are used to reject pairs whose coordinate-axis separation is
greater than `tolerance.discovery`. Overlapping or nearby bounds only mean that a
local interaction remains possible.

A leaf is not called coincident merely because both curve boxes are small. A
small box proves localization of a possible interaction, not mutual closeness of
the two source portions over an interval.

## 3. Adaptive paired subdivision

For every surviving node, split only the geometrically larger member. Ties are
resolved deterministically in favor of A. This produces a binary, alternating
partition of paired parameter space. When both axes require refinement, two
successive one-axis splits generate the same four parameter rectangles that a
simultaneous split would have generated, but disjoint children can be pruned after
the first split rather than first creating all four combinations. It also avoids a
single node immediately quadrupling the work.

This permits different parameter speeds without forcing equal parameter widths or
identical subdivision depths. After the larger side is split, the other side will
naturally be selected when it has the larger remaining geometric extent. `depth`
counts individual one-axis splits, so a balanced refinement of both axes consumes
two depth levels rather than one quadtree level.

Stop subdividing a branch when either:

- both subcurve bounding-box diagonals are within discovery tolerance and their
  bounds still pass the proximity test, so the pair can become a discovery cell;
  or
- both parameter widths have reached `tolerance.parameter`, in which case it
  becomes a resolution-limited diagnostic cell.

A finite depth/leaf budget is a safety guard, not a geometric classification
rule. Exhaustion is reported explicitly rather than silently converted to an
intersection.

## 4. Discovery cells and diagnostics

Each retained cell records:

- both original parameter intervals;
- both exact subcurves and bounds;
- representative paired parameters and evaluated points;
- point discrepancy;
- termination reason and subdivision depth.

The public intersection result remains topology-neutral. A diagnostic discovery
API may expose immutable cells/components so tests and visualizers can inspect why
a result was produced.

## 5. Candidate graph

Cells are graph-adjacent only when their closed parameter intervals touch or
overlap on both curves within parameter tolerance. Graph construction also
rejects links whose local geometric enclosures are incompatible.

Connected components are interpreted after sorting by increasing `tA`.
Correspondence on B may be nondecreasing, nonincreasing, or unresolved. Equal
parameter step sizes are never required. A component that would require both B
directions is split at the direction change unless stationary evidence supports
the transition.

A certified spine must also obey that inferred direction link by link. Progress
along A may pair only with nondecreasing B for same-direction correspondence or
nonincreasing B for opposite-direction correspondence, except where the involved
parameter intervals overlap within tolerance.

Geometric cells that share a point but represent different parameter occurrences
remain distinct. Graph connectivity must not collapse event identity into vertex
identity.

## 6. Mutual-closeness validation

The difference-curve test certifies a proposed local correspondence; it does not
discover that correspondence. The candidate graph and continued subdivision must
first establish sufficiently small paired portions and their direction. Do not
linearly pair two broad source intervals and treat a failed certificate as evidence
that no overlap exists: their true correspondence may advance nonlinearly or at
unequal parameter speeds.

For each sufficiently localized paired portion, transform both subcurves to the
same directed local parameter interval (reversing B for opposite correspondence),
then bound their difference Bézier.

The four control vectors of the difference cubic form a convex hull containing
the complete pointwise difference curve. If every control-vector squared length
is at most `tolerance.discovery²`, the portions are conservatively certified as
mutually close. Failure to certify is not proof of separation: subdivide the
paired portions and retry until certified or resolution-limited.

This test is sufficient rather than necessary. Failure means subdivide the proposed
pairing and try again until it is certified or resolution-limited; it does not mean
the curves are separated. The test may classify a borderline region conservatively
as points/ambiguous, but it cannot certify an overlap whose paired pointwise
displacement exceeds the tolerance.

## 7. Component classification

- **Point:** refinement drives the component to one paired occurrence. Unresolved
  direction alone does not establish this; an unresolved discovery component with
  more than one cell-scale of span remains ambiguous until refinement.
- **Overlap:** the component has a stable monotone correspondence, nontrivial
  parameter span on both curves, and certified mutual closeness.
- **Ambiguous:** resolution is insufficient to choose point versus overlap, but
  the retained local alternatives remain within discovery tolerance.

“Nontrivial span” is scale-aware: it is judged by geometric extent as well as
parameter width. A large parameter interval on a nearly stationary curve is not
automatically an overlap.

Ambiguity is an internal discovery and diagnostic state, not a third public
intersection geometry. Public results use a deterministic conservative policy:
emit the refined point representation unless a persistent interval has a monotone,
certified overlap correspondence. Diagnostics retain that the source component was
ambiguous, allowing the alternate tolerance-equivalent interpretation to be tested
later without asking topology consumers to walk an unresolved object.

## 8. Refinement

Point candidates restart from their saved rectangle. Use safeguarded Newton
iteration on `A(tA)-B(tB)=0`; when the Jacobian is ill-conditioned, fall back to
subdivision refinement within the saved rectangle. Accept only a paired point whose
discrepancy is within `tolerance.intersection`.

Overlap candidates refine their two boundary correspondences from the terminal
cells of the component. Interior certification is repeated at discovery tolerance;
the endpoints are localized at intersection tolerance without requiring the whole
interior to satisfy the tighter point-intersection tolerance.

The retained certified overlap set is a connected corridor, not necessarily a
unique ordered path. Boundaries come from its minimum/maximum A frontiers with B
selected according to correspondence direction. Disconnected certified fragments
outside that set cannot extend the result.

At each frontier, first accept an exact shared endpoint if its paired discrepancy
satisfies intersection tolerance. Otherwise, when an adjacent noncertified region
brackets the frontier, bisect the localized paired correspondence to the
discovery-tolerance contour. This is an epsilon-transition boundary, not a root of
`A(tA)-B(tB)=0`. Curve-domain and unbracketed internal boundaries remain distinct
diagnostic outcomes.

Duplicate point results are merged only when both A and B parameters agree within
parameter tolerance. Coordinate proximity alone never merges distinct
occurrences.

## 9. Required test families

- transverse crossing, endpoint contact, tangency, and disjoint curves;
- exact same- and opposite-direction coincidence;
- coincidence under unequal cubic parameterization;
- partial overlap with refined endpoints;
- multiple intersections between one cubic pair;
- shallow-angle families that transition stably between point, ambiguous, and
  short-overlap representations;
- perturbations around discovery tolerance;
- distinct parameter occurrences at the same geometric point;
- deterministic diagnostics and explicit budget exhaustion;
- legacy `~3ε` spacing fixtures as comparison evidence, not acceptance law.

Walker-level equivalence of alternate ambiguous representations remains a later
topology test.
