# Ship Plan: Open-Source + Production Readiness

> Adopted 2026-06-24. Goal: take the framework from "works on my machine,
> verified by hand" to **publishable on npm, safe to open-source, and
> trustworthy in production**. This is [ROADMAP.md](ROADMAP.md)'s **P8**
> pulled forward and made concrete, because P1–P7 all build on a package
> nobody can install.
>
> Every item below is grounded in a fact verified against the repo on
> 2026-06-24, not an assumption. Verified findings are marked ✅.

## Verified state of the world

✅ **The npm name `infinite-canvas` is taken** (v1.0.0 published by someone
else). `@infinite-canvas/react` and `@infinite-canvas/core` are free. The
scoped rename is now a _hard requirement_, not a preference.

✅ **`"use client"` is stripped from the build.** 16 source files declare it;
`dist/index.mjs` contains zero occurrences. This is a **silent production
break** for Next.js App Router / RSC consumers — a hooks-based client
library that fails to announce itself.

✅ **No LICENSE file exists** though `package.json` declares MIT. You cannot
open-source without one.

✅ **No CI.** No `.github/` directory at all.

✅ **Both READMEs are still scaffolder templates** ("Vite+ Monorepo Starter",
"vite-plus-starter").

✅ **`@react-three/fiber` peers to an exact canary** (`10.0.0-canary.dbbe704`)
and `three` is a hard peer imported at dist top level. Consumers are forced
onto a canary and pay for three.js even if they never use `sceneLayers`.

✅ **No `sideEffects` field**, no `repository`/`homepage`/`keywords`.

✅ Good news: `@zumer/snapdom` is correctly lazy (`import()` only), dist is
216 KB ESM + 100 KB dts + theme.css copied correctly, 131 tests green.

## Status — 2026-07-08

**Class 1 (cannot publish): DONE.** Renamed to `@infinite-canvas/react`;
`"use client"` re-asserted as the bundle's first statement; full npm metadata,
`sideEffects: ["**/*.css"]`, provenance; peers widened off the exact R3F canary.
`scripts/verify-artifact.mjs` is the standing gate, wired to `prepublishOnly`.
Proven with `pnpm pack` -> install into a fresh project outside the workspace
-> `tsc --noEmit` against the published `.d.mts` -> esbuild bundles at exit 0
-> theme.css subpath resolves. `pnpm publish --dry-run` runs the whole
pipeline and resolves to `@infinite-canvas/react@0.1.0` on the registry.

**Class 3 (nobody would trust it): DONE.** LICENSE, root README, npm README
(quickstart compiled verbatim), `docs/API.md` derived from the barrel (287
names, all verified present in the built `.d.mts`), CI (node 22/24) and a
provenance release workflow, CONTRIBUTING / CODE_OF_CONDUCT / SECURITY /
CHANGELOG / issue + PR templates.

**Class 4 item 13 (optional 3D): DONE** — see below. Items 12 and 14 remain.

**Class 2 (cannot open-source) — mechanical half DONE; history rewrite still
required.** `reference/` is untracked and the derived `/dynamic-grid` showcase
has left `apps/playground`. What remains is a `git filter-repo` purge of the
derived implementation from history — irreversible, rewrites every SHA, no
remote to recover from, and therefore the owner's call rather than an agent's.
The npm package is unaffected and publishable today: neither `/dynamic-grid` nor
`reference/` ever shipped in the tarball.

**Also fixed, found by measuring the artifact rather than the workspace:**

- The toolchain catalog pinned `vite`/`vitest`/`vite-plus` to `@latest`, so
  every `install` silently upgraded it. A 0.1.24 -> 0.2.2 drift broke
  `vp test` mid-session. Now pinned exactly — reproducible builds are a
  prerequisite for CI meaning anything.
- `arktype` was 45.5 KB gzipped, **34% of the shipped bundle**, reachable from
  `store -> persistence -> validation` on every consumer's render path, to
  validate eight small shapes. Replaced with hand-rolled guards, proven
  behaviour-identical by characterization tests written against arktype first.
  132.9 KB -> 87.4 KB gzipped.
- `aria-selected` on `role="group"` is invalid ARIA. Replaced with
  `aria-current` on the active window, plus `aria-roledescription="window"`.
  Locked by `src/accessibility.test.tsx`.
- Persistence had **no browser coverage at all** — no playground route set
  `storageKey`. Added `/persistence`, and verified live: a fractional rect
  (`x: 144.21052631578948`) round-trips exactly; transient interaction state is
  stripped; a poisoned payload, a window whose `kind` no longer exists, and
  unparseable JSON each recover cleanly with zero console errors.

**Two ship blockers the artifact gate did not catch, found by building a
consumer that had nothing installed:**

- ✅ **`peerDependenciesMeta.optional` was a false claim.** Marking `three`
  optional and hiding the surface behind a dynamic `import()` silences npm but
  does nothing for bundlers: they resolve dynamic-import specifiers at build
  time, so an esbuild run in a consumer with no 3D packages still hard-failed on
  `three`. Fixed with an API seam, not a manifest edit —
  `InfiniteCanvasWebGpuSurface` now ships from `@infinite-canvas/react/scene`
  and is injected as the `sceneSurface` prop. The main entry never reaches it,
  statically or dynamically. A consumer with neither peer installed typechecks
  and bundles: **40.1 KB gzipped**, versus 263.3 KB with the 3D path.
- ✅ **The `"use client"` banner leaked into `index.d.mts`.** A directive
  prologue is a statement, illegal in an ambient context, so every consumer who
  had not set `skipLibCheck` would have failed to compile with TS1036 on
  install. Introduced by the Class-1 fix; caught only by typechecking a real
  consumer with `skipLibCheck: false`. Both halves are now asserted by the gate,
  and each assertion was negative-tested against a deliberately broken artifact.

