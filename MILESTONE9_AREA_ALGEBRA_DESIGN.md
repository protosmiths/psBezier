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

### Why the local walk rule is not the Area operator

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

The field algebra below supplies a candidate resolution.

## 3. Candidate signed winding-field algebra

For Areas `A` and `B`, define operations pointwise on their integer winding fields:

- negation: `W_negate(A) = -W_A`;
- addition: `W_add(A,B) = W_A + W_B`;
- union/join: `W_union(A,B) = max(W_A, W_B)`;
- intersection/meet: `W_intersection(A,B) = min(W_A, W_B)`;
- subtraction: `W_subtract(A,B) = W_A - W_B = W_add(A, negate(B))`;
- ordinary material projection: material exists where `W_A > 0`.

Subtraction is therefore signed addition with reversal. The Milestone 8 intersection-style exit
after reversing `B` is a local boundary-extraction consequence at crossings where `W_A-W_B`
transitions around zero. It is not the definition of subtraction at Area level.

### Algebraic properties

Integer `max` and `min` form a distributive lattice:

- both are commutative, associative, and idempotent;
- `max` distributes over `min`;
- `min` distributes over `max`.

Negation is an involution and exchanges the lattice operations:

- `-max(A,B) = min(-A,-B)`;
- `-min(A,B) = max(-A,-B)`.

Addition is commutative and associative, has zero as its identity, and is translation-compatible
with the lattice:

- `C + max(A,B) = max(C+A, C+B)`;
- `C + min(A,B) = min(C+A, C+B)`.

Subtraction is derived from addition and negation and remains order-sensitive.

Once negative fields are admitted, zero is not the bottom or top of the `min`/`max` lattice.
Therefore an empty zero field is not a universal identity for signed union or signed intersection:

- `max(-1, 0) = 0`;
- `min(-1, 0) = -1`.

This is coherent field algebra, but public API names must make clear whether an operation acts on
the full signed field or on its positive-material projection.

### Representation consequence: multiplicity is real

An Area's loops form an ordered-independent collection with multiplicity, not a mathematical set
that erases duplicate contributions. Two coincident same-direction `+1` loops may represent a
field jump of `+2`.

The eventual internal representation may use repeated loop terms or a simple loop plus a nonzero
integer coefficient. Either representation must preserve the same winding field. Reversal negates
the coefficient/contribution. Coincident opposite contributions cancel only under additive field
composition or a lossless normalization that proves their total coefficient is zero.

In particular:

- `add(A,A)` has winding 2 wherever `A` has winding 1;
- `union(A,A)` equals `A` because `max(1,1)=1`;
- `intersection(A,A)` equals `A` because `min(1,1)=1`.

### Truth-table experiments

Each row lists field values in the geometrically distinct regions. `P` means the later ordinary
material projection `W > 0`.

#### Disjoint positive loops

| Region | A | B | add | union/max | intersection/min | subtract A-B | P(A-B) |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | --- |
| inside A | 1 | 0 | 1 | 1 | 0 | 1 | material |
| inside B | 0 | 1 | 1 | 1 | 0 | -1 | empty |
| outside | 0 | 0 | 0 | 0 | 0 | 0 | empty |

The internal subtraction result deliberately retains positive A and negative B. Projection removes
the disjoint negative contribution from ordinary visible `A-B`.

#### Overlapping positive loops

| Region | A | B | add | union/max | intersection/min | subtract A-B | P(A-B) |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | --- |
| A only | 1 | 0 | 1 | 1 | 0 | 1 | material |
| A and B | 1 | 1 | 2 | 1 | 1 | 0 | empty |
| B only | 0 | 1 | 1 | 1 | 0 | -1 | empty |
| outside | 0 | 0 | 0 | 0 | 0 | 0 | empty |

#### Positive B contained inside positive A

| Region | A | B | add | union/max | intersection/min | subtract A-B | P(A-B) |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | --- |
| A outside B | 1 | 0 | 1 | 1 | 0 | 1 | material |
| inside B | 1 | 1 | 2 | 1 | 1 | 0 | empty/hole |
| outside A | 0 | 0 | 0 | 0 | 0 | 0 | empty |

The subtraction boundary of B is a hole in the positive projection without requiring a stored
`hole` flag.

#### Positive outer loop plus negative inner loop

Let `H` be geometrically inside `A`, and let `-H` be its reversed contribution.

| Region | A | -H | add(A,-H) | P(add) |
| --- | ---: | ---: | ---: | --- |
| A outside H | 1 | 0 | 1 | material |
| inside H | 1 | -1 | 0 | empty/hole |
| outside A | 0 | 0 | 0 | empty |

#### Negative-only loop and zero

| Region | -A | 0 | union/max | intersection/min | P(-A) |
| --- | ---: | ---: | ---: | ---: | --- |
| inside A | -1 | 0 | 0 | -1 | empty |
| outside A | 0 | 0 | 0 | 0 | empty |

This demonstrates both why negative-only geometry must remain available internally and why signed
`union`/`intersection` should not be described as ordinary set operations without qualification.

#### Coincident opposite contributions

| Region | A | -A | add | union/max | intersection/min | subtract A-A |
| --- | ---: | ---: | ---: | ---: | ---: | ---: |
| inside boundary | 1 | -1 | 0 | 1 | -1 | 0 |
| outside | 0 | 0 | 0 | 0 | 0 | 0 |

Opposite loops cancel under addition, not under lattice union/intersection.

#### Magnitude-two field

| Region | A | A | add(A,A) | union(A,A) | intersection(A,A) |
| --- | ---: | ---: | ---: | ---: | ---: |
| inside A | 1 | 1 | 2 | 1 | 1 |
| outside | 0 | 0 | 0 | 0 | 0 |

Magnitude is semantic under the proposed Area definition. Internal normalization may replace two
coincident contributions with coefficient 2, but may not collapse them to one.

### Next design checks

Before implementation, resolve:

1. public naming that distinguishes signed-field `max`/`min` from operations on projected positive
   material;
2. whether `Area` stores repeated loop terms or canonical integer boundary coefficients;
3. how a boundary constructor derives loop coefficients for `max`, `min`, and addition without
   evaluating the entire plane;
4. how the Milestone 8 simple-loop transition planner is parameterized by field levels rather than
   assuming only `0/1` inputs;
5. when positive-material projection is allowed and whether its result is a distinct type.

No multi-loop reduction code should precede these decisions.
