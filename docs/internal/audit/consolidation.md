# Consolidation audit

Standing audit for duplicate authority, dead surface, boundaryless wrappers, and speculative
machinery. Opened 2026-09-09. Append findings; supersede rather than rewrite.

The governing rule is the `simple` skill: the simplest coherent implementation, in the least
functional code, with one owner per concept. Net diff growth is the tripwire; deletion is delivery.

## Why this exists

The failure is invisible where it is committed. Every duplicate found so far was added by someone
doing something locally reasonable. Nothing errored, types passed, tests were green. The cost is
global and the decision is local, so judgment alone cannot catch it — only a rule that binds before
the local reasoning starts.

## Method

Two instruments. They see different things and neither is sufficient.

| Instrument                                                  | Finds                            | Blind to                                                                                                                                  |
| ----------------------------------------------------------- | -------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------- |
| Reference counts (`file_references`, `occurrences`)         | Unused symbols, call sites       | **Pure re-export modules.** A module that only re-exports declares nothing, so it reports zero references whether or not it has importers |
| Symbol-table comparison (`document_symbols` across modules) | One name declared in two modules | Same concept under two different names                                                                                                    |
| The compiler                                                | Whether a deletion is safe       | Anything not yet deleted                                                                                                                  |

**Rule learned the hard way:** deletion is proposed by search and confirmed by the compiler, never
by search alone. `snap.ts` was called dead on a reference lookup that had explicitly warned it
could not see through re-exports. It had a live importer.

Symbol-table comparison found three real duplicates that reference counts never would.

## Findings

### Resolved

| Concept                   | Owners before                                | Same behaviour?                   | Resolution                       |
| ------------------------- | -------------------------------------------- | --------------------------------- | -------------------------------- |
| Window body box           | `getWindowBodyHeight` + `getWindowBodyRect`  | No — one ignored the frame border | Deleted the wrong one            |
| Header/body chrome split  | `geometry.ts` + `window-scene-shell.ts`      | No — differed by one border       | Scene delegates to `geometry.ts` |
| `getRectCenter`           | `geometry.ts` + `scene-layer-geometry.ts`    | Byte-identical                    | One owner                        |
| `rectContainsPoint`       | `geometry.ts` + `group-state.ts`             | Identical, reordered              | One owner                        |
| `clamp`                   | `geometry.ts` + `group-layout.ts`            | **No** — see below                | One owner                        |
| Snap re-export hop        | `snap.ts` fronting two modules, one consumer | n/a                               | Deleted, import repointed        |
| `addPoints`, `scalePoint` | `geometry.ts`, reached by nothing            | n/a — dead                        | Deleted                          |

**`clamp` is the instructive one.** `geometry.ts` returns `Math.max(min, Math.min(max, value))`;
`group-layout.ts` returned `Math.min(Math.max(value, min), max)`. Identical while `min <= max`.
On inverted bounds the first yields the minimum and the second the maximum. One name, two answers,
no test or type or lint rule that would ever have reported the disagreement. No caller passes
inverted bounds today, which is exactly why it survived.

### Checked and cleared

Recorded so the next sweep does not re-suspect them.

| Suspected                                                                                               | Verdict                                                                                    |
| ------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------ |
| `scene.ts` — 50 lines, all re-exports                                                                   | Legitimate. It is the `./scene` entry in `package.json` exports                            |
| `rasterization-layer.ts` — 16 lines, all re-exports                                                     | Legitimate facade. Both consumers use it consistently                                      |
| `window-identity`, `window-capabilities`, `workspace-membership`, `window-proximity` — 11–23 lines each | Legitimate. One concept each; `workspace-membership` documents a deliberate cycle boundary |
| `getPointBounds` vs `getRectFromPoints`                                                                 | Not duplicates. N points vs two, nullable vs total                                         |