**Program work landed alongside** (capability, not ship blockers): P2 tranche 1
(frame chrome memoization — landed, **unmeasured**, see
[research/performance-profile.md](research/performance-profile.md)); P1 in full —
the group core is wired, **every** pointer gesture lands (dock, shell move, shell
resize, seam reweight, tab tear-out, tab reorder), undo/redo and layout recipes
shipped with it, and FOCUS-002/FOCUS-003/ACC-001 landed alongside. P1's scenario
tests remain unwritten, so it is capability-complete and verification-empty: no
test in the suite touches groups, history, or recipes at all.

## The gates this plan credits have never run — found 2026-08-12

**This repository has no git remote.** `git remote -v` is empty. Two consequences that every
entry below was written without:

- **GitHub Actions has never executed.** `ci.yml` and `release.yml` are well-formed and
  describe exactly the right pipeline. Nothing has ever triggered them.
- **`pre-push` has never fired**, because there is nothing to push to. That hook holds
  `vp check` and the source-reading gates, and its own comment defers tests and builds to CI
  "where a red run costs nobody's attention" — a division of labour that is correct in a repo
  with a remote and leaves nothing running in this one.

So the only automation that has ever actually executed here is `pre-commit` → `vp staged`,
which lints and formats **the files in the commit**. Everything C1 describes as enforced is
enforced only when someone runs it by hand.

This is not a hypothetical gap. The playground's build was broken by a `process.env.NODE_ENV`
reference in source-linked framework code, and stayed broken while every in-package gate
reported green — because nothing ran the consumer's build.

**Changed in response:** the four source-reading gates now run in `pre-commit` as well, where
they will actually execute. They read source, need no build, and cost milliseconds together.
`vp check`, the tests, and the builds stay out of `pre-commit` deliberately — they are slow
enough that a hook running them gets disabled within a week, which is the same reasoning
`pre-push` already records. They remain in `pre-push` and CI for when a remote exists.

**What this does not fix, and is worth the owner knowing:** no automation runs the tests or the
builds. Until a remote exists, `pnpm --filter @infinite-canvas/react verify` and the playground's
build are manual steps. Publishing and creating the remote are both owner actions.

## Blocker classes

### Class 1 — Cannot publish (fix first)

1. **Rename** to `@infinite-canvas/react`; update workspace deps, playground
   imports, `theme.css` subpath, docs.
2. **Preserve `"use client"`** through the bundle (tsdown/rolldown directive
   preservation, or a banner). Verify by grepping dist.
3. **Package metadata**: `repository`, `homepage`, `bugs`, `keywords`,
   `sideEffects` (theme.css + directives make this non-trivial — must not be
   blanket `false`), `engines`, `publishConfig.provenance`.
4. **Peer ranges**: widen R3F off the exact canary; declare supported React
   (19) and three ranges. Decide whether R3F/three become _optional_ peers.

### Class 2 — Cannot open-source (decision required)

5. **LICENSE file** (MIT, Tyler Davis Mitchell) at root + package.
6. ⚠️ **IP risk — `/dynamic-grid`.** The showcase and
   `reference/infinite-canvas-dynamic-grid/` are _derived from
   deobfuscated third-party code_ (the "Robot Components" nodegrid bundle).
   `GRID_MOTION_STUDY.md` documents motion constants and a GLSL grain shader
   extracted from that reverse-engineering. The deobfuscated sources were
   already purged from git history, but the **derived implementation
   remains**. Publishing it in a public repo is a real legal exposure.
   Owner decision required — options in "Open questions" below.
