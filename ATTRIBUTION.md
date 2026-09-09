# Attribution and provenance

psBezier is a new Apache-2.0-licensed implementation. Its architecture and public API are
defined by this repository's design documents rather than inherited from earlier code.

## psBezier-Legacy

The historical implementation is maintained separately at
<https://github.com/protosmiths/psBezier-Legacy>. The local reference reviewed while
establishing this repository was commit
`cdc7eaf5e87206f2853d6824aea5c681ed2f4ad4` (2025-01-24).

That repository is reference material for:

- mathematical approaches worth independently reimplementing;
- known edge cases and regression fixtures;
- application behavior that needs explicit confirmation; and
- historical experiments and diagnostics.

Its API, class hierarchy, naming, storage model, and Boolean architecture are not the
architecture of this project.

The legacy repository's root license identifies Steve Graves's work as MIT-licensed.
Individual legacy files may carry more specific notices. For example, `affine.js` carries
an Apache-2.0 notice from Steven M. Graves/Protosmiths, while `bezier.js` and `utils.js`
identify themselves as Pomax-derived and MIT-licensed. File-level notices take precedence
when assessing material for adaptation.

## Pomax / bezier.js

The earlier implementation was based in part on Pomax's Bézier mathematics and bezier.js:

- Primer: <https://pomax.github.io/bezierinfo/>
- Source: <https://github.com/Pomax/bezierjs>

Pomax/bezier.js is MIT-licensed. Before copying or substantially adapting any source,
confirm the notice and license in the exact upstream revision used. Preserve all required
copyright and permission notices in the distributed source or accompanying notices.

Mathematical ideas and published formulas may be independently implemented, but provenance
must still be documented when upstream material materially informs an implementation.

## Contribution procedure

For every copied or substantially adapted algorithm, record in the implementing source or
its accompanying documentation:

1. the upstream project, file, and immutable revision;
2. whether the work was copied, adapted, or independently reimplemented;
3. the applicable upstream license and required notices; and
4. the relevant psBezier tests or design decision.

Do not copy code from an unknown or incompatible source. Resolve provenance before merging
the implementation.
