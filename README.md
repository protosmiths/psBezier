# psBezier

A modern, Bézier-native 2-D geometry library for precision graphics,
manufacturing geometry, and geometric experimentation.

psBezier is being designed around a simple principle:

> Keep geometry as Béziers for as long as possible.

Many geometry libraries flatten curves into polygons before performing
intersections and boolean operations. psBezier instead treats cubic
Bézier curves---and analytically recognized straight-line segments---as
the native geometry.

## Project status

**Early architectural rewrite.**

This repository is a new implementation of psBezier. The previous
implementation has been retained separately as **psBezier-Legacy** for
reference, regression cases, and previously explored algorithms. The
legacy architecture is not the architecture of this project.

The current work is specification-driven. See:

-   `DESIGN.md` --- geometry model, invariants, and design decisions
-   `AGENTS.md` --- instructions for AI coding agents
-   `IMPLEMENTATION_PLAN.md` --- staged implementation plan and
    design-review boundaries
-   `ATTRIBUTION.md` --- provenance and third-party attribution policy

The detailed Area/boolean implementation is intentionally not yet
frozen. The foundation and intersection topology are being designed
first.

## Design goals

### Bézier-native geometry

Curves remain cubic Béziers through geometric operations rather than
being flattened into line-segment approximations.

### Lines are first-class computationally

Straight segments are recognized geometrically and dispatched to
deterministic analytic line mathematics.

A cubic is considered linear when its control points satisfy a squared
cross-product distance test against the configured tolerance. This
avoids unnecessary trigonometry and square roots.

### Contiguous paths by construction

A `BezierPath` is an intrinsically contiguous sequence of path Béziers.

The authoritative topology is a doubly linked list. An array of node
references provides fast indexing and supports the global parameter:

`globalT = segmentIndex + localT`

A path-owned Bézier does not independently store its ending point. Its
`end` is a computed property derived from the next segment's start
point, or from the path's terminal point when the path is open.

### Open and closed paths use one model

A valid terminal point means the path is open.

A `null` terminal point means the path is closed, with the final segment
wrapping to the first.

### Immutable finished geometry

Paths are created and edited through a builder/editor. Building produces
an immutable geometry snapshot.

Areas contain immutable closed paths. Area operations create new
geometry rather than modifying their operands.

### Vector and matrix mathematics

When an angle is not itself the required quantity, prefer:

-   dot products
-   cross products
-   determinants
-   projections
-   affine transforms
-   squared distances

over angle conversion and trigonometric case analysis.

### Accuracy-first tolerance

The kernel is unitless. Applications supply tolerances in their active
coordinate system.

Intersection processing separates:

1.  a wider **discovery/overlap tolerance** used to discover topology;
    and
2.  a tighter **refinement/intersection tolerance** used to accurately
    locate isolated intersections and overlap endpoints.

The recursive search retains the parameter intervals discovered during
the first pass so refinement can restart locally rather than searching
the entire curve pair again.

### Coincident geometry is expected

Coincident sections are not treated as pathological errors. They occur
naturally in real graphics work, especially translated shadows and
layered vinyl geometry.

A finite overlap is represented topologically by two intersection
events.

### Validated intersection topology

Edges between intersections are classified relative to the opposite
Area:

-   `OUTER = +1`
-   `COINCIDENT = 0`
-   `INNER = -1`

At every valid intersection, the four incident edge states must sum to
zero.

Invalid topology is detected before boolean traversal rather than being
patched during the walk.

## Canonical circular geometry

Circles and arcs are construction utilities, not separate kernel
primitives.

A circle is represented by four canonical 90-degree cubic Bézier
approximations. Smaller arcs are obtained from transformed
quarter-circle Béziers and exact Bézier subdivision.

This intentionally favors internal consistency: two constructions
derived from the same canonical circle can share exactly the same Bézier
geometry.

## Intended Area model

An `Area` contains one or more closed immutable `BezierPath`s.

With screen/SVG coordinates where Y increases downward:

-   clockwise boundaries contribute positive area;
-   counter-clockwise boundaries contribute negative area;
-   area to the right of the direction of travel is positive.

The signed model is intentional. Negative intermediate geometry is
meaningful for boolean algebra and must not be discarded merely because
it does not currently represent visible positive material.

Union and intersection are binary `Area × Area -> Area` operations and
are expected to satisfy their mathematical commutative and associative
properties.

The final signed normalization, containment, and boolean-walk rules
remain active design work and are explicitly identified in `DESIGN.md`.

## Intersection strategy

Intersection dispatch is based on actual geometry:

  Geometry   Geometry   Method
  ---------- ---------- -----------------------------------------
  line       line       analytic
  line       cubic      line/cubic
  cubic      line       line/cubic
  cubic      cubic      subdivision with discovery + refinement

For cubic/cubic intersections, the first pass finds candidate parameter
intervals at a wider tolerance. The second pass restarts from those
saved intervals at a tighter tolerance to refine point intersections or
overlap endpoints.

## Testing philosophy

Testing is intended to challenge the design as well as the
implementation.

The project will use:

-   unit tests
-   invariant/property tests
-   metamorphic tests
-   permanent regression cases
-   large real-world geometry sweeps

A major integration/torture test is the aircraft registration-number
generator. It can exercise many fonts, characters, slants, shadow
directions, and shadow offsets. Historically, failures in this
application have been visually obvious.

Every discovered failure should become a permanent regression fixture.

## Applications

The library grew from real design and manufacturing problems, including:

-   FAA-oriented aircraft registration-number graphics
-   slanted lettering that preserves required stroke width
-   vinyl shadow layers with coincident boundaries
-   parametric aircraft stripes
-   storm-shutter design and fabrication software
-   interactive geometry and educational visualization

Application-specific code should depend on psBezier rather than becoming
part of the geometry kernel.

## Legacy and prior work

The original psBezier implementation evolved from experiments based in
part on Pomax's excellent `bezierjs` work. That repository is now
retained as `psBezier-Legacy`.

The new implementation may consult Pomax/bezierjs and psBezier-Legacy
for mathematical algorithms, edge cases, and regression examples, but it
is not intended to preserve their architecture or API.

See `ATTRIBUTION.md` for provenance rules.

## License

The intended project license is **Apache License 2.0**.

Third-party code incorporated or adapted from other permissively
licensed projects must retain the attribution and license notices
required by those projects. See `ATTRIBUTION.md`.

## Development

Development is milestone-driven. Coding agents and human contributors
should read `AGENTS.md` before making architectural changes.

Do not implement unresolved Area/boolean semantics merely because a
placeholder API exists. Architectural questions should be surfaced and
resolved in the design documents first.