7. **`reference/`** (78 tracked files of copied prior art) — legally fine
   (Tyler's own kek code) but it is clutter in a public repo and its docs
   point at the deobfuscated material. Decide: exclude, or keep with a
   provenance note.

### Class 3 — Nobody would trust it (do before announcing)

8. **CI**: install → `vp check` → tests → build, on push/PR.
9. **Real READMEs**: what it is, why it exists, quickstart, live status,
   honest limitations.
10. **Consumability proof**: `npm pack` the tarball, install into a _fresh_
    app outside the workspace, import, typecheck, build. This is the only
    test that proves the published artifact works — the workspace's
    source-linked exports hide every packaging bug.
11. **CHANGELOG + versioning flow** (changesets), `CONTRIBUTING`,
    `CODE_OF_CONDUCT`, issue/PR templates.

### Class 4 — Production hardening (highest-value follow-through)

12. **Accessibility baseline (FR-9)** — ARIA semantics are done and locked by a
    test. Keyboard reachability _between windows_ landed with `window.focusDirection`
    (Alt+Arrow); this item stayed marked `open` afterwards and was stale.

    **What was actually still missing, found 2026-08-12 by asking what a pointer can
    do that a keyboard cannot:** the camera. It had exactly three commands — fit-all,
    fit-selection, reset-zoom — so a keyboard user could jump the view but could not
    pan or zoom it, which on an infinite canvas withholds the primary interaction.
    `view.pan` and `view.zoomBy` close that. The same sweep found the whole group
    model pointer-only (docking, undocking, layout conversion, axis, dissolve,
    reorder) and the window lifecycle absent from the command registry entirely; all
    are now commands, and `command-coverage.test.ts` fails the typecheck if a new
    action is added without classifying whether it needs one.

    **Partly closed 2026-08-12: zoom now has a default chord.** `view.zoomBy` binds
    bare `=` and `-`, the pair every spatial editor already uses. Not `Mod+=`/`Mod+-`,
    which are the browser's above the page; and not `Shift+=`, which was the first
    choice for symmetry with the `Shift+0/1/2` view family — `@tanstack/hotkeys`
    refuses that at the type level, and its reason is better than the symmetry
    argument: `Shift` changes what a punctuation key produces, so the chord is not
    stable across keyboard layouts. Digits are exempt, which is why `Shift+1` is
    registerable and `Shift+=` is not. Bare keys are safe because registration sets
    `ignoreInputs`.

    **Pan stays unbound, and the reason is now concrete rather than a preference.**
    Every arrow combination is taken — bare by `window.nudge`, `Alt` by directional
    focus, `Shift`/`Alt+Shift`/`Mod+Shift` by their own families — and `Mod+Arrow` is
    the browser's history and scroll-to-end on macOS. Sharing the bare arrows with
    `window.nudge` does not work either: bindings register independently and the
    handler swallows the chord _before_ testing enablement, so both would fire and one
    arrow press would nudge a window and pan the canvas at once. It stays
    palette-reachable and bindable through `hotkeyBindings`.

13. ✅ **Optional 3D** — DONE, but not the way this item imagined. A lazy mount
    is insufficient: bundlers resolve dynamic-import specifiers at build time.
    It took an API seam (`@infinite-canvas/react/scene` + the `sceneSurface`
    prop). 40.1 KB gzipped without the 3D path.
14. ✅ **API surface audit — DONE.** The export surface was a maintenance liability;
    mark experimental vs stable, consider moving scene helpers behind `/scene`.
    _As of 2026-07-08 the two entries export **192 values and 164 types**_ (the "287
    names" above was true when written, before P1/P4 landed groups, history, recipes,
    and portals; the audit then removed the dead pre-proxy surface, below). `docs/API.md`
    is **hand-maintained, not generated** — despite what this plan said, and despite what
    `API.md`'s own header said for a month while drifting by 43 names. Both claims are now
    corrected in the file that made them.

    ✅ **The drift gate exists**: `scripts/verify-api-doc.mjs` asserts every barrel
    export appears in `docs/API.md`, failing CI (before the build) and `prepublishOnly`.

    ✅ **The semver gate exists**: `scripts/verify-api-stability.mjs` +
    `scripts/api-stability.json`. **374 names shipped with no tier, which is not "no
    promise" — it is an implicit promise of stability on all 374, made by silence**,
    including on modules nobody has ever watched run. Now 312 stable, 42 experimental.
    Classification is per **module**, deliberately: a new export in `geometry.ts`
    inherits stable, and a new module in a barrel fails the build until someone decides
    what it promises. All five failure modes negative-tested (unclassified module, both
    tiers at once, stale manifest entry, stale `typesExperimental` name, doc that stops
    naming an experimental module).

    **The audit's second half — "consider moving scene helpers behind `/scene`" — is
    answered no, on evidence.** `scene-layer-geometry`, `spatial-target`, and `window-proxy`
    sound like 3D and are all pure-core roots that `verify-pure-core.mjs` proves cannot reach
    `three`; each has a consumer. Moving them would force the 3D peers on someone drawing SVG
    connectors.

    **What the audit found instead was dead surface, and the answer to dead surface is a
    delete, not a tier.** `window-scene-shell` exported fifteen names whose only callers lived
    in `window-scene-shell.test.ts` — `getMinimumWorldLength` had no reference anywhere at all —
    and `scene-model` was a two-line re-export of `window-proxy` under pre-proxy names nothing
    imported, alongside the `@deprecated` `getWindowSceneModel` / `InfiniteCanvasWindowSceneModel`
    aliases on the scene-layer context. All of it was unexported the same day. The package has
    never been published, so nothing broke; `window-scene-shell.ts` stays on disk because
    `window-proxy` calls one function from it, and it is re-exportable in a minor if a consumer
    ever asks. An unconsumed export is not a stability tier — it is a promise not worth making.

## The delivery plan

> **Rewritten again, late 2026-07-08.** Everything below the horizontal rule is the
> historical record of hours already spent — kept because it says what was proven and
> how. This section is the plan _forward_, and it exists because the previous version
> described work that is now finished and therefore routed nobody anywhere.

**Ship, open-source, and production are three separate gates.** Conflating them is what
made the earlier plans read as further from done than they are.

| Gate                    | State              | What actually stands in the way                                                |
| ----------------------- | ------------------ | ------------------------------------------------------------------------------ |
| **Publishable to npm**  | ✅ ready _now_     | Nothing technical. `pnpm publish` is an external-service action — the owner's. |
| **Public repository**   | ⛔ owner-gated     | One `git filter-repo` purge. Irreversible, no remote. Nobody else may do it.   |
| **Honest "production"** | 🟡 three real gaps | NFR-1 unmeasured, FR-9 focus trapping, P1 scenario tests. All below.           |

### Track A — Publish (0 agent-hours; owner action)

The package is publishable today and has been since the Class-1 work landed.
`scripts/verify-artifact.mjs` gates `prepublishOnly`; `pnpm publish --dry-run` resolves
`@infinite-canvas/react@0.1.0`. Neither `reference/` nor `/dynamic-grid` has ever been in
the tarball, so the history problem does **not** block npm. It blocks only the repo.

**Owner action, one line:** create the npm org, then `pnpm publish`.

### Track B — Open-source (0 agent-hours; owner-gated, and that is final)

`reference/` is untracked, the derived `/dynamic-grid` showcase is out of the tree, and a
fresh clone builds. What remains is that the derived implementation is still reachable in
git history. `git filter-repo` rewrites every SHA and this repo has no remote to recover
from. **An agent must not do this unasked, and naming it is the whole result.** Until it
happens the repo cannot go public; nothing else on any track is waiting on it.

### Track C — Production honesty (the only track with agent-hours left)

Ordered by what unblocks the most. Each has an exit criterion, not a vibe.

**C1 — Drift gates (~1h, no browser). ✅ DONE.** Two documents made claims nothing
enforced, and both had already been wrong in exactly the way a gate would have caught:

- ✅ `docs/API.md` had drifted by 43 public names — undo/redo, recipes, and portals had no
  section at all, while `README.md` pointed consumers there for "the full export surface".
  **`scripts/verify-api-doc.mjs` now gates it**, in CI before the build and in
  `prepublishOnly`. Both assertions negative-tested, including the one that makes the gate
  refuse to run when the barrel grows an export form its parser cannot see — a drift gate
  blind to your new export is worse than none, because it reports success.
- ✅ `README.md` and `CONTRIBUTING.md` claimed a test enforced the pure core's import
  boundary. **No such test existed.** `scripts/verify-pure-core.mjs` now crawls the import
  graph from 29 pure-core roots (reaching 33 modules) and fails when any can reach `react`,
  `@legendapp/state`, `three`, `@react-three/fiber`, or `@zumer/snapdom`. Type-only imports
  are ignored — `import { type X } from "./store"` erases and must not trip it, which is
  negative-tested, because a gate with false positives is a gate people learn to ignore.
  It also refuses to pass if the crawl reaches fewer modules than its floor.

- ✅ **A third gate, which C1 did not anticipate and the other two exposed.** `pre-commit`
  runs `vp staged` — lint and format over **the files you staged**. It is structurally blind
  to a change in file A that breaks file B, where B was never staged. Making `isGrouped` a
  required prop on `InfiniteCanvasWindowFrame` broke two test files exactly that way, and
  **`vp check` failed on the workspace for six consecutive "clean" commits** before anyone
  ran it. CI would have caught it on the next push, which is to say: after it was pushed.
  `.vite-hooks/pre-push` now runs `vp check` (~4s) plus both gates above. Negative-tested:
  deleting the prop from an unstaged test gives `vp staged → exit 0`, `pre-push → exit 1`.
  Tests and builds stay in CI on purpose; a pre-push hook slow enough to be resented gets
  disabled within a week.

Exit: **met.** An observable imported into `reducer.ts` fails CI; so does a `three` import
three hops away, reported with the full trail. Both negative-tested, along with the
type-only false-positive case and a stale root entry. The API-doc gate has since caught
undocumented exports **three times**, within six commits of being written.

**C2 — P1 scenario tests. ✅ DONE (2026-08-12).** Called "the single largest gap in the project"
for a month. **All seventeen scenario ids now assert**: DOCK-001..005, SPLIT-001..003,
TAB-001/002, ACC-001, FAIL-001, FOCUS-001..003, PERSIST-001/003. 237 tests across 27 files, up
from 165 across 22 when this entry was written.

Landed across three files by what each scenario turns on: `group-tree.test.ts` for the structural
claims (the tree is pure, so the primitive surface is tightest), `history.test.ts` for the
transaction claims, and `acceptance-scenarios.test.ts` for everything that only exists once a
_state_ does — a shell moving as one object, a seam reweighting, a zoom mid-drag, a cluster
surviving storage.

**ACC-001 required moving code, not just asserting it.** `getNextRovingIndex` was private to
`group-layer.tsx`, so the accordion's axis rule was unreachable from a test — which is exactly why
it stayed unasserted while every other roving-focus claim was checked. It is pure keyboard geometry
and holds no React, so it now lives in `window-focus.ts` as `getNextInfiniteCanvasRovingIndex`,
beside the directional-focus rule whose diagonal-drift refusal it implements. Internal, not
exported from the barrel.

**FAIL-001 caught its own author.** The first draft asserted the doc's +150 and got +100 — and the
code was right. The doc's arithmetic assumes a **pointer-anchored** zoom (`camera.zoomAt`, which
holds the world point under the cursor fixed and makes the two drag legs additive); setting `zoom`
directly while leaving `center` alone teleports the world under the cursor and yields a different
number for an uninteresting reason. The test now drives the real zoom path, and carries a second
assertion of the invariant itself — the grabbed world point stays pinned to the cursor across an
arbitrary zoom — so it survives any future change to the numbers.

