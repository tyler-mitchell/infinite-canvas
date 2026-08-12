# Contributing to infinite-canvas

Thanks for taking an interest. This is a pre-1.0, hobby-scale project — issues, reproductions, and
focused pull requests are all welcome, and so is asking whether an idea is in scope before you build
it.

Repository: <https://github.com/tyler-mitchell/infinite-canvas>

---

## Prerequisites

- **Node.js `>=22.12.0`** (enforced by the root `engines` field).
- **pnpm 11.5.2** — pinned in the root `packageManager` field. The easiest way to get the right
  version is Corepack:

  ```bash
  corepack enable
  corepack prepare pnpm@11.5.2 --activate
  ```

- **The `vp` CLI** (Vite+). You do not need to install it globally: `vite-plus` is a workspace
  devDependency, so after `pnpm install` the binary exists at `node_modules/.bin/vp` and every
  command below works via `pnpm exec vp …`. If you already have `vp` on your `PATH`, you can drop
  the `pnpm exec` prefix.

## Getting set up

```bash
git clone https://github.com/tyler-mitchell/infinite-canvas.git
cd infinite-canvas
pnpm install
```

The workspace has three members:

| Path                       | Package                  | What it is                                           |
| -------------------------- | ------------------------ | ---------------------------------------------------- |
| `packages/infinite-canvas` | `@infinite-canvas/react` | The published library. This is the real thing.       |
| `apps/playground`          | `playground` (private)   | Showcase app — the consumer surface for the library. |
| `packages/ui`              | `ui` (private)           | Internal UI kit used **only** by the playground.     |

## The dev loop

```bash
pnpm exec vp run playground#dev
# or, equivalently, from the repo root:
pnpm dev
```

That starts the playground on <http://localhost:5173>.

The important detail: **the framework is source-linked.** `packages/infinite-canvas` exports
`./src/index.ts` directly during development (`publishConfig.exports` swaps in `./dist/index.mjs`
only at publish time). So the playground imports framework source, and edits to
`packages/infinite-canvas/src/**` hot-reload into the running app with **no build step and no watch
task**. If you find yourself running a build to see a change, something is wrong.

