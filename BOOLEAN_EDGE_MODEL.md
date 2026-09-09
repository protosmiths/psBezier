# Boolean edge-state model

This note records the architectural resolution of the edge-state issue raised during subtraction design. It supplements `DESIGN.md` and supersedes the stale statement there that geometric edge classification is relative to the complete opposite Area. The resolved parts should be folded into `DESIGN.md` and `DECISIONS.md` in the next documentation consolidation.

## Separate three concepts

Do not use one edge-state value to represent three different facts:

1. **Geometric edge state** — local relationship of an edge to the particular other loop participating in the intersection topology.
2. **Loop orientation** — signed direction of the loop that owns the edge.
3. **Area-level boolean semantics** — whether the signed/multi-loop Areas require that boundary in the result for the requested operation.

These are different layers and must remain distinguishable.

## Geometric edge state is loop-relative

For a pair of intersecting loops, classify each edge relative to the *other intersecting loop*, not the complete opposite Area:

- `OUTER = +1`
- `COINCIDENT = 0`
- `INNER = -1`

This raw classification does **not** include the owning loop's orientation.

The local four-edge balance invariant therefore remains:

`A_in + A_out + B_in + B_out = 0`

using raw geometric states.

This invariant is a statement about the local topology of two intersecting loops. Classifying against an entire multi-loop Area can obscure the local crossing (for example, another loop or hole can change Area-wide membership on both sides of the local intersection) and can invalidate an otherwise correct local topology test.

## Orientation-derived walk state

Loop orientation is a separate sign:

- CW: `orientationSign = +1`
- CCW: `orientationSign = -1`

Define the effective state used by a signed loop walk as:

`effectiveWalkState = geometricState * orientationSign`

This value should normally be derived rather than stored independently.

Do **not** physically swap stored `INNER` and `OUTER` classifications when a loop is reversed. Doing so would destroy the meaning of the local balance invariant.

For example, after reversing B in `A - B`, a geometrically INNER outgoing edge on CCW B has:

`(-1) * (-1) = +1`

and can therefore be the correct outgoing boundary even though its raw geometric classification remains INNER.

Coincident edges remain zero under either orientation.

## Area-level semantics remain separate

The orientation-derived effective state resolves the specific subtraction-walk contradiction that motivated this note, but it does not by itself finish the general multi-loop Area boolean design.

Area-wide signed membership, holes, disconnected components, normalization, zero-intersection cases, and final retention truth tables remain higher-level questions. Do not collapse those semantics back into local loop-relative edge classification.

Before implementing the final boolean walker, test the model against at least:

- two overlapping CW loops for union and intersection;
- `A - B` implemented by reversing B;
- same-direction and opposite-direction coincident sections;
- a solid with a hole intersecting another loop;
- disconnected multi-loop Areas;
- tangent contacts.

The intended layering is:

`local loop geometry/topology -> loop orientation/sign -> Area boolean semantics`

Preserve that separation in APIs, data structures, tests, and diagnostics.
