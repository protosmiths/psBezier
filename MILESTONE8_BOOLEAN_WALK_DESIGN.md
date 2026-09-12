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

The transition layer establishes whether the selected incoming interval continues uniquely to the
selected outgoing interval. If no boundary-changing transition is needed, traversal continues on
the owning path. If the local topology is unresolved, the Boolean operation is incomplete.

## Coincident intervals

Coincident edges cannot be selected solely from the value zero. Their policy must also consume
same- versus opposite-direction overlap correspondence, loop orientations and Area roles, the
requested operation, and deterministic ownership so one geometric boundary is not emitted twice.

Before implementation, a complete coincidence transition table must be approved for:

- same-direction identical boundaries;
- opposite-direction boundaries that cancel;
- partial same-direction overlap;
- partial opposite-direction overlap;
- overlap frontiers adjacent to `INNER`/`OUTER` edges;
- subtraction expressed by reversing the subtracting contribution.

Coincident ownership is representation policy, not geometric truth. Choosing one source copy must
be deterministic and input-swap invariant at the resulting geometric level.

## Directed transition graph

The binary walk operates on result-bearing directed exits, not merely on geometric event points.
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

The noncoincident transverse transition rule is resolved. Complete walker implementation waits for
approval of:

1. the coincidence transition/ownership table;
2. contact continuation rules expressed against actual incidence topology;
3. result-bearing directed-exit and visited-identity representation;
4. failure diagnostics for incomplete or invalid transitions.

Self-intersection cycle decomposition and consumer-specific regularization remain separate future
designs and do not block a two-simple-loop noncoincident transition prototype.
