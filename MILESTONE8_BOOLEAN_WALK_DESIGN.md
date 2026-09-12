# Milestone 8 — Binary loop Boolean walk

## Scope

Milestone 8 first defines the Boolean walk for exactly two simple closed loops whose complete
pairwise intersection arrangement and loop-relative edge classifications have passed Milestone 7
validation.

The walker supports two fundamental selections: union and intersection. Difference is not a third
local walk algorithm. `A - B` is expressed through the signed-Area algebra by reversing the
contribution of `B` and applying intersection semantics. Exact multi-loop Area reduction and
normalization remain a separate design step.

This milestone does not yet implement multi-loop Area algebra, zero-intersection containment
policy, self-intersection decomposition, semantic regularization, or offsets.

## Input invariant: Boolean boundary loops are simple

`BezierPath` remains a general geometry type. It may be open, closed, or self-intersecting.

A loop admitted as an `Area` boundary for the binary Boolean walker must instead be closed,
immutable, nondegenerate at the active tolerance, and simple. It must also have a complete and
valid pairwise interpretation for the other loop.

The walker rejects an input that does not establish these preconditions. It does not silently
repair a self-intersecting boundary while walking two loops.

## Self-intersection decomposition is topology-neutral

Self-intersections remain supported by the shared intersection/incidence infrastructure because
general paths and offset intermediates require them. A future decomposition operation may split a
self-intersecting path at its incidences and discover the simple cycles in the resulting graph.

That operation must not decide what the cycles mean. In particular, it must not automatically
discard an inner cycle or automatically call it a hole. Semantic selection belongs to the
consumer:

- an Area conversion interprets cycles under an explicit fill rule, likely nonzero winding;
- offset regularization interprets cycles using the source Area, signed offset distance, and
  dilation/erosion semantics;
- a future stroke-expansion consumer may apply another retention policy.

The reusable layering is:

`self-intersection discovery -> incidence graph -> simple-cycle decomposition -> consumer policy`

The same decomposed topology may legitimately produce different retained boundaries for a general
filled path and for a raw offset path.

## The walk consumes validated transitions

Milestone 7 supplies each incidence-split outgoing edge with a raw state relative to the other
loop: `OUTER = +1`, `COINCIDENT = 0`, or `INNER = -1`.

Loop orientation remains separate. The signed value available to traversal policy is:

`effectiveWalkState = geometricState * orientationSign`

For a positively validated ordinary transverse event, the noncoincident outgoing branches must
provide one unique positive exit and one unique negative exit:

- union follows the positive (`+1`) exit;
- intersection follows the negative (`-1`) exit.

This is the numerical form of Steve's union-exit/intersection-exit rule. The walker does not
recompute containment or infer topology at the event.

The uniqueness rule does not automatically cover contacts, overlap frontiers, unresolved events,
or higher-valence vertices. Those event classes require explicit transition validation before
walking. An unresolved transition blocks the operation rather than inviting a guess.

## Contacts and tangencies

A contact at which the selected boundary remains on the same source loop does not require a path
switch. It must not manufacture an output branch merely because two geometric events share a
point.

Because a validated contact retains the same raw state on both sides of each participating loop,
selection also remains constant across that incidence. A selected incoming edge therefore
continues through the contact to the outgoing edge on the same source loop. There is no loop
switch.

This handles external touching solids naturally: union may retain both loops as two cycles touching
at one geometric point, while intersection may retain neither because their common set has no
Area. The shared coordinate does not merge their distinct directed-exit identities.

If the event is not positively characterized as a contact, or either same-path continuation is not
selected consistently, the transition is unresolved and blocks walking.

## Coincident intervals

Coincident edges cannot be selected solely from the value zero. Treat each nonstationary overlap as
a corridor between two frontier events. First select the ordinary noncoincident result edges at
both frontiers from the operation's positive/negative effective-state rule. Then ask whether those
selected edges leave an incoming/outgoing degree deficit that only traversal of the overlap
corridor can satisfy.

Each source traversal of the overlap is a candidate directed corridor. A same-direction overlap
provides two geometrically equivalent candidates in the same direction. An opposite-direction
overlap provides candidates in opposite directions. A candidate comprises every incidence-split
edge tiled through that source interval, including splits introduced by unrelated events.

Choose overlap traversal by graph constraints:

