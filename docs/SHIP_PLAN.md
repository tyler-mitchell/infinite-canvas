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
the group core is wired, all four pointer gestures land, undo/redo and layout
recipes shipped with it. P1's scenario tests remain unwritten, so it is
capability-complete and verification-incomplete.

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

12. **Accessibility baseline (FR-9)** — currently `open`. ARIA semantics are
    done and locked by a test; **keyboard reachability between windows is not**.
    Still the largest gap before "production" is an honest claim.
13. ✅ **Optional 3D** — DONE, but not the way this item imagined. A lazy mount
    is insufficient: bundlers resolve dynamic-import specifiers at build time.
    It took an API seam (`@infinite-canvas/react/scene` + the `sceneSurface`
    prop). 40.1 KB gzipped without the 3D path.
14. **API surface audit** — the export surface is a maintenance liability; mark
    experimental vs stable, consider moving scene helpers behind `/scene`.
    _As of 2026-07-08 the main entry exports **194 values and 160 types**_ (the "287
    names" above was true when written, before P1/P4 landed groups, history, recipes,
    and portals). `docs/API.md` is **hand-maintained, not generated** — despite what
    this plan said — and it had silently drifted: undo/redo, layout recipes, and
    portals had no section in it at all, 43 public names in total. Now reconciled.
    ✅ **The drift gate now exists**: `scripts/verify-api-doc.mjs` asserts every barrel
    export appears in `docs/API.md`, and fails CI (before the build) and `prepublishOnly`
    otherwise. The next feature cannot go undocumented the same way.

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

Exit: **met.** An observable imported into `reducer.ts` fails CI; so does a `three` import
three hops away, reported with the full trail. Both negative-tested, along with the
type-only false-positive case and a stale root entry.

**C2 — P1 scenario tests (~2h, no browser).** P1's exit criteria say "scenario tests
green". The gestures work; the tests do not exist. DOCK-001..005, SPLIT-001..003,
TAB-001/002, ACC-001 are specified in `research/acceptance-scenarios.md` and are pure
reducer-level assertions — no DOM needed, because the group core is pure. This is the
single largest gap between "it works when I try it" and "it works". Exit: those scenario
ids assert against the reducer and pass.

_Two bugs found by reading on 2026-07-08 — dock intent dispatched three times, and dead
resize handles burying the gutter — would both have been caught by DOCK-001 and SPLIT-001.
That is the argument for C2, and it is not hypothetical._

**C3 — Group shell resize (~2h, no browser to build, browser to trust).** Reported by the
owner: a group's outer edge cannot be dragged. A `groupResize` interaction beside
`groupMove`/`groupGutter` stepping `group.rect`; members re-project for free. The real
work is the shell's minimum size — a function of every pane's `minSize` plus the gutters,
not a constant. Exit: dragging a shell edge resizes the group and no pane goes below its
`minSize`.

**C4 — NFR-1, the measurement (~2h, BROWSER REQUIRED).** P2 tranche 1 is committed and
unmeasured; the profile's tables still describe the pre-tranche-1 runtime. Nothing
downstream may quote a number until the synthetic wheel/drag drivers run on `/stress` at
20/40/80 windows. **`NFR-1` currently reads "failing" and must keep reading "failing"
until this runs.** Exit: the profile's tables describe the current runtime, and the
benchmark is scripted so a regression fails loudly rather than silently.

**C5 — FR-9 focus trapping (~2h, BROWSER REQUIRED to trust).** The last structural
accessibility piece: how DOM focus enters and leaves a window's own content. Everything
else in FR-9 has landed — ARIA semantics, directional focus, group-local focus, focus
restoration, and the tab strip's roving tab stop. Focus behaviour is precisely the domain
where shipping unverified is malpractice. Exit: `Tab` from the command surface enters the
active window's body and cannot escape into an inactive window's content.

### What "7 hours" actually buys

C1 + C2 + C3 ≈ 5 agent-hours and need **no browser**. They convert P1 from
capability-complete/verification-incomplete to actually done, close the owner's reported
bug, and stop two documents from lying again.

C4 + C5 ≈ 4 hours and **cannot be honestly completed without a browser**. They are not
blocked on knowledge; they are blocked on the ability to observe. Anything that claims
them done without observation is the green checkmark this project's own conventions
forbid.

**Therefore: `1.0` is not the deliverable at the end of 7 hours. A publishable, public,
honestly-scoped `0.2.0` is** — with NFR-1 still marked failing and FR-9 still marked
partial, because they are, and the README already says so.

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
  capability-complete and verification-incomplete, and the roadmap says so rather than
  ticking the box.

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
