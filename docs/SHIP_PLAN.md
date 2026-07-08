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

## Status — 2026-06-24

**Class 1 (cannot publish): DONE.** Renamed to `@infinite-canvas/react`;
`"use client"` re-asserted as the bundle's first statement; full npm metadata,
`sideEffects: ["**/*.css"]`, provenance; peers widened off the exact R3F canary.
`scripts/verify-artifact.mjs` is the standing gate, wired to `prepublishOnly`.
Proven with `pnpm pack` -> install into a fresh project outside the workspace
-> `tsc --noEmit` against the published `.d.mts` -> esbuild bundles at exit 0
-> theme.css subpath resolves. `pnpm publish --dry-run` runs the whole
pipeline and resolves to `@infinite-canvas/react@0.1.0` on the registry.

**Class 3 (nobody would trust it): DONE.** LICENSE, root README, npm README
(quickstart compiled verbatim), `docs/API.md` generated from the barrel (285
names, all verified present in the built `.d.mts`), CI (node 22/24) and a
provenance release workflow, CONTRIBUTING / CODE_OF_CONDUCT / SECURITY /
CHANGELOG / issue + PR templates.

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

**Class 2 (cannot open-source) — STILL BLOCKING, owner decision required.**
See "Open questions" below. The npm package is unaffected: `/dynamic-grid` and
`reference/` are playground/repo-only and ship in neither the tarball nor the
published artifact. Only making the _repository_ public is gated.

**Class 4 (production hardening) — remaining, in value order:** the optional-3D
bundle split (`three` + `@react-three/fiber` are hard peers, statically
imported, even for consumers who never pass `sceneLayers`); keyboard navigation
between windows; API surface tiering (155 values + 131 types).

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

12. **Accessibility baseline (FR-9)** — currently `open`. Windows/controls
    need ARIA semantics and keyboard reachability before "production" is an
    honest claim.
13. **Optional 3D**: make the WebGPU surface lazily mounted so consumers who
    never pass `sceneLayers` don't ship three.js. Large win, medium risk.
14. **API surface audit** — 200+ exports is a maintenance liability; mark
    experimental vs stable, consider an `/internal` subpath.

## The 7-hour execution order

Serial critical path (must be done in order, owned start-to-finish):

1. **Rename** to `@infinite-canvas/react` (touches everything downstream).
2. **Fix `"use client"`** preservation + prove it in dist.
3. **Metadata, peers, `sideEffects`, LICENSE.**
4. **Tarball consumability proof** in a scratch app — the ground-truth gate.

Parallelizable once the name is fixed:

- CI workflows (test + release with provenance).
- Root README, package README, CONTRIBUTING, CODE_OF_CONDUCT, templates.
- CHANGELOG + changesets.
- API reference generated from the public barrel.

Then, as time allows, in value order: **accessibility baseline** →
**optional-3D bundle split** → **API surface tiering**.

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
