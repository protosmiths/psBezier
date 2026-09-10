# Milestone 6 — Cubic/Cubic Intersection Discovery Contract

This document resolves the principal open design question for Milestone 6: how the coarse cubic/cubic discovery pass distinguishes isolated point candidates from tolerance-level coincident intervals.

It supplements `DESIGN.md`. Where this document is more specific about Milestone 6 overlap discovery, this document is authoritative until the material is consolidated into the main design specification.

## 1. Core semantic decision

Overlap is **tolerance-induced geometry**, not necessarily an exact algebraic claim that two source cubics share the same locus over a mathematically exact interval.

The discovery engine may represent two curve portions as coincident when, over a finite interval, that substitution remains within the configured geometric tolerance and preserves the relevant local connectivity.

This is intentional. A sufficiently shallow crossing may transition from a point-intersection representation to a short coincident-section representation as the curves become indistinguishable at the configured resolution. Either representation is acceptable when the resulting geometry and connectivity are equivalent within tolerance.

The algorithm must not pursue false precision below the application's meaningful geometric resolution.

## 2. Discovery happens in paired parameter space

A cubic/cubic subdivision search simultaneously narrows two source-curve parameter intervals:

`A: [tA0, tA1]`

`B: [tB0, tB1]`

Conceptually, every surviving discovery cell occupies a rectangle in the two-dimensional parameter domain `(tA, tB)` and carries the corresponding geometric subcurves/bounds.

The discovery pass must preserve these original-source parameter intervals so that refinement can restart locally rather than searching `[0,1] × [0,1]` again.

## 3. Candidate cells form a graph

Surviving discovery cells are not interpreted merely as an unordered list of approximate intersection points.

Treat them as nodes in a candidate graph. Two cells may be connected only when their parameter intervals touch or overlap consistently on **both** source curves and their geometric relationship remains compatible with the same local interaction.

Parameter adjacency is the primary continuity evidence.

Euclidean spacing between representative points, including the historical heuristic of grouping hits within approximately `3 * epsilon`, is useful as a regression reference and secondary sanity check, but it is not the definition of overlap continuity.

The implementation must not depend on all leaf cells having equal size or on representative points occupying identical relative positions within their geometric bounds.

## 4. Continuous monotone correspondence, not equal parameter speed

An overlap candidate is supported by a persistent connected chain in `(tA, tB)` space that spans meaningful intervals on both curves and establishes a continuous monotone correspondence between them.

Do **not** require equal parameter increments or a nearly straight 45-degree diagonal in parameter space. Two equivalent or near-coincident geometric portions can traverse their parameterizations at very different speeds, and recursive subdivision cells may have unequal parameter widths.

What matters is that progression along one curve corresponds continuously and monotonically to progression along the other.

The sign of that correlated progression determines correspondence direction:

- increasing `tA` with increasing `tB` -> same-direction correspondence;
- increasing `tA` with decreasing `tB` -> opposite-direction correspondence.

Local stationary/degenerate cases may require separate treatment and must not be forced into a direction classification that the data do not support.

## 5. Geometric proximity validates the parameter-space chain

Parameter-space connectivity alone is insufficient. A candidate chain must also be geometrically valid as a tolerance-level coincidence substitution.

Corresponding subcurves along the candidate interval must remain mutually close enough that replacing their local distinction with a coincident representation does not displace geometry beyond the configured discovery/overlap tolerance.

The exact numerical bound/verification method is an implementation detail to be designed and tested, but it should exploit Bézier subdivision bounds/convex-hull properties where useful rather than relying only on one sampled point per cell.

Geometric distance therefore **validates** a connected parameter-space relationship; it does not by itself define adjacency between candidate cells.

## 6. Three discovery outcomes

A connected candidate component may resolve to one of three semantic outcomes.

### 6.1 Point candidate

The component collapses toward a single parameter pair as subdivision/refinement proceeds. Both parameter spans shrink toward zero at the relevant resolution.

### 6.2 Overlap candidate

The component retains a meaningful span on both source curves and supports continuous monotone correspondence while satisfying the geometric coincidence criterion.

The discovery result records an unrefined candidate interval and its same/opposite direction correspondence. Final endpoint localization belongs to the tighter refinement pass.

### 6.3 Ambiguous local component

The component lies near the tolerance boundary such that a short overlap representation and a point/closely-spaced-point representation are both defensible.

A unique label is not required merely for mathematical neatness. Either representation is acceptable if:

- the geometric substitution remains within configured tolerance;
- incidence correspondence is continuous and consistent;
- local connectivity is equivalent;
- no spurious branch or loop is created.

The implementation may choose a stable deterministic representation for reproducibility, but that choice is not elevated into an assertion of exact source-curve topology.

## 7. Two-pass relationship

### Pass 1 — discovery

Use the wider discovery/overlap tolerance to prune disjoint regions, retain candidate cells, build/interpret connected candidate components, and classify them as point, overlap, or ambiguous local components.

Do not spend final intersection precision throughout the entire search tree.

### Pass 2 — refinement

Restart from the saved source parameter intervals with the tighter intersection/refinement tolerance.

For a point candidate, refine the paired parameter location.

For an overlap candidate, principally refine the two interval endpoints and verify that the interior correspondence remains valid.

For an ambiguous component, refinement may preserve either topologically equivalent local representation; it must not introduce instability or geometry beyond tolerance merely to force a particular label.

## 8. Shallow-angle crossing is a required boundary test

Two curves approaching at a very low angle, crossing, and separating at a similarly low angle are the canonical tolerance-boundary case.

At a sufficiently fine geometric resolution they may be represented as one point intersection. At a coarser configured tolerance the algorithm may legitimately "snap" them together over a short interval and "snap" them apart later, yielding a short coincident section.

The exact transition between these representations is not a sacred threshold.

Required properties across a family of decreasing crossing angles and insignificant numerical perturbations are:

- no spurious loop or branch;
- no reversed or mismatched incidence correspondence;
- no discontinuous overlap pairing;
- no displacement beyond tolerance;
- stable behavior under insignificant perturbations;
- equivalent large-scale connectivity.

The later topology/walker milestones must add metamorphic tests showing that acceptable alternate local representations produce equivalent walked output within tolerance.

## 9. Historical spacing heuristic

The legacy implementation inferred overlap by observing sequences of approximate intersections whose physical spacing was within a multiplier of the intersection tolerance, historically around `3 * epsilon`.

That behavior is useful empirical evidence and should be preserved as a regression/reference fixture.

The new design should not choose an arbitrary smaller multiplier such as `1.1 * epsilon` as the architectural definition. Representative-point spacing depends on leaf-box shape, termination depth, curve direction, and representative-point convention. Parameter-space connectivity plus geometric validation is more fundamental.

A physical-spacing threshold may still be useful as a secondary diagnostic, candidate-link rejection test, or compatibility experiment if tests demonstrate value.

## 10. Acceptance philosophy

Milestone 6 is not required to distinguish every sub-tolerance point-versus-overlap ambiguity uniquely.

The ultimate correctness criterion is:

> Preserve the correct geometry within configured tolerance and preserve the connectivity required by downstream topology.

A local representation difference is acceptable when it has no meaningful effect on the resulting boundary. A representation is not acceptable when it changes connectivity, creates/removes a meaningful branch or loop, mismatches incidences, or displaces geometry beyond tolerance.

Milestone 6 can test the local prerequisites now: endpoint correspondence, monotone direction, continuity, geometric error, deterministic/stable classification, and preserved fixtures. Full walked-output equivalence tests belong to the later topology/boolean layers.