Exit: **met.**

**Writing the tests was out of scope this session; specifying them was not.** The 2026-07-09
reading-audit of the whole group/history/recipe core established which invariant each scenario
turns on, and [research/c2-test-plan.md](research/c2-test-plan.md) renders that as an
arrange/act/assert for **every** P1/P4 scenario, grounded in the real functions and expected
container ids. It turns "write the suite" into "type these assertions", which is the difference
between a gap that needs design and one that needs an afternoon of mechanical work. The plan also
carries the two regressions the audit caught (dock-intent-once, pan-keeps-mid-pan-zoom) as guard
assertions, and a coverage-floor gate so P1/P4 cannot silently return to verification-empty.

_The argument stopped being hypothetical. **Eight pre-existing defects were found by reading**
on 2026-07-08, and four map straight onto scenarios that do not exist as tests:_

| Defect                                                   | Scenario  |
| -------------------------------------------------------- | --------- |
| `Alt`+drag dispatched `interaction.step` three times     | DOCK-001  |
| Dead resize handles on grouped windows buried the gutter | SPLIT-001 |
| Mid-drag zoom slid the window out from under the cursor  | FAIL-001  |
| `window.nudge` detached a grouped window from its shell  | DOCK-003  |

_The other four had no scenario at all: `scope="window"` portals painting under their own
window; `maxPendingCaptures` blanking every window the queue refused; the frustum probe
sweeping its whole tracked set every frame, quadratically, inside the subsystem that exists to
measure frame cost; and a group tab strip spending one tab stop per tab._

