# Milestone 9 — Area algebra

This document begins the Area-level design review. It deliberately defines meaning before choosing
a multi-loop reduction algorithm.

## 1. Area representation and normalization invariant

### Proposed mathematical representation

An `Area` is an immutable finite collection of simple, closed, oriented `BezierPath` loops. The
collection defines an integer-valued signed winding field over points not on its boundaries:

`W_A(P) = sum(contribution(loop, P))`

where a loop contributes:

- `+1` when `P` is inside a clockwise loop;
- `-1` when `P` is inside a counter-clockwise loop;
- `0` when `P` is outside the loop.

This is not merely a union of independently filled paths. Loop ordering has no semantic meaning,
but orientation, nesting, and multiplicity do.

Examples:

- one clockwise loop produces field `+1` in its interior;
- a counter-clockwise loop nested inside it reduces the field to `0` in the hole;
- a clockwise loop nested inside that hole restores field `+1` on an island;
- a counter-clockwise loop outside all positive loops produces field `-1`, which is meaningful
  signed geometry even if an output/rendering policy currently shows only positive material.

The winding field is the preserved mathematical value. “Visible material,” manufacturing output,
or a public fill view is a separate interpretation of that field. This document does not yet choose
whether every consumer uses `W != 0`, `W > 0`, clamping, or another projection.

### Construction invariant

Every stored boundary loop must be:

- immutable;
- closed;
- simple at the Area's tolerance context;
- nondegenerate;
- explicitly oriented.

General `BezierPath` remains free to self-intersect. A self-intersecting path must be decomposed and
interpreted under an explicit consumer policy before its cycles become Area loops.

### Two distinct normalizations

Internal normalization is lossless with respect to the complete signed winding field. It may:

- remove exact duplicate loops with opposite contributions when their fields cancel;
- combine or replace boundaries only when the same `W_A(P)` is preserved everywhere away from the
  tolerance boundary;
- impose deterministic loop ordering and canonical representation without changing meaning.

Internal normalization must not remove a negative-only loop merely because it presently produces
no visible positive material. It may be required by a later operation.

Output normalization is consumer-specific. It may project the signed field into visible or
manufacturable material and then minimize the boundaries of that projection. Such output is not
necessarily algebraically equivalent to the internal Area and must not silently replace it during
an intermediate expression.

Therefore APIs and types must distinguish, at least conceptually:

- signed internal Area;
- projected/output material Area or boundary set.

### Equality

Two Areas are semantically equal at a tolerance when their signed winding fields agree everywhere
outside the tolerance neighborhoods of their boundaries. Equality is not array equality, loop-count
equality, or equality of nesting trees.

This supplies the correct target for commutativity/associativity tests even when two valid
representations use different loop decompositions.

## 2. Two simple loops with no boundary intersections

### Geometric relationship discovery

For two simple closed loops with complete intersection discovery and no point or overlap events,
choose proven non-boundary samples from each loop and classify them with `pointLoopRelation()`.

The only resolved geometric relationships are:

- `disjoint`: A is outside B and B is outside A;
- `A-inside-B`: a sample of A is inside B and a sample of B is outside A;
- `B-inside-A`: the reverse;
- `unresolved`: a required distance/containment query is incomplete, boundary-valued, or
  contradictory.

For simple loops without boundary intersections, mutual inside results are impossible unless the
boundaries are coincident/equivalent. Coincident full boundaries should normally have been reported
as overlap topology. If they reach this path without such topology, return unresolved rather than
guessing identity from samples.

Tangential contact is not a zero-intersection case: it has an event and belongs to the Milestone 8
contact transition policy.

### Positive-loop truth table

The following table is complete for two clockwise (`+1`) simple loops interpreted as ordinary
positive solids:

| Relationship | Union result | Intersection result |
| --- | --- | --- |
| disjoint | retain A and B | empty |
| A-inside-B | retain B | retain A |
| B-inside-A | retain A | retain B |
| full same-direction coincidence | retain one deterministic copy | retain one deterministic copy |
| unresolved | incomplete; no geometry | incomplete; no geometry |

These are Area-level decisions; an event walker is neither needed nor invoked.

### Geometry table before signed interpretation

Containment discovery itself is orientation-independent. For any orientations it returns only the
geometric relationship:

| A sample relative to B | B sample relative to A | Relationship |
| --- | --- | --- |
| outside | outside | disjoint |
| inside | outside | A-inside-B |
| outside | inside | B-inside-A |
| inside | inside | invalid/unresolved without established full coincidence |
| boundary or unresolved | any | unresolved |
| any | boundary or unresolved | unresolved |

Orientation and operation semantics are applied only after this relationship is established.

### Signed-loop cases are not yet a Boolean truth table

A negative loop is a contribution to a signed Area field, not automatically an independently filled
set. Consequently, applying ordinary set union/intersection independently to two oriented loops
would lose the distinction between a hole, an exterior negative region, and a subtracting
contribution.

The local Milestone 8 selection rule remains valid at intersections:

- union selects effective state `+1`;
- intersection selects effective state `-1`;
- reversing a loop changes effective state without mutating raw geometry.

It does not by itself determine every zero-intersection signed case. In particular, if `A` is a
positive loop and reversed `B` is a disjoint negative loop, blindly applying the local
intersection-exit sign rule would retain the negative loop rather than the ordinary set-difference
result `A`. The Area layer must therefore define the surrounding signed operation and its
zero-intersection identity explicitly; the event-walk rule cannot be extrapolated into that case.

Before approving signed zero-intersection behavior, define an Area-level binary operator on winding
fields (or an equivalent exact boundary rule) that proves:

- why subtraction-by-reversal produces ordinary `A - B` for disjoint, contained, and overlapping
  inputs;
- how negative-only intermediate regions remain available for later expressions;
- the identity and absorbing elements of union and intersection;
- commutativity, associativity, and distributivity for the operators actually implemented;
- when opposite coincident contributions cancel;
- when output projection may discard negative field without changing internal algebra.

This is the next design gate. No signed multi-loop reducer should be implemented until those rules
are explicit and pass the positive-loop table above as a special case.
