# Milestone 7 — Intersection Incidence Topology Design

## Purpose and boundary

Milestone 7 lifts topology-neutral geometric intersection results into reusable path-occurrence topology. It provides binary events, incidences ordered along source paths, lazy directed path edges, overlap relationships, and structural validation.

It does **not** implement:

- loop-relative `INNER / OUTER / COINCIDENT` classification;
- Area-wide membership or signed Boolean selection;
- a Boolean walker;
- offset retention policy;
- boundary reconstruction; or
- higher-valence vertex grouping.

Those are consumers or later layers over the incidence arrangement.

## 1. Binary event and geometric vertex are different identities

An `IntersectionEvent` represents one binary relationship and owns exactly two `IntersectionIncidence` values.

```text
IntersectionEvent
  point
  errorSquared
  incidences: [first, second]

IntersectionIncidence
  event
  path
  globalT
  previous / next along that path
```

For an ordinary path/path event, the incidence paths differ. For a self-intersection, both incidences reference the same path at different globalTs.

One event must never be merged with another merely because their canonical points are within coordinate tolerance. Several binary events may describe a higher-valence geometric vertex. Final vertex grouping remains unresolved, so event identity and incidence identity must survive unchanged.

Two binary events may also reference the same path at effectively the same globalT when one path meets several others at a shared vertex. The arrangement retains those incidences and reports the coincident path occurrence diagnostically. It does not silently create a higher-valence vertex or claim that the zero-length ordering between tied incidences is meaningful.

## 2. Event construction

An event seed supplies two path occurrences:

```ts
interface PathOccurrenceSeed {
  path: BezierPath;
  globalT: number;
}

interface IntersectionEventSeed {
  occurrences: readonly [PathOccurrenceSeed, PathOccurrenceSeed];
}
```

Construction canonicalizes each globalT using the owning path, evaluates both source paths, averages the evaluated points symmetrically, and retains their squared discrepancy. The source paths/globalTs remain authoritative; the canonical point does not alter either occurrence.

For a same-path event, the two canonical globalTs must differ beyond parameter tolerance. Segment adjacency and identity exclusions belong to path self-intersection discovery, not event storage, but a same-occurrence binary event is invalid topology.

This seed API deliberately does not contain `pathA/pathB` fields. Tuple position preserves the input relationship where required without making A/B intrinsic topology.

## 3. Immutable arrangement construction

`buildIntersectionArrangement(seeds, overlaps, tolerance)` creates an immutable snapshot. The builder phase may allocate and link nodes; completed events, incidences, overlap records, indexes, and arrays are externally read-only and frozen.

Like `BezierPath`, public immutable incidence nodes expose topology through read-only accessors backed by private construction state. Consumers cannot relink an arrangement.

The arrangement indexes incidences by source path for deterministic traversal and diagnostics:

```ts
incidencesForPath(arrangement, path): readonly IntersectionIncidence[]
```

Within each path, incidences are sorted by canonical globalT. Event insertion order is a deterministic secondary key only; it is not a geometric resolution of tied occurrences.

Open paths produce a linear incidence sequence (`first.previous === null`, `last.next === null`). Closed paths produce a ring. A closed path with one incidence links that incidence to itself, representing one complete outgoing/incoming cycle rather than an empty edge.

## 4. Lazy directed edges

An `IntersectionEdge` is derived from an incidence and its `next` incidence:

```ts
interface IntersectionEdge {
  from: IntersectionIncidence;
  to: IntersectionIncidence;
  path: BezierPath;
  fromGlobalT: number;
  toGlobalT: number;
}
```

The edge always follows the source path's forward traversal. It has no independently linked topology and stores no copied Bézier geometry.

```ts
outgoingIntersectionEdge(incidence): IntersectionEdge | null
materializeIntersectionEdge(edge): readonly CubicBezier[]
```

Materialization delegates to `extractPathInterval`. For a closed one-incidence ring, equal endpoint globalTs mean one explicit full cycle. For distinct tied incidences at the same path occurrence, materialization is empty and validation reports that the arrangement requires a future higher-valence interpretation.

Reversed edge use, when semantically justified by a future consumer, should be an explicit derived operation rather than mutation of arrangement topology.

## 5. Classification belongs to consumers

An incidence intrinsically knows only:

- its binary event;
- its path occurrence; and
- previous/next occurrence ordering along that path.

It does not intrinsically own `INNER`, `OUTER`, `COINCIDENT`, Area membership, Boolean retention, or offset retention.

A future arrangement interpretation may associate consumer-scoped outgoing-edge metadata with an incidence or edge. That interpretation must name its owning operation/other loop so state from one Boolean pair or offset cleanup cannot leak into another consumer.

The four-edge zero-sum rule is therefore not a base-arrangement validation. It becomes validation of a particular ordinary two-loop classification interpretation.

## 6. Overlap relationships

A finite overlap is two binary endpoint events plus an explicit relationship:

```ts
interface IntersectionOverlap {
  start: IntersectionEvent;
  end: IntersectionEvent;
  direction: "same" | "opposite" | "stationary";
}
```

`start` and `end` retain the geometric intersection API convention: they are ordered by increasing parameter on the first seed occurrence. This does not imply that their second occurrences increase; opposite-direction overlap naturally reverses that ordering.