_Three more were **introduced and caught the same day** — two in group-resize code re-read an
hour after writing it, and a hotkey collision found by audit rather than by anyone hitting it.
A fourth was found only by running the workspace gate: `vp check` had failed for six
consecutive commits._

_**This paragraph was true when written and is false now — corrected 2026-08-12.** It read "No
test in the suite touches groups, history, or recipes. P1 and P4 are capability-complete and
verification-empty", in the present tense, directly below the **DONE** that contradicts it. C2
closed that gap: `group-tree.test.ts`, `history.test.ts`, and `acceptance-scenarios.test.ts` cover
all seventeen scenario ids, and the suite now stands at 469 tests across 51 files. Left in place
rather than deleted because the argument it makes — that capability without verification is a
liability — is why the tests exist; but a stale claim stated in the present tense is how a
successor concludes the suite is empty and rebuilds what is already there._

_The two highest-risk of those paths were **reading-audited 2026-07-09**, which is not a test
and does not close C2 — it only narrows the range of what an eventual test might catch. Both
were found sound. In `recipes.ts`, a recipe applied after one of its windows was closed does
not restore a shell laying out a ghost: `reconcileInfiniteCanvasGroups` runs on the way back in
and `undockInfiniteCanvasGroupWindow` strips every non-live leaf, dropping any tree it empties,
so the comment claiming this is backed by the code rather than hoping. In `history.ts` +
`reducer.ts`, the checkpoint records the **pre-action** document via `pushInfiniteCanvasHistory`
(which clears the redo branch), a drag is one entry because only the null→non-null interaction
transition checkpoints while `interaction.step` never does, and undo/redo move documents between
`past` and `future` without losing the current one. The one wart is deliberate and documented:
grabbing a window and releasing it without moving still leaves a checkpoint, so it costs one
no-op undo press. A test would still be worth writing; the risk that it finds a corruption bug
in these two paths is now lower than it was._

_The audit widened the same day across the rest of the core, and it earned its keep: **it found
two live bugs**, both now fixed (see the friction backlog and CHANGELOG). A recursive parser over
untrusted `localStorage` threw `RangeError` on pathological nesting instead of returning `null`
per its contract (`validation.ts`, depth bound added). And **pan discarded a zoom performed
mid-pan** — the sibling of FAIL-001 on the one drag FAIL-001's own write-up called immune, caught
by reading `stepCanvasInteraction` end to end. The paths read and **found sound** were:
`interaction.ts` drag/zoom deltas (every drag re-projects both pointer ends; a strict
generalization proven bit-identical at static zoom), `geometry.ts` zoom-at-cursor and pan math,
`selection.ts` marquee accumulation (duplicates from `add` mode are deduped downstream by
`normalizeSelectionWindowIds`), the `group-tree.ts` dock/undock/normalize core (the `targetId::edge`
container id is collision-free because re-docking the same edge extends the split rather than
recreating it; weights preserve neighbour proportions), and both halves of snapping — the resolver
(hysteresis, priority, resize-edge sign math) and the candidate builder (gap centering, stable ids,
overlap gating). None of this is a test. It is reading, and it says: when the scenario tests are
written, these are the invariants they should assert, and these two are the regressions they should
lock down. `registry.ts` carries one unreachable-through-the-public-API inconsistency (the
empty-windows and main normalization paths preserve a transient `interaction` that the
all-unregistered fallback clears) — noted, not fixed, because no real flow reaches it: the store
only ever validates a hydrated state whose interaction is already `null`._

_Auditing `acceptance-scenarios.md` on 2026-07-08 also found the doc badly stale — its
headers said "grouping unbuilt" over a list of scenarios each marked `done`, and `SNAP-005`,
`PERSIST-001`, and `PERSIST-003` were filed as unbuilt features that had long since shipped.
Root cause: one status bucket, `open`, meant both "unbuilt" and "untested". It now
distinguishes `built` (works, nothing guards it) from `unbuilt`._

**C1b — The semver gate (~1h, no browser). ✅ DONE.** Class-4 item 14, above. Two documents
described the export surface; neither said what any of it promised, and 374 names with no tier
is an implicit promise of stability on all 374. `verify-api-stability.mjs` now classifies per
module and fails the build on an unclassified one. Auditing to write it found the real finding:
`window-scene-shell` exports fifteen names nothing calls.

Exit: **met.** A new module in a barrel fails CI until it is classified; five failure modes
negative-tested.

**C3 — Group shell resize. ✅ BUILT, owner-confirmed.** Reported by the owner: a
group's outer edge could not be dragged. A `groupResize` interaction beside
`groupMove`/`groupGutter` steps `group.rect`; members re-project for free.

The plan was wrong about the hard part twice, and reading fixed both. The minimum size is
**not** a function of every pane's `minSize` — the solver has never consulted `minSize`,
because inside a tree a member has no rect of its own. It is structural: gutters, tab
strips, accordion headers, and `MINIMUM_GROUP_PANE_EXTENT` per pane, resolved once at drag
start so a mode change mid-drag cannot move the floor under the pointer. And the shell's
handles must sit **outside** its rect, not straddle its edge: everything inside is
member-window DOM drawn above the group layer, so an inward half can never be clicked.

Two further corrections came from re-reading the finished code rather than the plan. The
accordion branch sized its minimum against the _active_ child while the tabs branch used
the widest — they must agree, since `setGroupActiveChild` can expand a larger fold at any
time and squeeze the shell below its own floor. And `minSize` now travels on the action,
like the gutter drag's `availableExtent`: group metrics live in the render layer, so a
reducer that assumed the defaults would hand a consumer with custom metrics a floor that
disagreed with the layout in front of them.

