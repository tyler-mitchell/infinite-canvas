# Contributing to Infinite Canvas

This pre-1.0 project accepts issues, reproductions, focused pull requests, and questions about scope.

Repository: <https://github.com/tyler-mitchell/infinite-canvas>

## Prerequisites

Install Node.js `>=22.12.0`.

The root `engines` field enforces this version.

Enter these commands to install pnpm 11.5.2:

```bash
corepack enable
corepack prepare pnpm@11.5.2 --activate
```

The root `packageManager` field pins this pnpm version.

The workspace supplies `vp` through the `vite-plus` development dependency.

After `pnpm install`, enter Vite+ commands through `pnpm exec vp …`.

The binary is at `node_modules/.bin/vp` after installation.

If `vp` is on `PATH`, omit the `pnpm exec` prefix.

## Install the workspace

```bash
git clone https://github.com/tyler-mitchell/infinite-canvas.git
cd infinite-canvas
pnpm install
```

The library development path uses these workspace members:

| Path                       | Package                     | Purpose                              |
| -------------------------- | --------------------------- | ------------------------------------ |
| `packages/infinite-canvas` | `@hyphened/infinite-canvas` | Published library                    |
| `apps/playground`          | `playground` (private)      | Showcase and integration application |
| `packages/ui`              | `ui` (private)              | Shared React component package       |

## Start the playground

```bash
pnpm exec vp run playground#dev
# or, equivalently, from the repo root:
pnpm dev
```

The playground starts at <http://localhost:5173>.

During development, `packages/infinite-canvas` exports `./src/index.ts` directly. For publication, `publishConfig.exports` replaces this path with `./dist/index.mjs`.

The playground imports source and hot-reloads framework changes. A build or watch task is not necessary.

The development loop does not inspect `dist/`. The packaging gate finds errors in published artifacts.

