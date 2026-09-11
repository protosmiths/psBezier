import type { CubicBezier } from "../bezier/index.js";
import type { Point, ToleranceContext } from "../numeric/index.js";
import { distanceSquared, point } from "../numeric/index.js";
import type { BezierPath, PathBezier } from "../path/index.js";
import { evaluatePath, extractPathInterval, normalizeGlobalT } from "../path/index.js";
import type { OverlapIntersection, PairedIntersectionPoint } from "./intersection-types.js";

export interface PathOccurrenceSeed {
  readonly path: BezierPath;
  readonly globalT: number;
}

export interface IntersectionEventSeed {
  readonly occurrences: readonly [PathOccurrenceSeed, PathOccurrenceSeed];
}

export interface IntersectionOverlapSeed {
  readonly start: IntersectionEventSeed;
  readonly end: IntersectionEventSeed;
  readonly direction: OverlapIntersection["direction"];
}

export interface IntersectionEvent {
  readonly point: Point;
  readonly errorSquared: number;
  readonly incidences: readonly [IntersectionIncidence, IntersectionIncidence];
}

export interface IntersectionIncidence {
  readonly event: IntersectionEvent;
  readonly path: BezierPath;
  readonly globalT: number;
  readonly previous: IntersectionIncidence | null;
  readonly next: IntersectionIncidence | null;
  readonly arrangement: IntersectionArrangement;
}

export interface IntersectionOverlap {
  readonly start: IntersectionEvent;
  readonly end: IntersectionEvent;
  readonly direction: OverlapIntersection["direction"];
}

export interface IntersectionArrangement {
  readonly events: readonly IntersectionEvent[];
  readonly incidences: readonly IntersectionIncidence[];
  readonly overlaps: readonly IntersectionOverlap[];
  readonly paths: readonly BezierPath[];
}

interface EventTopology {
  readonly incidences: readonly [IntersectionIncidence, IntersectionIncidence];
}

interface IncidenceTopology {
  readonly arrangement: IntersectionArrangement;
  readonly previous: IntersectionIncidence | null;
  readonly next: IntersectionIncidence | null;
}

const eventTopology = new WeakMap<IntersectionEvent, EventTopology>();
const incidenceTopology = new WeakMap<IntersectionIncidence, IncidenceTopology>();
const arrangementPathIndex = new WeakMap<
  IntersectionArrangement,
  ReadonlyMap<BezierPath, readonly IntersectionIncidence[]>
>();

function topologyForEvent(event: IntersectionEvent): EventTopology {
  const result = eventTopology.get(event);
  if (result === undefined) throw new Error("intersection event topology is not initialized");
  return result;
}

function topologyForIncidence(incidence: IntersectionIncidence): IncidenceTopology {
  const result = incidenceTopology.get(incidence);
  if (result === undefined) throw new Error("intersection incidence topology is not initialized");
  return result;
}

class ImmutableIntersectionEvent implements IntersectionEvent {
  readonly point: Point;
  readonly errorSquared: number;

  constructor(firstPoint: Point, secondPoint: Point) {
    this.point = point((firstPoint.x + secondPoint.x) / 2, (firstPoint.y + secondPoint.y) / 2);
    this.errorSquared = distanceSquared(firstPoint, secondPoint);
  }

  get incidences(): readonly [IntersectionIncidence, IntersectionIncidence] {
    return topologyForEvent(this).incidences;
  }
}

class ImmutableIntersectionIncidence implements IntersectionIncidence {
  readonly event: IntersectionEvent;
  readonly path: BezierPath;
  readonly globalT: number;
  readonly insertionIndex: number;

  constructor(event: IntersectionEvent, path: BezierPath, globalT: number, insertionIndex: number) {
    this.event = event;
    this.path = path;
    this.globalT = globalT;
    this.insertionIndex = insertionIndex;
  }

  get previous(): IntersectionIncidence | null {
    return topologyForIncidence(this).previous;
  }

  get next(): IntersectionIncidence | null {
    return topologyForIncidence(this).next;
  }

  get arrangement(): IntersectionArrangement {
    return topologyForIncidence(this).arrangement;
  }
}