Exit: dragging a shell edge resizes the group, the shell stops at its structural floor,
and the drag is one undo entry. **Owner-confirmed working in the browser, 2026-07-08.**
The structural floor and the single-undo-entry properties remain unobserved — nobody has
dragged a shell to its minimum and watched it hold, or undone a resize.

**C4 — the measurement (~2h, BROWSER REQUIRED).** P2 tranche 1 is committed and unmeasured;
the profile's tables describe the pre-tranche-1 runtime, and say so. Nothing downstream may
quote a number until the synthetic wheel/drag drivers run on `/stress` at 20/40/80 windows.

_Corrected 2026-07-08: this entry said `NFR-1` "currently reads failing and must keep
reading failing". It read failing in `REQUIREMENTS.md`, which had not been updated for a
month after the measurement that contradicted it — `962e42c` took pan at 20 windows from
15.6 fps to 96.9 fps, and NFR-1's stated bar is **ten** windows. I repeated the stale claim
without checking the profile it pointed at._

**NFR-1 passes at its own bar.** What is unmeasured is P2 tranche 1, and what is unmet is
**P2's** target of 100 windows at 60 fps — 80 windows pan at 21.3 fps today. Those are three
different statements and this plan was collapsing them into one.

Exit: the profile's tables describe the current runtime, and the benchmark is scripted so a
regression fails loudly rather than silently.

**The measurement is scripted; only the running needs the browser.** The harness exists
(`apps/playground/src/showcases/benchmark.ts`, exposed on `/stress` as `window.__canvasBench`),
so the protocol is mechanical:

1. For `count ∈ {20, 40, 80}`, open `/stress?count=<count>&raster=false`, wait for the windows to
   mount, and run `await window.__canvasBench.baseline()`. It drives synthetic wheel/drag/pan at
   one input per `rAF` and prints a `{ pan, drag, zoom }` object of `p95` frame times.
2. Paste each printed object into `benchmark-baseline.ts`'s `RUNS`, keyed by `count`. This is the
   recorded baseline the regression gate compares against; `RUNS` is empty today, so
   `compare()` reports `unrecorded` and never a false `pass`.
3. Re-run with `raster=true` at 80/160 to confirm the rasterization lane throttles background
   windows rather than blanking them (the `maxPendingCaptures` fix).
4. Write the numbers into
   [research/performance-profile.md](research/performance-profile.md)'s tranche-1 section, which
   currently describes the **pre**-tranche-1 runtime and says so. The one question the run
   answers: did frame-chrome memoization move 80-window pan off 21.3 fps toward P2's 60 fps bar?
5. A gesture regresses only when its `p95` exceeds the baseline by **both** `REGRESSION_MARGIN`
   (0.25) **and** `REGRESSION_FLOOR_MS` (1.5) — either alone is a gate nobody trusts. Absolute
   numbers want real hardware; the embedded preview underclocks `rAF` under load, so the ratios
   and slopes are the finding, not the milliseconds.

**Attempted 2026-07-09; the embedded preview cannot be the instrument.** Step 1 was run against
the `preview_*` sandbox: the harness works end to end (exposes, drives, no errors, page
responsive), but `baseline()` at 20 windows ran **past 280 seconds without finishing** — an
effective ~1 fps under the drag load. The preview `rAF`-throttles under exactly the load the
benchmark applies, so it cannot produce a timely or trustworthy number. This does not soften
step 5's caveat, it **hardens** it: C4 needs a real browser on real hardware, where `baseline()`
returns in seconds, and the preview is confirmed the wrong place to run it. See
[research/performance-profile.md](research/performance-profile.md)'s 2026-07-09 subsection. The
harness is proven ready; the environment is the remaining gate.

**C5 — FR-9 focus trapping (~2h, BROWSER REQUIRED to trust).** The last structural
accessibility piece: how DOM focus enters and leaves a window's own content. Everything
else in FR-9 has landed — ARIA semantics, directional focus, group-local focus, focus
restoration, and the tab strip's roving tab stop. Focus behaviour is precisely the domain
where shipping unverified is malpractice. Exit: `Tab` from the command surface enters the
active window's body and cannot escape into an inactive window's content.

**The design, decided so the browser session only has to verify it, not invent it.** Two
decisions the entry left open, taken here with defensible defaults:

- **The id scheme** (`role="tab"` has no `aria-controls` because a frame has no DOM `id`). Mint a
  canvas **instance id** with React 19's `useId()` at the desktop root — it is built for exactly
  this (stable across renders, SSR-safe, unique per component instance) — and give every frame
  `id={`${instanceId}-${windowId}`}`. Two canvases on one page get disjoint namespaces from their
  own `useId()`; a window id is already unique within a canvas, so the pair is globally unique.
  `role="tab"` then points `aria-controls` at the active member's frame id. This stays out of the
  pure core (it is render-layer only) and does not touch serialized state, so persistence and undo
  replay are unaffected.
- **The trap policy.** A windowed app should behave like the OS it imitates: `Tab` cycles within
  the **active window's** body and does not leak into an inactive window's content or another
  window's chrome; `Escape` returns focus to the command surface (which
  `focusInfiniteCanvasCommandSurface` already does for Close/Minimize). Implement as a keydown
  handler on the active frame that, on `Tab`/`Shift+Tab` past the last/first focusable descendant,
  wraps within the body — the standard focus-trap, scoped to `[data-infinite-canvas-body]`. Do
  **not** trap when no window is active (the command surface owns Tab then).

Verification the browser session must do, because focus is not landable unverified: `Tab` from
the command surface enters the active body; `Tab` cycles inside it and cannot reach an inactive
window; `Escape` returns to chrome and every hotkey works again; a screen reader announces the
tab→panel relationship through the new `aria-controls`.

