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
(quickstart compiled verbatim), `docs/API.md` generated from the barrel (287
names, all verified present in the built `.d.mts`), CI (node 22/24) and a
provenance release workflow, CONTRIBUTING / CODE_OF_CONDUCT / SECURITY /
CHANGELOG / issue + PR templates.

**Class 4 item 13 (optional 3D): DONE** — see below. Items 12 and 14 remain.

**Class 2 (cannot open-source) — STILL BLOCKING.** One step is mechanical and
one is destructive; see "The remaining 7 hours". The npm package is unaffected:
`/dynamic-grid` and `reference/` ship in neither the tarball nor the published
artifact. Only making the _repository_ public is gated.

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
[research/performance-profile.md](research/performance-profile.md)); P1's pure
group core (`group-tree.ts`, `group-layout.ts` — 1,057 lines, unwired).

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
14. **API surface audit** — 287 exports is a maintenance liability; mark
    experimental vs stable, consider moving scene helpers behind `/scene`.

## The remaining 7 hours

> Rewritten 2026-07-08. The original ordering (rename → `"use client"` →
> metadata → tarball proof) is **done**, as is the optional-3D split. What
> follows is what actually stands between the repo and a public, production
> release, ordered by what unblocks the most.

### Hour 0–1 — Class 2, the mechanical half (unblocks everything downstream)

`/dynamic-grid` and `reference/` are the only things gating a **public
repository**. Neither ships in the npm tarball, so the package can be published
today; only the repo is blocked.

- Untrack `reference/` (78 files) and the two `dynamic-grid` playground files
  from `HEAD`, and `.gitignore` them. They stay on disk — Tyler asked for the
  motion study as a living aesthetic reference — but leave the tree that goes
  public. Non-destructive and reversible.
- Delete the `/dynamic-grid` route from the playground's route table so the
  build does not break on a missing file for a fresh clone.

**Then stop and get an explicit go-ahead** for the destructive half: the derived
implementation is still reachable in git history, so a public repo leaks it
regardless of `HEAD`. Purging it means a history rewrite (`git filter-repo`),
which is irreversible and rewrites every SHA. That is the owner's call, not the
agent's — it cannot be undone, and the repo has no remote to recover from.

### Hour 1–3 — FR-9: keyboard navigation between windows

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

Exit: a keyboard-only session can open, focus, move, and close windows.

### Hour 3–4 — API surface tiering

287 public names is a maintenance liability and a bad first read. Nothing here
needs new code, only honesty about what is stable:

- Mark `createInfiniteCanvasHandle` and the scene-layer geometry helpers
  `@experimental` in TSDoc; `docs/API.md` already groups by module, so add a
  stability column.
- Decide whether the ~40 `getInfiniteCanvas*Scene*` helpers belong on the main
  entry at all, or behind `@infinite-canvas/react/scene` with the surface. They
  are only useful to someone already writing scene layers.

Exit: every export is either documented as stable or marked experimental.

### Hour 4–7 — P2 tranche 1 measurement, then P1 wiring

- **Measure tranche 1.** It is committed and unmeasured. The profile's tables
  still describe the pre-tranche-1 runtime and say so. Re-run the synthetic
  wheel/drag drivers on `/stress` at 20/40/80 windows and either confirm the
  prediction (pan and zoom both approach one style write per window) or find out
  the memo boundary is leaking. Do this before building anything on top of it.
- **Wire the group core.** `group-tree.ts` and `group-layout.ts` are pure,
  complete, and imported by nothing. Wiring is: `InfiniteCanvasGroup` into
  `InfiniteCanvasState`, docking mutations into the reducer, a group shell in the
  window layer. Persisted state goes to `version: 2`, with `version: 1` payloads
  migrating to `groups: []` — an optional field defaulting to empty would look
  backward-compatible right up until an older build silently ate a group layout
  on write-back.

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