class ImmutableIntersectionArrangement implements IntersectionArrangement {
  readonly events: readonly IntersectionEvent[];
  readonly incidences: readonly IntersectionIncidence[];
  readonly overlaps: readonly IntersectionOverlap[];
  readonly paths: readonly BezierPath[];

  constructor(
    events: readonly IntersectionEvent[],
    incidences: readonly IntersectionIncidence[],
    overlaps: readonly IntersectionOverlap[],
    paths: readonly BezierPath[],
  ) {
    this.events = Object.freeze([...events]);
    this.incidences = Object.freeze([...incidences]);
    this.overlaps = Object.freeze([...overlaps]);
    this.paths = Object.freeze([...paths]);
  }
}

export function pathOccurrenceSeed(path: BezierPath, globalT: number): PathOccurrenceSeed {
  return Object.freeze({ path, globalT: normalizeGlobalT(path, globalT) });
}

export function intersectionEventSeed(
  first: PathOccurrenceSeed,
  second: PathOccurrenceSeed,
): IntersectionEventSeed {
  const occurrences: readonly [PathOccurrenceSeed, PathOccurrenceSeed] = Object.freeze([
    first,
    second,
  ]);
  return Object.freeze({ occurrences });
}

export function intersectionOverlapSeed(
  start: IntersectionEventSeed,
  end: IntersectionEventSeed,
  direction: OverlapIntersection["direction"],
): IntersectionOverlapSeed {
  return Object.freeze({ start, end, direction });
}

export interface SegmentOverlapSeedBundle {
  readonly events: readonly [IntersectionEventSeed, IntersectionEventSeed];
  readonly overlap: IntersectionOverlapSeed;
}

function segmentGlobalT(
  segment: PathBezier,
  occurrence: PairedIntersectionPoint["occurrences"][number],
  tolerance: ToleranceContext,
): number {
  const localT = occurrence.parameter;
  if (!Number.isFinite(localT) || localT < 0 || localT > 1) {
    throw new RangeError("local intersection parameter must be in [0, 1]");
  }
  const endpointToleranceSquared = tolerance.intersection * tolerance.intersection;
  const canonicalLocalT =
    distanceSquared(occurrence.point, segment.start) <= endpointToleranceSquared
      ? 0
      : distanceSquared(occurrence.point, segment.end) <= endpointToleranceSquared
        ? 1
        : localT;
  return normalizeGlobalT(segment.path, segment.index + canonicalLocalT);
}

export function eventSeedFromSegmentPoint(
  first: PathBezier,
  second: PathBezier,
  paired: PairedIntersectionPoint,
  tolerance: ToleranceContext,
): IntersectionEventSeed {
  return intersectionEventSeed(
    pathOccurrenceSeed(first.path, segmentGlobalT(first, paired.occurrences[0], tolerance)),
    pathOccurrenceSeed(second.path, segmentGlobalT(second, paired.occurrences[1], tolerance)),
  );
}

export function overlapSeedFromSegmentResult(
  first: PathBezier,
  second: PathBezier,
  overlap: OverlapIntersection,
  tolerance: ToleranceContext,
): SegmentOverlapSeedBundle {
  const start = eventSeedFromSegmentPoint(first, second, overlap.start, tolerance);
  const end = eventSeedFromSegmentPoint(first, second, overlap.end, tolerance);
  const events: readonly [IntersectionEventSeed, IntersectionEventSeed] = Object.freeze([
    start,
    end,
  ]);
  return Object.freeze({
    events,
    overlap: intersectionOverlapSeed(start, end, overlap.direction),
  });
}

