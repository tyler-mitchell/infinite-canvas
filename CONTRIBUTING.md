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

The first is enforced by `src/headless-boundary.test.ts`, so you will find out. The
second is not enforced by anything — it holds because nobody has broken it. Either
way, better to know why.

### 1. The framework package is headless

`packages/infinite-canvas/src/**` carries no visual identity of its own. Concretely, framework
source must not:

- import an icon library (`lucide-react` and friends), or
- emit a literal `className="…"` string — which means **no Tailwind utility classes**, since that is
  how they'd have to arrive.

Components forward the consumer's `className` / `style` props and tag every structural element with
`data-slot="…"`. Appearance is the job of `packages/infinite-canvas/src/theme.css`, an **opt-in**
stylesheet that targets that `data-slot` contract.

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

Guarded by: `packages/infinite-canvas/src/framework-boundary.test.ts`, which drives the core
end-to-end — factories, registry normalization/recovery, window proxies, validation — through
non-React entry points, so the core has to keep standing up without a renderer.

### Packaging invariants

`packages/infinite-canvas/scripts/verify-artifact.mjs` runs against the **built** `dist/` and
asserts what the source-linked dev loop can't see:

- `"use client"` is the first statement of `dist/index.mjs` (RSC consumers break otherwise),
- `@zumer/snapdom` stays a dynamic import and never gets hoisted into every consumer bundle,
- nothing is imported that isn't a declared `dependency` or `peerDependency`,
- every path in `publishConfig.exports` exists and the `.d.mts` emit actually resolves.

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
