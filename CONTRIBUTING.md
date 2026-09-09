# Contributing to psBezier

psBezier is currently specification-driven and in active architectural
development.

Before contributing code, read:

1.  `DESIGN.md`
2.  `AGENTS.md`
3.  `IMPLEMENTATION_PLAN.md`

## Design before implementation

Do not silently resolve an architectural question in code. If a required
behavior is not settled in `DESIGN.md`, raise the question before
implementing it.

## Tests

Every change should preserve existing invariants. Geometry bugs should
first be captured as regression tests before being fixed.

Do not enlarge tolerance or weaken a test merely to make a failing case
pass.

## Legacy code

`psBezier-Legacy` and Pomax/bezierjs are references, not architectural
templates. If code is copied or substantially adapted, preserve required
attribution and update `ATTRIBUTION.md`.

## Pull requests

Keep changes focused on the current implementation milestone. Explain
any new geometric invariant, tolerance assumption, or API decision
introduced by the change.
