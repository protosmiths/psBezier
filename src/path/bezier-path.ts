import type { CubicBezier } from "../bezier/index.js";
import { cubicBezier, evaluateCubic, reverseCubic, subcurve } from "../bezier/index.js";
import type { Point } from "../numeric/index.js";
import { point } from "../numeric/index.js";

export interface PathBezier {
  readonly index: number;
  readonly start: Point;
  readonly control1: Point;
  readonly control2: Point;
  readonly end: Point;
  readonly prev: PathBezier | null;
  readonly next: PathBezier | null;
  readonly path: BezierPath;
}

export interface BezierPath {
  readonly segments: readonly PathBezier[];
  readonly segmentCount: number;
  /** A point means open; null means the final segment wraps to the first. */
  readonly terminalPoint: Point | null;
  readonly isClosed: boolean;
  readonly first: PathBezier;
  readonly last: PathBezier;
}

interface SegmentSnapshot {
  readonly start: Point;
  readonly control1: Point;
  readonly control2: Point;
}

interface NodeTopology {
  readonly path: BezierPath;
  readonly prev: PathBezier | null;
  readonly next: PathBezier | null;
}

const topology = new WeakMap<PathBezier, NodeTopology>();

function nodeTopology(node: PathBezier): NodeTopology {
  const result = topology.get(node);
  if (result === undefined) throw new Error("PathBezier topology is not initialized");
  return result;
}

class ImmutablePathBezier implements PathBezier {
  readonly index: number;
  readonly start: Point;
  readonly control1: Point;
  readonly control2: Point;

  constructor(index: number, segment: SegmentSnapshot) {
    this.index = index;
    this.start = point(segment.start.x, segment.start.y);
    this.control1 = point(segment.control1.x, segment.control1.y);
    this.control2 = point(segment.control2.x, segment.control2.y);
  }

  get path(): BezierPath {
    return nodeTopology(this).path;
  }

  get prev(): PathBezier | null {
    return nodeTopology(this).prev;
  }

  get next(): PathBezier | null {
    return nodeTopology(this).next;
  }

  get end(): Point {
    const next = this.next;
    if (next !== null) return next.start;
    const terminal = this.path.terminalPoint;
    if (terminal === null) throw new Error("closed path node is missing its next link");
    return terminal;
  }
}

class ImmutableBezierPath implements BezierPath {
  readonly segments: readonly PathBezier[];
  readonly terminalPoint: Point | null;

  constructor(segmentSnapshots: readonly SegmentSnapshot[], terminalPoint: Point | null) {
    if (segmentSnapshots.length === 0)
      throw new RangeError("BezierPath requires at least one segment");
    this.terminalPoint = terminalPoint === null ? null : point(terminalPoint.x, terminalPoint.y);

    const nodes = segmentSnapshots.map(
      (segment, index): PathBezier => new ImmutablePathBezier(index, segment),
    );
    this.segments = Object.freeze(nodes);

    for (let index = 0; index < nodes.length; index += 1) {
      const node = nodes[index];
      if (node === undefined) throw new Error("path index construction failed");
      const previous =
        index > 0 ? (nodes[index - 1] ?? null) : this.isClosed ? (nodes.at(-1) ?? null) : null;
      const next =
        index + 1 < nodes.length
          ? (nodes[index + 1] ?? null)
          : this.isClosed
            ? (nodes[0] ?? null)
            : null;
      topology.set(node, Object.freeze({ path: this, prev: previous, next }));
    }

    for (const node of nodes) Object.freeze(node);
    Object.freeze(this);
  }

  get segmentCount(): number {
    return this.segments.length;
  }

  get isClosed(): boolean {
    return this.terminalPoint === null;
  }

  get first(): PathBezier {
    const result = this.segments[0];
    if (result === undefined) throw new Error("BezierPath has no first segment");
    return result;
  }

  get last(): PathBezier {
    const result = this.segments.at(-1);
    if (result === undefined) throw new Error("BezierPath has no last segment");
    return result;
  }
}

export function pathBezierAsCubic(segment: PathBezier): CubicBezier {
  return cubicBezier(segment.start, segment.control1, segment.control2, segment.end);
}

export interface GlobalTLocation {
  readonly globalT: number;
  readonly segment: PathBezier;
  readonly localT: number;
}