The flip side: because the dev loop never touches `dist/`, packaging bugs are invisible to it. Those
are caught separately — see [Packaging invariants](#packaging-invariants).

## The gate before you push

Run these two, in this order:

```bash
pnpm exec vp check        # lint + format + typecheck, whole workspace
pnpm exec vp run -r test  # every package's test suite
```

Or run everything, including the builds:

```bash
pnpm exec vp run infinite-canvas-monorepo#ready
```

(`ready` is the root script: `vp check && vp run -r test && vp run -r build`.)

A pull request that has not had `vp check` run on it will almost always fail on formatting. Run it.

### What the git hooks do, and what they cannot

`pre-commit` runs `vp staged`: lint and format, over **the files you staged**. It is fast and it
is structurally blind to the failure that matters most — a change to file A that breaks file B,
where B was never staged. On 2026-07-08, making `isGrouped` a required prop on
`InfiniteCanvasWindowFrame` broke two test files exactly that way, and nothing noticed across six
clean commits, because neither test was ever part of one.

`pre-push` therefore runs the whole-workspace static gates: `vp check` (about four seconds),
plus the API-doc, pure-core, **and API-stability** assertions — read the hook rather than this
sentence if they ever disagree, because this one omitted the third for as long as it existed. Tests and builds stay in CI, where a red run costs
nobody's attention mid-flow and where a hook slow enough to be resented would just get disabled.

`VITE_GIT_HOOKS=0 git push` skips it. If you do that, CI is the only thing left between you and
a broken `main`.

---

## Adding a showcase

Showcases live in the playground and are discovered automatically. Add a route file under
`apps/playground/src/routes/` that declares `staticData.showcase` on the route — the sidebar picks it
up without any registration step:

```tsx
// apps/playground/src/routes/my-showcase.tsx
import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/my-showcase")({
  component: MyShowcase,
  staticData: {
    showcase: {
      title: "My Showcase",
      description: "One sentence on what this demonstrates.",
      order: 7,
    },
  },
});

function MyShowcase() {
  return null;
}
```

Keep showcases **deterministic**: fixed initial layouts, persistence off unless the demo is
specifically about persistence. A showcase that renders differently on every reload is not a demo,
it's a flake. `apps/playground/src/routes/welcome.tsx` is the smallest complete example.

Note that Tailwind, `lucide-react`, and the internal `ui` kit are all fair game **inside the
playground**. They are not fair game inside the framework — which brings us to the part people get
wrong.

---

## The two invariants contributors most often break

Both are enforced now, so you will find out either way — but it is still worth knowing why.

This paragraph used to say the second "is not enforced by anything — it holds because nobody
has broken it". That stopped being true on 2026-07-08, when `verify-pure-core.mjs` landed; the
section below was updated to describe the two things that guard it and this introduction was
not, so the file contradicted itself sixty lines apart. Corrected 2026-08-12, alongside the
identical defect in `README.md`, where the same claim had gone stale in the same direction.

### 1. The framework package is headless

`packages/infinite-canvas/src/**` carries no visual identity of its own. Concretely, framework
source must not:

- import an icon library (`lucide-react` and friends), or
- emit a literal `className="…"` string — which means **no Tailwind utility classes**, since that is
  how they'd have to arrive.

Components forward the consumer's `className` / `style` props and tag every structural element with
`data-slot="…"`. Appearance is the job of `packages/infinite-canvas/src/theme.css`, an **opt-in**
stylesheet that targets that `data-slot` contract. The framework writes `--icx-*` custom properties
only for the theme keys a consumer actually passes, so an unstyled canvas really is unstyled.

The two **debug overlays** — `raster-devtools.tsx` and `visibility-devtools.tsx` — are the standing
exception, and they are styled with inline `style` objects rather than classes so the boundary test
still passes over them. They render only behind the `rasterization` and `diagnostics.frustum` opt-ins
and are not public exports. A debug panel that inherits your theme is a debug panel you cannot read.
Nothing else in `src/**` may carry colour: `constants.ts` holds `DEFAULT_INFINITE_CANVAS_THEME`,
whose only jobs are to fill gaps in a partial `theme` prop and to feed the WebGPU surface, which
cannot read CSS variables.

The slot vocabulary is the public styling contract and lives in
`packages/infinite-canvas/src/data-attributes.ts` (`INFINITE_CANVAS_SLOTS`). If you render a new
structural element, add its slot there and style it in `theme.css` — do not reach for a class name.
Two things to know:

- `data-slot` is **presentational**. The separate `data-infinite-canvas-*` attributes are a
  _behavioral_ contract and must not be used as styling hooks.
- `theme.css` and the theme tokens are kept in sync by `src/theme-tokens.test.ts`, which also fails
  if `theme.css` targets a `data-slot` that doesn't exist in the contract. A selector typo cannot
  silently style nothing.

Enforced by: `packages/infinite-canvas/src/headless-boundary.test.ts` (and
`src/theme-tokens.test.ts`).

Icons are injected, not imported: see `DEFAULT_INFINITE_CANVAS_ICONS` / `useInfiniteCanvasIcons` in
`src/icons.tsx`. Window chrome is replaceable via `renderFrame`.

### 2. The pure core stays pure

Geometry, the reducer, selection, and snapping are plain data in / plain data out. They must not
reach for React, `three`, or `@legendapp/state`. That is what makes the state model testable,
serializable, and drivable from outside a React tree — the same property the programmatic handle and
the persistence layer depend on.

The files under this rule:

```
src/geometry.ts       src/reducer.ts        src/commands.ts
src/selection.ts      src/camera-navigation.ts
src/snap.ts  src/snap-candidates.ts  src/snap-resolver.ts  src/snap-types.ts
src/state.ts  src/factory.ts  src/registry.ts  src/validation.ts  src/types.ts
```

If you need reactivity, do it in the store/component layer (`src/store.tsx`,
`src/infinite-canvas.tsx`) and keep the transition itself a pure function of `(state, action)`.

Guarded by two things, which check different halves of the claim:

- `packages/infinite-canvas/src/framework-boundary.test.ts` drives the core end-to-end —
  factories, registry normalization/recovery, window proxies, validation — through non-React
  entry points, so the core has to keep _standing up_ without a renderer.
- `packages/infinite-canvas/scripts/verify-pure-core.mjs` crawls the real import graph from every
  pure-core root and fails if any of them can _reach_ `react`, `@legendapp/state`, `three`,
  `@react-three/fiber`, or `@zumer/snapdom`. Type-only imports are ignored, because
  `import type { … }` and `import { type X }` erase before runtime. Runs in CI and before publish:

  ```bash
  pnpm exec vp run @infinite-canvas/react#verify:pure-core
  ```

  Until 2026-07-08 this file and `README.md` both claimed a test enforced the import boundary.
  **No such test existed** — the rule held by construction and by reading, and nothing stopped the
  next contributor from importing an observable into `reducer.ts`. Now something does.

### Adding a public export

Anything you add to `src/index.ts` or `src/scene.ts` must also appear in
[`docs/API.md`](docs/API.md), which the README calls "the full export surface".
`packages/infinite-canvas/scripts/verify-api-doc.mjs` enforces it, in CI and before publish.
It reads source rather than `dist/`, so you can run it without a build:

```bash
pnpm exec vp run @infinite-canvas/react#verify:api-doc
```

It once drifted by 43 names — undo/redo, layout recipes, and portals had no section at all —
which is why it is a gate rather than a convention. The parser understands only re-export
blocks (`export { … } from`, `export type { … } from`). Add an `export const` or an
`export * from` to a barrel and the gate **fails on purpose**: it would otherwise pass while
blind to exactly the surface you just introduced. Teach it the new form, or keep the barrels
as re-exports.

### Two invariants held by tests rather than scripts

These are ordinary Vitest files, so `vp run -r test` finds them, but they guard structure
rather than behaviour and are easy to mistake for redundant.

- `src/command-coverage.test.ts` types a map of **every** action as
  `Record<InfiniteCanvasAction["type"], …>`, so adding an action fails the typecheck until it
  is classified: either it names a command that reaches it, or it declares which of four
  reasons makes it deliberately chromeless. The command registry feeds hotkeys, the palette,
  and contextual availability, and it had drifted to roughly half the reducer's vocabulary
  before this existed — every window-lifecycle verb was reachable only as an `onClick`.
- `src/single-dispatcher.test.ts` reads the source and fails if any module other than
  `infinite-canvas.tsx` calls `stepInteraction`. Two dispatchers for one pointer event is a
  race whose loser is whichever handler knows less about the modifiers; the friction backlog
  recorded that lesson once and four dispatchers survived the fix it produced.

### Packaging invariants

`packages/infinite-canvas/scripts/verify-artifact.mjs` runs against the **built** `dist/` and
asserts what the source-linked dev loop can't see:

- `"use client"` is the first statement of `dist/index.mjs` (RSC consumers break otherwise),
- `@zumer/snapdom` stays a dynamic import and never gets hoisted into every consumer bundle,
- nothing is imported that isn't a declared `dependency` or `peerDependency`,
- every path in `publishConfig.exports` exists and the `.d.mts` emit actually resolves,
- `LICENSE` and `README.md` sit in the **package** root, because npm packs them from beside
  `package.json` and not from the repository root — `files` is `["dist"]`, so the tarball
  carried no licence text at all until 2026-08-12 while its manifest declared MIT,
- every name the package `README.md` imports in a code fence is still exported. That file is
  what npm renders on the package page and it ships inside the tarball, so a rename would
  leave the front page telling every new consumer to import something that no longer exists.

Run it after a build:

```bash
pnpm exec vp run @infinite-canvas/react#verify   # build, then verify dist/
```

It also runs on `prepublishOnly`. If you add an import to the library, this is the script that will
tell you it wasn't allowed.

---

## Pull requests

- **Branch from `main`.** Keep the PR focused; one behavioral change per PR reviews far better than
  five.
- **Commit style is loose.** Write an imperative subject line that says what changed and why it
  matters (`Restore body-content memoization; 4-13x interactive speedup at stress scale` beats
  `fix perf`). Conventional Commits are welcome but not required, and history is not linted.
- **New behavior needs a test.** The library's tests live next to the code they cover
  (`src/*.test.ts`). Bug fixes should come with the failing case.
- **User-facing changes need a changelog entry.** Add a bullet under `## [Unreleased]` in
  [`CHANGELOG.md`](./CHANGELOG.md), in the appropriate `Added` / `Changed` / `Fixed` / `Removed`
  section. The format is [Keep a Changelog](https://keepachangelog.com/en/1.1.0/) and the package
  follows [Semantic Versioning](https://semver.org/spec/v2.0.0.html). Internal refactors, test-only
  changes, and playground tweaks don't need an entry. If it changes the public API, the rendered
  DOM, the `data-slot` contract, or the serialized persistence shape, it does.
- **Public API changes should be discussed first.** Open an issue. The package is `0.1.x` and things
  can move, but they should move on purpose.

## Reporting bugs and requesting features

Use the issue forms at
<https://github.com/tyler-mitchell/infinite-canvas/issues/new/choose>. For bugs, the single most
useful thing you can include is a minimal reproduction — a showcase route is an excellent format for
one.

**Security vulnerabilities do not go in public issues.** See [SECURITY.md](./SECURITY.md).

## Code of Conduct

Participation is governed by the [Contributor Covenant](./CODE_OF_CONDUCT.md).