export function buildIntersectionArrangement(
  seeds: readonly IntersectionEventSeed[],
  overlapSeeds: readonly IntersectionOverlapSeed[] = [],
): IntersectionArrangement {
  const events: IntersectionEvent[] = [];
  const incidences: ImmutableIntersectionIncidence[] = [];
  const eventBySeed = new Map<IntersectionEventSeed, IntersectionEvent>();
  const pathGroups = new Map<BezierPath, ImmutableIntersectionIncidence[]>();

  for (const seed of seeds) {
    if (eventBySeed.has(seed)) throw new Error("an event seed may appear only once");
    const firstSeed = seed.occurrences[0];
    const secondSeed = seed.occurrences[1];
    const firstGlobalT = normalizeGlobalT(firstSeed.path, firstSeed.globalT);
    const secondGlobalT = normalizeGlobalT(secondSeed.path, secondSeed.globalT);
    const event = new ImmutableIntersectionEvent(
      evaluatePath(firstSeed.path, firstGlobalT),
      evaluatePath(secondSeed.path, secondGlobalT),
    );
    const first = new ImmutableIntersectionIncidence(
      event,
      firstSeed.path,
      firstGlobalT,
      incidences.length,
    );
    const second = new ImmutableIntersectionIncidence(
      event,
      secondSeed.path,
      secondGlobalT,
      incidences.length + 1,
    );
    const pair: readonly [IntersectionIncidence, IntersectionIncidence] = Object.freeze([
      first,
      second,
    ]);
    eventTopology.set(event, Object.freeze({ incidences: pair }));
    events.push(event);
    incidences.push(first, second);
    eventBySeed.set(seed, event);
    for (const incidence of [first, second]) {
      const group = pathGroups.get(incidence.path) ?? [];
      group.push(incidence);
      pathGroups.set(incidence.path, group);
    }
  }

  const overlaps = overlapSeeds.map((seed): IntersectionOverlap => {
    const start = eventBySeed.get(seed.start);
    const end = eventBySeed.get(seed.end);
    if (start === undefined || end === undefined) {
      throw new Error("overlap endpoints must reference event seeds in the arrangement");
    }
    return Object.freeze({ start, end, direction: seed.direction });
  });
  const arrangement = new ImmutableIntersectionArrangement(events, incidences, overlaps, [
    ...pathGroups.keys(),
  ]);
  const readonlyPathIndex = new Map<BezierPath, readonly IntersectionIncidence[]>();

  for (const [path, group] of pathGroups) {
    group.sort(
      (left, right) => left.globalT - right.globalT || left.insertionIndex - right.insertionIndex,
    );
    readonlyPathIndex.set(path, Object.freeze([...group]));
    for (let index = 0; index < group.length; index += 1) {
      const incidence = group[index]!;
      const previous =
        index > 0 ? group[index - 1]! : path.isClosed ? (group.at(-1) ?? null) : null;
      const next =
        index + 1 < group.length ? group[index + 1]! : path.isClosed ? (group[0] ?? null) : null;
      incidenceTopology.set(incidence, Object.freeze({ arrangement, previous, next }));
    }
  }
  arrangementPathIndex.set(arrangement, readonlyPathIndex);

  for (const incidence of incidences) Object.freeze(incidence);
  for (const event of events) Object.freeze(event);
  Object.freeze(arrangement);
  return arrangement;
}

export function incidencesForPath(
  arrangement: IntersectionArrangement,
  path: BezierPath,
): readonly IntersectionIncidence[] {
  return arrangementPathIndex.get(arrangement)?.get(path) ?? Object.freeze([]);
}

export interface IntersectionEdge {
  readonly from: IntersectionIncidence;
  readonly to: IntersectionIncidence;
  readonly path: BezierPath;
  readonly fromGlobalT: number;
  readonly toGlobalT: number;
  readonly fullCycle: boolean;
}

export function outgoingIntersectionEdge(
  incidence: IntersectionIncidence,
): IntersectionEdge | null {
  const next = incidence.next;
  if (next === null) return null;
  if (next.path !== incidence.path) throw new Error("incidence link crosses source paths");
  return Object.freeze({
    from: incidence,
    to: next,
    path: incidence.path,
    fromGlobalT: incidence.globalT,
    toGlobalT: next.globalT,
    fullCycle: incidence === next && incidence.path.isClosed,
  });
}

export function materializeIntersectionEdge(edge: IntersectionEdge): readonly CubicBezier[] {
  return extractPathInterval(edge.path, edge.fromGlobalT, edge.toGlobalT, {
    fullCycle: edge.fullCycle,
  });
}

export type IntersectionTopologyIssueSeverity = "error" | "notice";
export type IntersectionTopologyIssueCode =
  | "event-discrepancy"
  | "same-path-same-occurrence"
  | "tied-path-occurrences"
  | "broken-incidence-link"
  | "overlap-path-mismatch"
  | "overlap-direction-mismatch";