function requireFiniteGlobalT(globalT: number): void {
  if (!Number.isFinite(globalT)) throw new RangeError("globalT must be finite");
}

export function normalizeGlobalT(path: BezierPath, globalT: number): number {
  requireFiniteGlobalT(globalT);
  const count = path.segmentCount;
  if (!path.isClosed) {
    if (globalT < 0 || globalT > count) {
      throw new RangeError(`open-path globalT must be in [0, ${count}]`);
    }
    return globalT;
  }

  const wrapped = ((globalT % count) + count) % count;
  return Object.is(wrapped, -0) ? 0 : wrapped;
}

export function locateGlobalT(path: BezierPath, globalT: number): GlobalTLocation {
  const normalized = normalizeGlobalT(path, globalT);
  if (!path.isClosed && normalized === path.segmentCount) {
    return Object.freeze({ globalT: normalized, segment: path.last, localT: 1 });
  }
  const index = Math.floor(normalized);
  const segment = path.segments[index];
  if (segment === undefined) throw new Error("normalized globalT has no segment");
  return Object.freeze({ globalT: normalized, segment, localT: normalized - index });
}

export function evaluatePath(path: BezierPath, globalT: number): Point {
  const location = locateGlobalT(path, globalT);
  if (!path.isClosed && location.globalT === path.segmentCount) {
    const terminal = path.terminalPoint;
    if (terminal === null) throw new Error("open path is missing its terminal point");
    return terminal;
  }
  return evaluateCubic(pathBezierAsCubic(location.segment), location.localT);
}

export type TraversalDirection = "forward" | "reverse";

export interface PathIntervalOptions {
  readonly direction?: TraversalDirection;
  /** For a closed path with equal endpoints, select one complete traversal instead of none. */
  readonly fullCycle?: boolean;
}

function unwrappedIntervalEndpoints(
  path: BezierPath,
  fromGlobalT: number,
  toGlobalT: number,
  options: PathIntervalOptions,
): readonly [number, number] {
  const direction = options.direction ?? "forward";
  const fullCycle = options.fullCycle ?? false;
  const count = path.segmentCount;
  const from = normalizeGlobalT(path, fromGlobalT);
  let to = normalizeGlobalT(path, toGlobalT);

  if (!path.isClosed) {
    if (fullCycle) throw new RangeError("fullCycle is valid only for a closed path");
    if (direction === "forward" ? to < from : to > from) {
      throw new RangeError(`${direction} interval on an open path has contradictory endpoints`);
    }
  } else if (direction === "forward") {
    if (to < from || (to === from && fullCycle)) to += count;
  } else if (to > from || (to === from && fullCycle)) {
    to -= count;
  }

  return Object.freeze([from, to]);
}

/** Map a traversal fraction to the canonical globalT on a directed path interval. */
export function pathIntervalGlobalTAtFraction(
  path: BezierPath,
  fromGlobalT: number,
  toGlobalT: number,
  fraction: number,
  options: PathIntervalOptions = {},
): number {
  if (!Number.isFinite(fraction) || fraction < 0 || fraction > 1) {
    throw new RangeError("path interval fraction must be in [0, 1]");
  }
  const [from, to] = unwrappedIntervalEndpoints(path, fromGlobalT, toGlobalT, options);
  return normalizeGlobalT(path, from + (to - from) * fraction);
}

/** Evaluate a point on a directed path interval without materializing its cubic pieces. */
export function evaluatePathIntervalAtFraction(
  path: BezierPath,
  fromGlobalT: number,
  toGlobalT: number,
  fraction: number,
  options: PathIntervalOptions = {},
): Point {
  return evaluatePath(
    path,
    pathIntervalGlobalTAtFraction(path, fromGlobalT, toGlobalT, fraction, options),
  );
}