| `duplicate-canvas.ts` vs `fork-canvas.ts` | Not duplicates. Duplicate copies an existing `canvasId` and marks it `copy`; fork creates from a serialized layout snapshot and marks it `(recovered)`. Shared parts already extracted into `getNextSuffixedTitle` and `withNamingLock` |
| `text-search.ts` (7 lines) vs `searchable-text.ts` | Not duplicates. Two search predicates versus excerpting |
| Four `*-gateway.ts` modules with identical symbol shapes | Not duplicates. See below |

**The gateways are the most instructive clearance.** `note`, `link`, `image` and `collection` each
declare `*_KIND`, `*Content`, `*Record`, `to*` and `*Gateway` — a perfect parallel. The `to*`
mappers really are near-identical seven-line functions. The gateways are not: note has five methods
to collection's two, note derives search text from extracted prose while collection uses the title,
note's content is `{text}` while collection's is a union of `{listsKind}` and `{connectedTo}`, and
the input vocabularies differ per kind. A `createContentGateway(kind, schema, mapper)` would have
to parameterise the method set, the search-text strategy and the input names — three axes across
four call sites, to save roughly twenty lines. That is the speculative machinery this audit exists
to prevent, not a consolidation.

### The negative result, which is the most transferable finding

**Seven suspicions, seven clearances. File-shape intuition has been wrong every single time.**

Small modules, near-identical filenames, and parallel symbol tables all failed as detectors. Every
real duplicate was found by comparing symbol tables for the _same name declared twice_, and each
one hid inside a file that looked completely unremarkable.

The pattern this codebase actually has is **parallel structure across genuinely distinct things**.
It reads as duplication and is not. A consolidation pass driven by "these look alike" would make
the code worse, and the gateways are the case where it would have done real damage.

So: do not open this audit by listing files and picking the suspicious-looking ones. That method
has a zero percent hit rate here across seven attempts.

## Coverage

| Category                       | Scope                                                    | State                                                                                                       |
| ------------------------------ | -------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------- |
| 1. Duplicate authority         | `packages/infinite-canvas` geometry and layout           | Swept — 3 found, 3 fixed                                                                                    |
| 1. Duplicate authority         | Framework primitives beyond those                        | Swept — `addPoints`, `subtractPoints`, `scalePoint`, `rectsIntersect`, `isUsableViewport` all cleanly owned |
| 1. Duplicate authority         | Rest of `packages/infinite-canvas`                       | Not swept                                                                                                   |
| 1. Duplicate authority         | `apps/polkadot` canvas copy operations, gateways, search | Swept — none found                                                                                          |
| 1. Duplicate authority         | Rest of `apps/polkadot`                                  | Not swept                                                                                                   |
| 2. Dead surface                | `geometry.ts`                                            | Swept — 2 found, 2 deleted                                                                                  |
| 2. Dead surface                | Everywhere else                                          | Not swept                                                                                                   |
| 3. Wrappers without a boundary | The four re-export modules                               | Swept — 1 removed, 3 legitimate                                                                             |
| 4. Speculative machinery       | Anywhere                                                 | Not swept                                                                                                   |

Yield is falling. Framework geometry gave three duplicates and two dead exports; the next five
primitives gave nothing; Polkadot's three strongest leads gave nothing. Later sweeps should expect
low returns and stop early rather than manufacture findings.

Known unexamined leads:

- 72 experimental names across 63 modules in the API stability report. Uncommitted surface is where
  a second implementer fails to find the first.
- `commands.ts` at 1.8k lines and `infinite-canvas.tsx` at 1.9k lines in the framework;
  `app-actions.ts` at 1.8k lines in Polkadot.
- `connection.ts` and `window-connection.ts` coexist in the framework. Not judged: the first was
  mid-construction by another session when this was written.

## Working rule for concurrent sessions

The pre-commit API gate runs package-wide, so another session's half-finished export blocks every
commit in the repository, not just theirs. Observed once on 2026-09-09 and it resolved on its own
within minutes. Prefer retrying over reaching into their files.