See [Packaging invariants](#packaging-invariants).

## Validate changes

Enter these commands in order:

```bash
pnpm exec vp check        # lint + format + typecheck, whole workspace
pnpm exec vp run -r test  # every package's test suite
```

Enter this command to include all builds:

```bash
pnpm exec vp run infinite-canvas-monorepo#ready
```

The `ready` script invokes `vp check && vp run -r test && vp run -r build`.

The first validation command invokes `vp check`. The second invokes `vp run -r test`.

### Git hooks

The `pre-commit` hook invokes `vp staged` for staged files. It also invokes the API-doc, pure-core, and API-stability source gates. It cannot find type errors in dependent files that are not staged.

For example, a staged `InfiniteCanvasWindowFrame` change can break an unstaged consumer of `isGrouped`.

The `pre-push` hook invokes `vp check` and the API-doc, pure-core, and API-stability gates. CI invokes tests and builds.

If you enter `VITE_GIT_HOOKS=0 git push`, the push skips the local hook. CI then provides the other gates.

## Add a showcase

Showcases are route files in `apps/playground/src/routes/`.

Add `staticData.showcase` to the route:

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

The sidebar discovers these routes without a separate registration step.

Use fixed initial layouts. If the showcase does not demonstrate persistence, disable persistence.

The smallest full example is `apps/playground/src/routes/welcome.tsx`.

The playground can use Tailwind, `lucide-react`, and the internal `ui` kit.

Do not import these dependencies into the framework.

## Framework boundaries

### Keep the framework headless

Framework source in `packages/infinite-canvas/src/**` has no built-in visual design.

This restriction applies to all files in `packages/infinite-canvas/src/**`.

Obey these restrictions:

- Do not import `lucide-react` or another icon library
- Do not emit a literal `className="…"` string
- Do not add Tailwind utility classes.

Components forward the consumer `className` and `style` props. Each structural element has a `data-slot="…"` attribute.

Appearance belongs to `packages/infinite-canvas/src/theme.css`. The optional `theme.css` file targets the `data-slot` contract.

Add new appearance rules to `theme.css`.

Consumer style rules can override `theme.css`.

The framework writes only the `--icx-*` custom properties that a consumer supplies.

The debug overlays `raster-devtools.tsx` and `visibility-devtools.tsx` are the only exceptions. They use inline `style` objects and are not public exports.

The `rasterization` and `diagnostics.frustum` properties control these overlays.

Other source files must not include colors. `constants.ts` contains `DEFAULT_INFINITE_CANVAS_THEME` for partial `theme` values and the WebGPU surface.

The WebGPU surface cannot read CSS variables.

The `data-slot` contract is `INFINITE_CANVAS_SLOTS` in `packages/infinite-canvas/src/data-attributes.ts`.

Add each new structural slot to this contract.

Use `data-slot` for presentation. Use `data-infinite-canvas-*` attributes only for behavior.

The `src/theme-tokens.test.ts` file keeps the theme tokens, CSS, and slot contract synchronized. It also rejects unknown slot selectors.

These files enforce the headless boundary:

- `packages/infinite-canvas/src/headless-boundary.test.ts`
- `src/theme-tokens.test.ts`.

The framework injects icons through `DEFAULT_INFINITE_CANVAS_ICONS` and `useInfiniteCanvasIcons` in `src/icons.tsx`. The `renderFrame` property replaces window chrome.

### Keep the core pure

Geometry, the reducer, selection, and snapping accept and return plain data. They must not import React, `three`, or `@legendapp/state`.

This boundary keeps the state model testable and serializable. It also supports non-React programmatic access and persistence.

An invalid dependency in `reducer.ts` fails the import gate.

This rule applies to these files:

```
src/geometry.ts       src/reducer.ts        src/commands.ts
src/selection.ts      src/camera-navigation.ts
src/snap.ts  src/snap-candidates.ts  src/snap-resolver.ts  src/snap-types.ts
src/state.ts  src/factory.ts  src/registry.ts  src/validation.ts  src/types.ts
```

If code needs reactivity, add it to `src/store.tsx` or `src/infinite-canvas.tsx`. Keep each transition a pure function of `(state, action)`.

Two gates enforce this contract:

- `packages/infinite-canvas/src/framework-boundary.test.ts` exercises the core through non-React entry points.
- `packages/infinite-canvas/scripts/verify-pure-core.mjs` examines import paths from each pure-core root.

The framework boundary test covers factories, registry normalization and recovery, window proxies, and validation.

The `verify-pure-core.mjs` gate rejects paths to `react`, `@legendapp/state`, `three`, `@react-three/fiber`, and `@zumer/snapdom`.

It ignores `import type { … }` and `import { type X }`.

CI and `prepublishOnly` invoke this gate.

Enter this command to invoke the import gate:

```bash
pnpm exec vp run @hyphened/infinite-canvas#verify:pure-core
```

### Document public exports

Add each new export from `src/index.ts` or `src/scene.ts` to [`docs/API.md`](docs/API.md).

The `packages/infinite-canvas/scripts/verify-api-doc.mjs` gate reads source and does not require a build:

```bash
pnpm exec vp run @hyphened/infinite-canvas#verify:api-doc
```

CI and `prepublishOnly` invoke this gate.

The parser accepts `export { … } from` and `export type { … } from` blocks. It rejects `export const` and `export * from` declarations.

If a new export form is necessary, add parser support. Otherwise, keep the barrel files as re-exports.

### Keep structural tests

The `src/command-coverage.test.ts` file maps every direct action type to a descriptor or chromeless reason.

The command registry supplies hotkeys, the command palette, and contextual availability.

A new action fails the type check until its classification exists.

The `src/single-dispatcher.test.ts` file permits `stepInteraction` calls only in `infinite-canvas.tsx`. This rule prevents duplicate handling of one pointer event.

### Packaging invariants

The `packages/infinite-canvas/scripts/verify-artifact.mjs` file examines the built `dist/` directory. It enforces these package facts:

- `"use client"` is the first statement in `dist/index.mjs`
- `@zumer/snapdom` remains a dynamic import
- Each imported package is a declared `dependency` or `peerDependency`
- Each `publishConfig.exports` path exists
- Each `.d.mts` output resolves
- `LICENSE` and `README.md` are in the package root
- Each package `README.md` import is still exported.

The package `README.md` sits beside `package.json`. The `files` field is `["dist"]`.

npm includes the package-root `README.md` and `LICENSE` outside `dist/`.

After a build, enter this command:

```bash
pnpm exec vp run @hyphened/infinite-canvas#verify   # build, then verify dist/
```

The `prepublishOnly` script also invokes this gate.

## Pull requests

- Create a branch from `main`
- Keep each pull request to one behavioral change
- Use a Conventional Commit subject
- Add a test for new behavior
- Add the prior error case for each bug fix.

Library tests are in `src/*.test.ts`.

The legacy subject `Restore body-content memoization; 4-13x interactive speedup at stress scale` gives more detail than `fix perf`. New commits use Conventional Commits.

For consumer-visible package changes, add one maintained bump file in `.bumpy`.

Bumpy writes entries in `## [Unreleased]` in [`CHANGELOG.md`](./CHANGELOG.md). It assigns entries to `Added`, `Changed`, `Fixed`, or `Removed`.

The changelog follows [Keep a Changelog](https://keepachangelog.com/en/1.1.0/). The package follows [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

The package is `0.2.x`. Do not edit the generated changelog.

Consumer-visible changes include public API, rendered DOM, `data-slot`, persistence, runtime dependencies, and package documentation.

Before you implement a public API change, discuss it in an issue.

## Report bugs and request features

Use the issue forms at <https://github.com/tyler-mitchell/infinite-canvas/issues/new/choose>.

For a bug, include a minimal reproduction. A showcase route is a suitable reproduction.

Do not report security vulnerabilities in public issues. Read [SECURITY.md](./SECURITY.md).

## Code of conduct

The [Contributor Covenant](./CODE_OF_CONDUCT.md) governs participation.
