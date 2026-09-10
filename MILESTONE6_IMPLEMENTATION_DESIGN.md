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

For every surviving node, split the geometrically larger member. If their sizes
are comparable, split both and test the four child pairs. This permits different
parameter speeds without forcing equal parameter widths or identical subdivision
depths.

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

Geometric cells that share a point but represent different parameter occurrences
remain distinct. Graph connectivity must not collapse event identity into vertex
identity.

## 6. Mutual-closeness validation

An overlap candidate needs a monotone pairing through its cells. For each paired
portion, transform both subcurves to the same directed local parameter interval
(reversing B for opposite correspondence), then bound their difference Bézier.

The four control vectors of the difference cubic form a convex hull containing
the complete pointwise difference curve. If every control-vector squared length
is at most `tolerance.discovery²`, the portions are conservatively certified as
mutually close. Failure to certify is not proof of separation: subdivide the
paired portions and retry until certified or resolution-limited.

This test is sufficient rather than necessary. It may classify a borderline
region conservatively as points/ambiguous, but it cannot certify an overlap whose
paired pointwise displacement exceeds the tolerance.

## 7. Component classification

- **Point:** refinement drives the component to one paired occurrence.
- **Overlap:** the component has a stable monotone correspondence, nontrivial
  parameter span on both curves, and certified mutual closeness.
- **Ambiguous:** resolution is insufficient to choose point versus overlap, but
  the retained local alternatives remain within discovery tolerance.

“Nontrivial span” is scale-aware: it is judged by geometric extent as well as
parameter width. A large parameter interval on a nearly stationary curve is not
automatically an overlap.

## 8. Refinement

Point candidates restart from their saved rectangle. Use safeguarded Newton
iteration on `A(tA)-B(tB)=0`; when the Jacobian is ill-conditioned, fall back to
subdivision/bisection within the saved rectangle. Accept only a paired point whose
discrepancy is within `tolerance.intersection`.

Overlap candidates refine their two boundary correspondences from the terminal
cells of the component. Interior certification is repeated at discovery tolerance;
the endpoints are localized at intersection tolerance without requiring the whole
interior to satisfy the tighter point-intersection tolerance.

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