function extractForward(
  path: BezierPath,
  startGlobalT: number,
  endGlobalT: number,
  fullCycle: boolean,
): readonly CubicBezier[] {
  const count = path.segmentCount;
  let start = normalizeGlobalT(path, startGlobalT);
  let end = normalizeGlobalT(path, endGlobalT);

  if (!path.isClosed) {
    if (fullCycle) throw new RangeError("fullCycle is valid only for a closed path");
    if (end < start) throw new RangeError("forward interval on an open path requires end >= start");
  } else {
    if (end < start || (end === start && fullCycle)) end += count;
  }

  if (start === end) return Object.freeze([]);

  const result: CubicBezier[] = [];
  while (start < end) {
    const cyclePosition = start % count;
    const index = Math.floor(cyclePosition);
    const segment = path.segments[index];
    if (segment === undefined) throw new Error("interval traversal has no segment");
    const localStart = cyclePosition - index;
    const nextBoundary = start + (1 - localStart);
    const pieceEnd = Math.min(end, nextBoundary);
    const localEnd = localStart + (pieceEnd - start);
    result.push(subcurve(pathBezierAsCubic(segment), localStart, localEnd));
    start = pieceEnd;
  }
  return Object.freeze(result);
}

/** Extract a directed path interval without exposing segment-boundary bookkeeping. */
export function extractPathInterval(
  path: BezierPath,
  fromGlobalT: number,
  toGlobalT: number,
  options: PathIntervalOptions = {},
): readonly CubicBezier[] {
  const direction = options.direction ?? "forward";
  const fullCycle = options.fullCycle ?? false;
  if (direction === "forward") {
    return extractForward(path, fromGlobalT, toGlobalT, fullCycle);
  }

  const forward = extractForward(path, toGlobalT, fromGlobalT, fullCycle);
  return Object.freeze([...forward].reverse().map(reverseCubic));
}

interface SegmentDraft {
  start: Point;
  control1: Point;
  control2: Point;
}

function draft(start: Point, control1: Point, control2: Point): SegmentDraft {
  return {
    start: point(start.x, start.y),
    control1: point(control1.x, control1.y),
    control2: point(control2.x, control2.y),
  };
}

export class BezierPathBuilder {
  readonly #segments: SegmentDraft[] = [];
  #terminalPoint: Point | null;

  constructor(initialPoint: Point) {
    this.#terminalPoint = point(initialPoint.x, initialPoint.y);
  }

  static from(path: BezierPath): BezierPathBuilder {
    const builder = new BezierPathBuilder(path.first.start);
    builder.#segments.push(
      ...path.segments.map((segment) => draft(segment.start, segment.control1, segment.control2)),
    );
    builder.#terminalPoint =
      path.terminalPoint === null ? null : point(path.terminalPoint.x, path.terminalPoint.y);
    return builder;
  }

  get segmentCount(): number {
    return this.#segments.length;
  }

  get isClosed(): boolean {
    return this.#terminalPoint === null;
  }

  appendCubic(control1: Point, control2: Point, end: Point): this {
    if (this.#terminalPoint === null)
      throw new Error("cannot append to a closed builder; reopen it first");
    this.#segments.push(draft(this.#terminalPoint, control1, control2));
    this.#terminalPoint = point(end.x, end.y);
    return this;
  }

  insertSegment(index: number, start: Point, control1: Point, control2: Point): this {
    if (!Number.isInteger(index) || index < 0 || index > this.#segments.length) {
      throw new RangeError("insert index is outside the builder");
    }
    this.#segments.splice(index, 0, draft(start, control1, control2));
    return this;
  }

  replaceSegment(index: number, start: Point, control1: Point, control2: Point): this {
    if (!Number.isInteger(index) || index < 0 || index >= this.#segments.length) {
      throw new RangeError("replace index is outside the builder");
    }
    this.#segments[index] = draft(start, control1, control2);
    return this;
  }

  removeSegment(index: number): this {
    if (!Number.isInteger(index) || index < 0 || index >= this.#segments.length) {
      throw new RangeError("remove index is outside the builder");
    }
    this.#segments.splice(index, 1);
    return this;
  }

  close(): this {
    if (this.#segments.length === 0) throw new Error("cannot close a path without segments");
    this.#terminalPoint = null;
    return this;
  }

  reopen(terminalPoint: Point): this {
    this.#terminalPoint = point(terminalPoint.x, terminalPoint.y);
    return this;
  }

  build(): BezierPath {
    if (this.#segments.length === 0) throw new Error("cannot build a path without segments");
    return new ImmutableBezierPath(this.#segments, this.#terminalPoint);
  }
}
