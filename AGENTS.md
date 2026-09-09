# AGENTS.md — Coding-Agent Instructions

## Authority
This repository is specification-driven. Read `DESIGN.md` and `IMPLEMENTATION_PLAN.md` before architectural work.

Priority:
1. `DESIGN.md`
2. tests/invariants
3. `IMPLEMENTATION_PLAN.md`
4. implementation

If code conflicts with the specification, do not change the specification merely to preserve code. If an architectural point is unresolved, surface it instead of silently inventing a solution.

## Legacy
Old psBezier/Pomax-derived code is reference material, not architecture. Do not preserve its API, hierarchy, naming, organization, or compatibility unless explicitly instructed.

Legacy code may be consulted for mathematics, discovered edge cases, regression fixtures, or application behavior. Extract concepts; do not inherit architecture.

## Core rules
- Keep core geometry Bézier-native. Do not polygonize for boolean/intersection/containment work.
- Curved core geometry is cubic; lines receive analytic handling.
- Prefer dot/cross products, determinants, projections, matrices, and squared distances over trig when an angle is not the desired quantity.
- Preserve the linked-list topology + array index design for BezierPath.
- PathBezier endpoints are derived getters; do not duplicate adjacent endpoint storage.
- Finished paths/Areas are immutable. Editing belongs to builders/editors.
- Tolerance is explicit operational context. Favor accuracy over speed.
- Coincident geometry is expected, not exceptional.
- Do not eagerly materialize edge geometry that can be derived from globalT intervals.
- Validate topology before boolean traversal.
- Do not implement unresolved Area/boolean semantics ahead of the approved milestone.

## Coding style
Use modern, clear, idiomatic code with small focused modules. Prefer composition and pure/shared algorithms over inheritance that couples storage models. Avoid god classes.

Document mathematical intent where it is not obvious from code. Do not add comments that merely restate syntax.

Keep dependencies minimal and justified.

## Tests
Tests are part of the specification. Prefer invariant/property tests in addition to expected-value tests.

When a bug is found:
1. capture the failing input as a regression test;
2. reproduce the failure;
3. fix the underlying cause;
4. verify existing invariants.

Do not weaken a test or enlarge tolerance simply to make a failure disappear.

## Scope discipline
Work only through the current milestone. If implementation exposes a design question listed as unresolved, report it and stop at that boundary rather than inventing future architecture.
