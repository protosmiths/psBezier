# Milestone 7 — Consumer-scoped edge classification design

## Purpose and boundary

The immutable `IntersectionArrangement` is reusable geometric topology. It must not acquire
Boolean, Area, or offset state. A separate immutable interpretation associates raw outgoing-edge
classifications with one named consumer and one ordered pair of closed loops.

This slice defines storage, overlap constraints, and validation. It does **not** yet compute
`INNER` or `OUTER`: doing that robustly requires an explicitly designed loop-side/containment
classifier. It also does not select Boolean result edges or walk a result boundary.

## 1. Raw state and scope

Raw loop-relative state is:

```ts
type GeometricEdgeState = -1 | 0 | 1;

const INNER = -1;
const COINCIDENT = 0;
const OUTER = 1;
```

An interpretation names all context that gives those values meaning:

```ts
interface LoopPairClassificationScope {
  kind: "loop-pair";
  consumer: string;
  first: BezierPath;
  second: BezierPath;
}

interface OutgoingEdgeClassification {
  incidence: IntersectionIncidence;
  relativeTo: BezierPath;
  state: GeometricEdgeState;
}
```

`consumer` identifies the policy that produced the interpretation, for example a future Area
Boolean classifier. It is diagnostic provenance, not a Boolean operation or truth table.

For an ordinary two-loop interpretation, an incidence on `first` is classified only relative to
`second`, and vice versa. The classification belongs to the outgoing edge identified by the
incidence. Incoming state at an event is obtained from that incidence's previous incidence on the
same path. State is never installed on the incidence or arrangement itself.

The initial interpretation supports two distinct closed paths. Same-path self-intersection
classification and higher-valence/tied-occurrence interpretation remain separate problems.

## 2. Orientation remains derived and separate

Loop orientation is not stored in raw classifications. Given an independently established
orientation sign:

```ts
type OrientationSign = -1 | 1;

effectiveWalkState(state, orientationSign) = state * orientationSign
```

Reversing a loop changes its orientation and incidence traversal. It does not mutate the raw
classification. `COINCIDENT` remains zero under either orientation.

The orientation sign will eventually be derived from signed path area in the library's screen
coordinate convention. Accepting it as an explicit argument before that facility exists keeps
this layer testable without pretending orientation has already been established.

## 3. Finite overlaps impose edge constraints

An `IntersectionOverlap` is geometric evidence that a directed interval on each participating
path is coincident at the configured tolerance. It does not directly own edge state.

The interpretation expands each nonstationary overlap into constraints over the arrangement's
already-split outgoing edges:

- On the first occurrence path, traverse from the overlap's `start` incidence to its `end`
  incidence in increasing source-path direction.
- For `same`, traverse the second occurrence path from its start incidence to its end incidence.
- For `opposite`, traverse the second occurrence path from its end incidence to its start
  incidence.
- Every complete arrangement edge tiled by either directed interval must be classified
  `COINCIDENT` relative to the other participating loop.

This must use path occurrence identity, not event coordinates or array order. Other events may lie
inside an overlap and split its interval into several lazy edges; every such edge remains subject
to the coincident constraint. Multiple overlap records may impose the same constraint and are
idempotent.

An overlap relationship does not classify branches outside its interval. At each overlap endpoint,
the noncoincident incoming/outgoing branches still require ordinary local classification.

`stationary` overlap direction does not establish a traversable paired interval and therefore does
not impose outgoing-edge coincidence. It remains diagnostic until a consumer resolves its local
correspondence.

If an overlap frontier is tolerance-induced rather than an exact shared point, the constraint is
still valid: `COINCIDENT` means indistinguishable under the discovery tolerance, not algebraically
identical geometry.

## 4. Local balance validation

At an ordinary event between the scope's two distinct loops, the four raw states are:

```text
first incoming  = state(previous first incidence)
first outgoing  = state(first incidence)
second incoming = state(previous second incidence)
second outgoing = state(second incidence)
```

When all four edges exist and are classified, validation requires:

```text
firstIn + firstOut + secondIn + secondOut == 0
```

The invariant is checked on raw loop-relative state, before orientation or Area semantics. At an
overlap endpoint the coincident edge contributes zero; the two noncoincident branches must still
balance.

Balance validation is not applicable when an event is outside the selected loop pair, has tied
occurrences requiring higher-valence interpretation, lacks an incoming/outgoing edge on an open
path, or has missing classifications. Such a case is reported explicitly; it is never treated as
a valid zero sum by omission.

## 5. Interpretation validation

Construction/validation reports rather than repairs:

- scope paths must be distinct, closed, and present in the arrangement;
- each classification incidence must belong to that arrangement and to one scope path;
- `relativeTo` must be the other scope path;
- the incidence must have an outgoing edge;
- one scope may contain at most one state for an `(incidence, relativeTo)` identity;
- every edge of both loops participating in the interpretation must be classified before the
  interpretation is complete;
- overlap-imposed edges must be `COINCIDENT`;
- `stationary` overlaps are reported unresolved;
- every applicable ordinary binary event must satisfy the four-edge zero-sum invariant; and
- tied/higher-valence occurrences are reported unsupported rather than silently linearized.

An incomplete or invalid classification interpretation cannot be consumed by a Boolean walker.

## 6. Classification computation comes next

The classifier that supplies noncoincident states must determine the local side of one directed
edge relative to the **other loop**, not relative to an entire Area. It will need robust handling
for ordinary crossings, tangencies, endpoints, and samples near coincident intervals.

That algorithm should be approved separately. In particular, it must not use a midpoint-only test
that can miss another crossing or assume an overlap certificate proves anything outside its
directed interval.

Area-wide signed membership, holes, disconnected loops, operation retention, and walking remain
higher layers:

```text
intersection arrangement
  -> loop-pair raw classification
  -> orientation-derived effective state
  -> Area Boolean retention
  -> boundary walk/reconstruction
```

## 7. Initial implementation tests

The storage/validation slice should cover:

1. immutable classifications without mutation of the arrangement;
2. incoming state derived from the previous incidence;
3. valid and invalid ordinary zero-sum events;
4. same-direction overlap constraining both forward intervals;
5. opposite-direction overlap constraining the reversed second interval;
6. an intervening event splitting one overlap into multiple coincident edges;
7. conflict between an overlap constraint and a supplied `INNER`/`OUTER` state;
8. stationary overlap reported unresolved;
9. missing state reported incomplete; and
10. rejection of cross-arrangement, wrong-relative-loop, open-loop, self-loop, and tied-occurrence
    interpretations.