**The `aria-controls` half is DONE and browser-verified (2026-07-09).** The id-scheme decision
above is implemented: a window frame carries `id={`${instanceId}-window-${windowId}`}` with
`instanceId` from `useId()` at the desktop root, shared by the window and group layers, and a
group tab's `aria-controls` names its window's frame. Confirmed in the preview — every tab's
reference is correctly formed and the active tab's resolves to its rendered frame (inactive
panels mount lazily, so theirs resolve on activation). What remains of C5 is the **focus trap**
itself and the screen-reader pass — the parts that genuinely need sustained interactive
verification, not the discrete DOM check the `aria-controls` wiring only needed.

### What the 7 hours actually bought

_Written after, from the git log, not before from the plan._

**Landed, and unobserved.** Eight pre-existing defects found by reading, each traced end to
end and fixed: `maxPendingCaptures` blanking every window the capture queue refused;
`Alt`+drag dispatching `interaction.step` three times so `dockIntent` resolved to `false`; a
grouped window's dead resize handles burying the gutter between two panes; `scope="window"`
portals painting underneath the very window they belonged to, since `0.1.0`; a mid-drag zoom
sliding the window out from under the cursor, unboundedly; `window.nudge` detaching a group
member from its shell; the frustum probe sweeping its tracked set quadratically every frame;
a tab strip spending one tab stop per tab. Plus a hotkey collision **introduced and then
caught by audit** — `Mod+Alt+Arrow` switches browser tabs on macOS and is not
page-cancellable, so it would have switched the tab _and_ moved the window.