1. preserve every already-selected noncoincident transition at both frontiers;
2. give every result-bearing frontier exactly one incoming and one outgoing transition;
3. retain no coincident corridor when the selected noncoincident edges already balance;
4. when one geometrically equivalent source copy is required, retain exactly one deterministic
   owner;
5. reject the interpretation if zero candidates or multiple geometrically different candidates
   satisfy the constraints.

This derives coincidence from the boundary that must be connected rather than assigning an
operation meaning to `COINCIDENT = 0`.

Consequences include:

- adjacent positive solids sharing an opposite-direction edge need no coincident corridor for
  union; the common edge is internal;
- their Area intersection has no two-dimensional boundary and also retains no corridor;
- identical same-direction boundaries require one owned copy for both union and intersection;
- a partial overlap is retained only when it is the unique connection between selected
  noncoincident branches at its two frontiers.

When two candidates are geometrically equivalent and have the required direction, ownership is a
representation tie-break. Initially prefer the scoped first loop. Swapping inputs may change source
provenance but must not change output geometry, traversal orientation, or cycle count.

Full-loop coincidence has no noncoincident frontier ports. It must be diagnosed separately as a
zero-transition case: same directed material retains one deterministic copy; oppositely directed
signed contributions require the later Area algebra to decide cancellation. It must not be forced
through the partial-corridor rule.

## Directed transition graph

The binary walk operates on result-bearing directed exits, not merely on geometric event points.
The identity of a directed exit is its owning incidence in the operation interpretation; geometric
coordinate is never its visited key.
For each approved operation:

1. transition policy maps a validated incoming result edge at an event to exactly one outgoing
   result edge;
2. the outgoing edge identifies its source path and directed interval to the next incidence;
3. traversal follows that interval and applies the transition at the destination event;
4. a cycle closes only when the starting directed exit is reached again;
5. every consumed directed exit is marked exactly once.

Encountering an already-consumed exit is valid only when it closes the current cycle at its exact
starting exit. Any other revisit diagnoses an invalid transition graph.

## Multiple result loops

Completing one cycle does not complete the Boolean operation. The walker repeatedly selects an
unvisited result-bearing directed exit until every applicable exit has been consumed. Thus two
input loops may naturally produce zero, one, or several output loops.

Required completeness invariant:

> Every result-bearing directed exit is consumed exactly once by exactly one closed output cycle.

## Geometry materialization

A walked edge already identifies its source `BezierPath`, `fromGlobalT`, `toGlobalT`, and
direction/full-cycle semantics.

`extractPathInterval()` is the modern equivalent of the useful concept in legacy
`PolyBezier.split(globalT1, globalT2)`. The boundary assembler appends those exact extracted cubics
to a builder. It does not introduce a second splitting algorithm or fabricate connectors to hide a
discontinuous transition.

Materialization resolves every graph-edge identity back to the exact owning incidence, verifies
each consecutive join and final closure against coordinate tolerance, and returns one immutable
closed `BezierPath` per graph cycle. A missing incidence, missing source interval, discontinuous
join, or discontinuous closure is diagnostic failure. Materialization never revises selection,
changes corridor ownership, snaps endpoints, or inserts connector geometry.

## Zero-intersection loop pairs

An event-to-event walker has nothing to traverse when two loops have no intersections. Disjoint
loops, containment, identical loops, and signed holes require Area/containment policy. They are not
walker failures, but must be resolved before the public binary Area operation is complete.

## Separation from multi-loop Area algebra

The later Area layer must preserve signed loop meaning, reduce multi-loop expressions using the
approved associative/distributive formulation, preserve disconnected components and holes,
distinguish internal minimization from output normalization, and handle containment pairs.

The pairwise walker must not anticipate that algebra by classifying an edge against an entire
opposite Area.

## Design gate before implementation

The proposed transition model is now:

- transverse: select by effective sign and require a unique exit;
- contact: continue on the same selected source loop;
- partial overlap: add at most one directed coincident corridor only when required to balance the
  selected frontier transitions;
- unresolved/higher-valence: block;
- visited identity: owning incidence, never XY point.

Before coding, validate this model with explicit graph fixtures for same/opposite partial overlaps,
identical loops, adjacent touching solids, overlap corridors split by a third event, input swap, and
subtraction-by-reversal. Full-loop coincidence and zero-intersection cases remain explicit inputs to
the later Area policy rather than ordinary event walks.

Self-intersection cycle decomposition and consumer-specific regularization remain separate future
designs and do not block a two-simple-loop noncoincident transition prototype.