export interface IntersectionTopologyIssue {
  readonly severity: IntersectionTopologyIssueSeverity;
  readonly code: IntersectionTopologyIssueCode;
  readonly message: string;
}

export interface IntersectionTopologyValidation {
  readonly valid: boolean;
  readonly issues: readonly IntersectionTopologyIssue[];
}

function issue(
  severity: IntersectionTopologyIssueSeverity,
  code: IntersectionTopologyIssueCode,
  message: string,
): IntersectionTopologyIssue {
  return Object.freeze({ severity, code, message });
}

function incidencesOnPath(event: IntersectionEvent, path: BezierPath): IntersectionIncidence[] {
  return event.incidences.filter((incidence) => incidence.path === path);
}

export function validateIntersectionArrangement(
  arrangement: IntersectionArrangement,
  tolerance: ToleranceContext,
): IntersectionTopologyValidation {
  const issues: IntersectionTopologyIssue[] = [];
  const maximumDiscrepancy = tolerance.discovery * tolerance.discovery;

  for (const event of arrangement.events) {
    if (event.errorSquared > maximumDiscrepancy) {
      issues.push(
        issue("error", "event-discrepancy", "event occurrences exceed discovery tolerance"),
      );
    }
    const [first, second] = event.incidences;
    if (
      first.path === second.path &&
      Math.abs(first.globalT - second.globalT) <= tolerance.parameter
    ) {
      issues.push(
        issue(
          "error",
          "same-path-same-occurrence",
          "a self-intersection event must contain two distinct path occurrences",
        ),
      );
    }
  }

  for (const path of arrangement.paths) {
    const incidences = incidencesForPath(arrangement, path);
    for (let index = 0; index < incidences.length; index += 1) {
      const incidence = incidences[index]!;
      const expectedPrevious =
        index > 0 ? incidences[index - 1]! : path.isClosed ? (incidences.at(-1) ?? null) : null;
      const expectedNext =
        index + 1 < incidences.length
          ? incidences[index + 1]!
          : path.isClosed
            ? (incidences[0] ?? null)
            : null;
      if (incidence.previous !== expectedPrevious || incidence.next !== expectedNext) {
        issues.push(
          issue("error", "broken-incidence-link", "path incidence links are not reciprocal"),
        );
      }
      const following = incidences[index + 1];
      if (
        following !== undefined &&
        Math.abs(incidence.globalT - following.globalT) <= tolerance.parameter
      ) {
        issues.push(
          issue(
            "notice",
            "tied-path-occurrences",
            "multiple binary incidences share one path occurrence and require vertex interpretation",
          ),
        );
      }
    }
  }

  for (const overlap of arrangement.overlaps) {
    const [startFirst, startSecond] = overlap.start.incidences;
    const firstMatches = incidencesOnPath(overlap.end, startFirst.path);
    const secondMatches = incidencesOnPath(overlap.end, startSecond.path);
    const endFirst = firstMatches[0] ?? null;
    const endSecond =
      startFirst.path === startSecond.path
        ? (secondMatches[1] ?? null)
        : (secondMatches[0] ?? null);
    if (endFirst === null || endSecond === null) {
      issues.push(
        issue(
          "error",
          "overlap-path-mismatch",
          "overlap endpoints do not reference matching paths",
        ),
      );
      continue;
    }
    const firstDelta = endFirst.globalT - startFirst.globalT;
    const secondDelta = endSecond.globalT - startSecond.globalT;
    if (
      overlap.direction !== "stationary" &&
      Math.abs(firstDelta) > tolerance.parameter &&
      Math.abs(secondDelta) > tolerance.parameter &&
      ((overlap.direction === "same" && firstDelta * secondDelta < 0) ||
        (overlap.direction === "opposite" && firstDelta * secondDelta > 0))
    ) {
      issues.push(
        issue(
          "error",
          "overlap-direction-mismatch",
          "overlap direction disagrees with endpoint parameter progression",
        ),
      );
    }
  }

  return Object.freeze({
    valid: !issues.some((value) => value.severity === "error"),
    issues: Object.freeze(issues),
  });
}