**P1 is capability-complete.** Every gesture in the spec lands: dock, shell move, shell
resize, seam reweight, tab tear-out, tab reorder. FOCUS-002 (contextual parent), FOCUS-003
(keyboard placement), and ACC-001 (accordion arrows follow the container's axis) all landed
too. `acceptance-scenarios.md` has no `unbuilt` entry left outside columns mode and the
hypothetical dashboard.

**Exactly one thing was observed.** The owner dragged a group shell edge. Everything else in
the list above is reasoned, typechecked, gated, and unwatched. `built` in the scenario doc
means "works when tried, nothing guards it" — and for these entries, nobody has tried them.
Both showcases were rewritten so that each claim can be falsified in a single gesture, which
is the only lever on verification available without a browser. `/portals` needed it most: it
had been demonstrating its own bug.

### What still stands between here and the three gates

- **npm publish** — nothing technical. An external-service action, the owner's.
- **Public repo** — one `git filter-repo` purge. Irreversible, no remote, owner-gated.
- **Production** — C2 (forbidden this session), C4 and C5 (both need a browser).

C2 needs no browser and is the largest remaining gap; it was out of scope only because tests
were explicitly forbidden. C4 + C5 are not blocked on knowledge but on the **ability to
observe**, and anything claiming them done without observation is the green checkmark this
project's conventions forbid.

**Therefore: `1.0` is not the deliverable. A publishable, public, honestly-scoped `0.2.0`
is** — with NFR-1 still marked failing and FR-9 still marked partial, because they are, and
the README already says so.

---

## Historical: the original "remaining 7 hours"

> Rewritten 2026-07-08. The original ordering (rename → `"use client"` →
> metadata → tarball proof) is **done**, as is the optional-3D split. What
> follows is what actually stands between the repo and a public, production
> release, ordered by what unblocks the most.

### Hour 0–1 — Class 2, the mechanical half: **DONE**

`/dynamic-grid` and `reference/` were the only things gating a **public
repository**. Neither ships in the npm tarball, so the package can be published
today; only the repo was blocked.

- ✅ `reference/` (80 files) untracked and `.gitignore`d. It stays on disk —
  the motion study is a living aesthetic reference — but leaves the tree that
  goes public. Non-destructive and reversible.
- ✅ The derived `/dynamic-grid` route and its showcase moved out of
  `apps/playground` into `reference/infinite-canvas-dynamic-grid/playground/`.
  Moving rather than `.gitignore`-in-place was the only stable option:
  `routeTree.gen.ts` is tracked and regenerated from whatever sits in
  `routes/`, so an ignored-but-present route file would leave that generated
  file permanently dirty. `routeTree.gen.ts` was hand-edited to exactly what the
  generator now emits.
- ✅ Playground nav is driven by each route's `staticData`, so the entry
  disappears with the file. `vite.config.ts` `ignorePatterns` and
  `tsconfig.json` `exclude` both tolerate a missing `reference/`, so a fresh
  clone builds.

**Still open, and it is the owner's call.** The derived implementation remains
reachable in git history, so a public repo leaks it regardless of `HEAD`.
Purging it means a history rewrite (`git filter-repo`) — irreversible, rewrites
every SHA, and this repo has no remote to recover from. An agent should not do
that unasked. Until it happens, the repo cannot go public; **the npm package can
be published now.**

### Hour 1–3 — FR-9: keyboard navigation between windows: **DONE**

The single largest gap between "works" and "production". `docs/REQUIREMENTS.md`
marks FR-9 `open`, and "production-ready" is not an honest claim for a window
manager you cannot drive from the keyboard.

Scope, deliberately narrow — no group model dependency, so it can land before P1:

- Directional focus (`Mod+Arrow`): pick the nearest window whose center lies in
  the arrow's half-plane, tie-broken by center distance. Pure geometry over
  `state.windows`; a new function in `camera-navigation.ts`'s neighbourhood.
- A new canonical command per direction, so pointer and keyboard keep compiling
  to the same vocabulary. Bind through `hotkeyBindings`, replaceable.
- Focus restoration: focusing a window scrolls it into view via the existing
  `navigateToWindow`, which already exists and is already tested.
- Acceptance: the _global geometric_ tier of FOCUS-001. The group-local tier
  it should prefer first needs P1 and is explicitly out of scope here.

✅ Landed as `window.focusDirection` (`Alt+Arrow`) over `src/window-focus.ts`,
plus two fixes the work exposed: the command surface now swallows any chord it
owns even when the command is unavailable (otherwise `Alt+ArrowLeft` at the edge
of your windows falls through to the browser's Back), and the Close/Minimize
controls hand DOM focus back before they unmount (otherwise focus lands on
`<body>` and every hotkey silently dies).

FR-9 is `partial`, not done.

**Updated 2026-07-08.** Group-local focus no longer "needs P1" — P1 landed, and
`window-focus.ts` now implements both tiers of FOCUS-001: inside a group the arrow
searches that group's members first and leaves it only when nothing lies that way.
Windows behind an inactive tab or a collapsed fold are never focus targets.

Also landed: **a group tab strip is one tab stop, not one per tab.** Each tab was a
natively focusable `<button>`, so Tab walked every tab of every group before reaching
anything else. The tablist now carries a roving `tabIndex` with Arrow / Home / End
between tabs, and manual activation (Enter / Space) — arrowing a strip under automatic
activation would mount and discard a window body per tab.

Still open, and these are what keep FR-9 `partial`:

- **Focus trapping**, and a documented path for DOM focus to enter and leave a
  window's own content. This is the last structural piece, and it is the one item
  here that genuinely wants a browser: focus behaviour is not something to land
  unverified.
- **`aria-controls` on `role="tab"`.** A window frame has no DOM `id` to point at,
  only `data-infinite-canvas-window-id`. Minting one requires deciding how ids stay
  unique across two canvases on a page.

### Hour 3–4 — API surface tiering: **DONE**

287 public names (354 as of 2026-07-08, after P1 and P4) is a maintenance liability
and a bad first read. This needed no new code, only honesty about what is stable.

- ✅ `@experimental` in TSDoc on `createInfiniteCanvasHandle`, the rasterization
  policy surface, and the six frustum-visibility exports. `docs/API.md` opens
  with a Stability section naming all three tiers.
- ✅ The frustum-visibility hooks were the find. They are **inert unless a scene
  surface is mounted with `diagnostics.frustum` on** — only the probe layer,
  which ships behind `/scene`, writes that store. `useInfiniteCanvasWindowFramed`
  returns its fallback forever otherwise, so a culling decision built on it would
  silently keep everything. `null` now documented as "unmeasured", never
  "offscreen".
- ✅ **Reversed this plan's own recommendation** about moving the ~40
  `getInfiniteCanvas*Scene*` helpers behind `/scene`. They are pure geometry —
  `scene-layer-geometry.ts` imports no `three` — and a consumer drawing window
  connectors into an SVG overlay needs them with no 3D engine anywhere. Moving
  them would force the 3D peers on someone who never asked for them, which is the
  exact problem the `/scene` split was made to solve.

### Hour 4–7 — P2 tranche 1 measurement, then P1 wiring

- ✅ **Wire the group core — DONE.** `InfiniteCanvasGroup` is in
  `InfiniteCanvasState`, nine canonical mutations are in the reducer, `group-layer.tsx`
  draws the shell, and persistence went to `version: 2` with `version: 1` migrating to
  `groups: []`. All four pointer gestures land (dock, shell move, seam reweight, tab
  tear-out). The invariant that made it tractable: **the group owns the layout and a
  member's `rect` is its projection**, which is what keeps snapping, selection bounds,
  camera framing, and the scene-layer proxies group-blind.
- **Measure tranche 1 — NOT DONE, and blocked.** It is committed and unmeasured. The
  profile's tables still describe the pre-tranche-1 runtime and say so. This needs the
  synthetic wheel/drag drivers on `/stress` at 20/40/80 windows in a real browser.
  Nothing downstream should quote a number until it is run.
- **Scenario tests for DOCK / SPLIT / TAB — NOT WRITTEN.** P1's exit criteria say
  "scenario tests green"; the gestures work and the tests do not exist. P1 is
  capability-complete and verification-empty, and the roadmap says so rather than
  ticking the box. Not written on 2026-07-08 because writing tests was explicitly out of
  scope for that session, not because the work is hard: the group core is pure, so every
  DOCK/SPLIT/TAB/ACC scenario is a reducer-level assertion. See Track C2, where four of the
  day's eight defects are mapped onto the scenarios that would have caught them.

### Not on the critical path, and why

- **Window-layer visibility culling** (P2 tranche 2). The profile ranked it
  third on the assumption that chrome reconciliation dominated; tranche 1 removed
  that. It now saves ~80% of _one style write per window_ and costs unmount
  semantics — an offscreen window loses scroll position, focus, and uncontrolled
  input state. On a window manager that is the bug that ruins the product.
- **html-in-canvas texture mode** (P2/P7). Needs Chrome 148+ with the Origin
  Trial flag. Real, big, and not gateable on CI yet.

## Open questions requiring the owner

- **`/dynamic-grid` + `reference/infinite-canvas-dynamic-grid/`**: (a) exclude
  from the public repo (keep private, playground-only locally), (b) clean-room
  rewrite the backdrop from first principles with no reference to the
  deobfuscated constants, or (c) publish as-is and accept the risk.
  **Recommendation: (a) now, (b) later** — the aesthetic goal ("build
  something better") already implies an original implementation, and the
  motion study can inform _taste_ without shipping _derived constants_.
- **`reference/`**: exclude from the public repo (recommendation) or keep.
- **Scope name**: `@infinite-canvas/react` (recommended; leaves room for
  `/core`, `/theme`, `/styled`) — requires creating the npm org.