The relationship identifies which two events bound one discovered coincident interval. It does not classify every outgoing edge as coincident and does not assume that the endpoint events are adjacent after other events on the source paths are included. Validation reports overlap endpoint/path inconsistencies. Consumer topology later decides how overlap relationships affect edge state.

`stationary` is retained because the geometric intersection layer can emit it. Its traversal interpretation remains diagnostic until a consumer establishes a usable directed correspondence.

## 7. Lifting geometric results

Helpers should lift existing `AnalyticIntersection` values for a known pair of path segments without changing the geometric result model:

```ts
eventSeedFromSegmentPoint(firstSegment, secondSegment, pairedPoint)
overlapSeedFromSegmentResult(firstSegment, secondSegment, overlap)
```

Local cubic parameters map to path globalT as `segment.index + localT`, followed by structural knot canonicalization and canonical path normalization. An occurrence is lifted to its exact start or end knot only when its local parameter is within parameter tolerance of that endpoint **and** its evaluated point is within intersection tolerance of the corresponding endpoint. Geometry proximity alone never rewrites an interior path occurrence. A point result yields one event seed. An overlap result yields two event seeds plus an overlap seed relating them.

The lifting helper does not discover all path/path intersections and does not deduplicate results from adjacent segment pairs. Whole-path orchestration and trivial self-adjacency exclusion are separate work within the milestone after the base arrangement is validated.

### Whole-path orchestration

`intersectPathsDetailed(first, second, tolerance)` examines every eligible segment pair, retains pair-level completeness diagnostics, and publishes an arrangement only when every included search completes. The convenience `intersectPaths` rejects incomplete results rather than returning partial topology.

For two different paths, event deduplication requires agreement within parameter tolerance for both canonical `(path, globalT)` occurrences in the same ordered binary path relationship. For self-intersection, segment pairs are considered once in structural order. A segment is excluded against itself and its immediate `prev`/`next`; closed-path first/last adjacency is therefore excluded naturally. Nonadjacent segments remain eligible even when they share a knot-like coordinate.

Before parameter-pair deduplication, segment endpoint occurrences are structurally canonicalized as described above. This collapses the same physical knot event discovered from adjacent segment pairs, including the closed seam, without merging unrelated binary events at the same XY location.

Canonical line cubics whose controls are scalar-exactly at the computed one-third/two-third chord positions use the analytic line dispatcher. This strict restriction preserves the cubic parameter as the line parameter. A control merely near its canonical third is not sufficient: coordinate proximity does not prove parameter equivalence. Collinear, near-canonical, or backtracking cubics must not be converted to endpoint line segments without an explicit parameter mapping. When only the other input is an exact canonical line, ordinary analytic line/cubic dispatch remains safe because it solves the original cubic parameter directly.

Adjacent overlap records share their canonical endpoint event when both path occurrences agree. Identical overlap records are deduplicated by endpoint event identity and direction; overlap relationships are never merged by XY proximity.

## 8. Structural validation

Validation returns a report rather than fabricating repairs. At minimum it checks:

- every event has exactly two incidences and reciprocal ownership;
- every incidence belongs to the arrangement and evaluates near the canonical event point;
- canonical globalTs are in the owning path domain;
- same-path event occurrences are distinct;
- path incidence order is monotone, with one seam only for closed rings;
- previous/next links are reciprocal;
- open paths do not wrap and closed paths do wrap;
- an edge's endpoints reference the same source path;
- overlap endpoints reference corresponding path pairs;
- overlap direction agrees with endpoint parameter progression when nonstationary;
- tied path occurrences are retained but reported as requiring higher-valence resolution; and
- all coordinates, parameters, and errors are finite.

The report distinguishes errors that make the arrangement unusable from notices about deliberately unresolved higher-valence interpretation. Boolean walking and offset regularization must require the validations relevant to their interpretation before proceeding.

## 9. Initial tests

The base implementation must cover:

1. two ordinary intersections ordered into independent rings on two closed paths;
2. open-path null endpoints;
3. a same-path self-intersection with two distinct globalTs in one event;
4. one closed-path incidence producing an explicit full-cycle lazy edge;
5. overlap endpoints in same and opposite directions;
6. event identity retained for multiple events at one canonical point;
7. tied occurrences on one path retained and diagnosed rather than merged;
8. seam ordering and edge materialization across closed globalT wrap;
9. reciprocal-link and event/incidence ownership invariants; and
10. rejection/reporting of a same-path same-globalT event.

## 10. Public API posture

Milestone 7 types and ordinary arrangement construction are legitimate advanced public geometry facilities. Internal mutable link installation and operation-specific interpretations are not public API.

Names should remain explicit (`IntersectionEvent`, `IntersectionIncidence`, `IntersectionArrangement`, `IntersectionEdge`) rather than reviving legacy path-A/path-B intersection rings. The root package may export the stable value/query surface while detailed construction diagnostics can remain in the intersection module until the API review confirms ergonomics.

## 11. Deferred questions preserved

This design intentionally does not decide:

- whether coincident binary events later group into `IntersectionVertex` values;
- how one shared path occurrence participates in several binary relationships without zero-length pseudo-edges;
- final self-intersection adjacency exclusions during whole-path discovery;
- raw edge classification storage for a particular arrangement interpretation;
- Area membership and Boolean truth tables; or
- offset-specific retention.

Preserving event, incidence, path, globalT, insertion, and overlap identity gives those later decisions the information they need without encoding a premature answer now.
