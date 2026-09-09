# Widget Runtime Research

The runtime `polkadot-ui` widgets live in: the app shell that hosts them, the primitives they are
assembled from, the motion machinery that moves them, and the GPU world they act inside.

Objective: choose the substrate for a widget motion system and a spatial design language, and own
no machinery a maintained library already provides.

## Contract

Target identity: this repository at `packages/polkadot-ui`. Versions recorded per finding.
Retrieved 2026-09-09.

Scoped questions:

| #   | Question                                               | State                                   |
| --- | ------------------------------------------------------ | --------------------------------------- |
| 1   | Can TanStack Start run on this workspace's toolchain?  | **answered — no**, runtime-proven       |
| 2   | What shell does Vite+ support instead?                 | answered — SPA; no SSR story documented |
| 3   | Which primitives Base UI owns, so none are hand-rolled | answered — 48 primitives, enumerated    |
| 4   | Which motion affordances `motion` v12 owns             | answered — surface enumerated           |
| 5   | What remains genuinely ours after 3 and 4              | answered — the tokens, and nothing else |
| 6   | Canonical R3F project shape at the installed version   | open                                    |
| 7   | Can R3F and TypeGPU share one WebGPU device?           | open                                    |
| 8   | Motion-system and ZUI precedence worth copying         | open                                    |

Out of scope, deliberately: `@hyphened/infinite-canvas`, `packages/ui`, and everything under
`apps/`. This package adopts none of that tooling and integrates with none of it.

## Implementation map

| Build need             | Affordance                       | Project implication                                 | Status         |
| ---------------------- | -------------------------------- | --------------------------------------------------- | -------------- |
| App shell              | TanStack Start `1.168.50`        | rejected — SSR middleware does not mount on Vite+   | runtime-proven |
| App shell              | TanStack Router + `<Outlet>` SPA | adopt; Start becomes a later swap, routes unchanged | target         |
| Interaction primitives | `@base-ui/react` 1.5.0           | 48 primitives; every one comes from here            | observed       |
| Class composition      | `tailwind-variants` 3.3.1        | slot fns already merge `className` — no helper      | observed       |
| Springs, layout, drag  | `motion` 12.40.0                 | `useSpring`, `layout`+`LayoutGroup`, `Reorder`      | observed       |
| Frame loop             | `motion` `useAnimationFrame`     | no bespoke clock                                    | observed       |
| Motion tokens          | `motion` `MotionConfig`          | one place for duration, easing, reduced-motion      | target         |
| Widget packing         | none yet                         | evaluate a grid library when a board exists         | unresolved     |

## 1. TanStack Start does not run on this workspace's toolchain

Start declares Vite as a peer with a floor of 7.

```sh
npm view @tanstack/react-start@latest version peerDependencies
```

```txt
version = '1.168.50'
peerDependencies = { vite: '>=7.0.0', react: '>=18.0.0 || >=19.0.0', ... }
```

The workspace resolves `vite` to a different product entirely, and the override reaches every
package, so no single package can opt out.

```yaml
# pnpm-workspace.yaml
catalog:
  # Keep these packages aligned. Version 0.1.24 served Start routes as 404.
  vite: npm:@voidzero-dev/vite-plus-core@0.2.9
overrides:
  vite: "catalog:"
peerDependencyRules:
  # The peer check is silenced, not satisfied — so a green install proves nothing here.
  allowAny: [vite]
```

`@voidzero-dev/vite-plus-core` is not a Vite release under another name; its dependency set is an
oxc/Rolldown toolchain with no Vite in it.

```sh
npm view @voidzero-dev/vite-plus-core@0.2.9 dependencies
```

```txt
{ postcss, lightningcss, yuku-parser, yuku-codegen, @oxc-project/types, @oxc-project/runtime }
```

### The observed failure

Start was installed into this package and the canonical shell was written from the authors' own
shipped skill (`@tanstack/react-start/skills/react-start/SKILL.md`): `tanstackStart()` before
`react()`, a `getRouter()` factory, and a `__root.tsx` rendering the whole document.

```sh
cd packages/polkadot-ui && vp dev --port 3210
```

```txt
  VITE+ v0.2.9
  ➜  Local:   http://localhost:3210/
```

The server starts. The route does not exist.

```sh
curl -s -o /dev/null -w "status=%{http_code}\n" http://localhost:3210/
curl -s http://localhost:3210/
```

```txt
status=404
<pre>Cannot GET /</pre>
```

The failure is precisely half of the plugin. Route generation ran — the generator wrote its tree
on first boot:

```txt
app/routeTree.gen.ts   1741 bytes   (written by tanstackStart, not by hand)
```

What did not run is the SSR request handler. `Cannot GET /` is a bare server default, meaning the
request reached a listener with no Start route mounted. This matches the account already recorded
in this repository:

```md
<!-- apps/polkadot/AGENTS.md -->

Start's dev middleware never mounted because `vite` here is aliased to `vite-plus-core`,
whose version fails Start's peer range.
```

Project use:

- Start is rejected as the shell until the toolchain changes. The generator working is a trap: the
  build looks configured and the app serves nothing.
- Unblocking it needs a real Vite 7, which means editing the root `pnpm-workspace.yaml` — outside
  this package's ownership and a change to every other package's toolchain.
- The two recorded reasons (404 at 0.1.24; middleware never mounting at 0.2.9) are the same
  symptom a version apart. Preserved as one finding with two observations.

Status: runtime-proven (404 observed against `vp dev` in this package, 2026-09-09).

## 2. Vite+ documents no SSR or middleware-mode shell

Vite+ presents `vp dev` as the plain Vite dev server and points at Vite's own docs for anything
beyond plugins, aliases, `server`, and env modes.

```md
<!-- node_modules/vite-plus/docs/guide/dev.md -->

`vp dev` runs the standard Vite development server through Vite+...
Use standard Vite config in `vite.config.ts`.
```

Its agent-facing and troubleshooting docs mention neither TanStack nor SSR:

```sh
grep -rn -i "tanstack\|ssr\|middlewareMode" \
  node_modules/vite-plus/AGENTS.md \
  node_modules/vite-plus/docs/guide/troubleshooting.md \
  node_modules/vite-plus/docs/guide/migrate.md
```

```txt

```

`vp create` does list `@tanstack/start` as a recognized shorthand, but that scaffolds a standalone
project with its own real Vite — it is not a statement that Start runs under `vp dev`.

```md
<!-- node_modules/vite-plus/docs/guide/create.md -->

- Use shorthand templates like `vite`, `@tanstack/start`, `svelte`, `next-app`, ...
```

Project use:

- The shell is a client-rendered SPA on TanStack Router, with nested `<Outlet>` layouts for the
  showcase. That is what the current need actually calls for.
- Nothing about the route files changes if Start becomes available later: `createFileRoute`,
  loaders and `<Outlet>` are Router APIs. Only the entry and the document move.

Status: observed.

## 3. Hand-rolled machinery removed

An earlier pass in this package wrote a spring integrator, a frame clock, and a board engine that
drove layout by writing transforms to DOM nodes each frame. `motion` owns all three behaviours.
The files were deleted rather than kept as a fallback:

```txt
src/board/board-engine.ts   removed
src/board/board.tsx         removed
src/board/board-context.ts  removed
src/lib/frame-clock.ts      removed
src/geometry/spring.ts      removed
src/widget/widget.tsx       removed  (rebuild on Base UI)
```

A second pass deleted the rest. An earlier version of this section claimed the geometry module was
"the part with no library owner" and kept it. That was wrong on two counts: most of it duplicates a
maintained library, and **none of it had a consumer** — it was written for a board that does not
exist.

```txt
src/geometry/pack.ts      removed  →  a grid library, when a board exists
src/geometry/lattice.ts   removed  →  same
src/geometry/spline.ts    removed  →  d3-shape `curveMonotoneX`
src/geometry/range.ts     removed  →  d3-scale
src/geometry/momentum.ts  removed  →  motion `useVelocity`
src/geometry/rect.ts      removed  →  trivial
src/lib/slot-class.ts     removed  →  tailwind-variants already merges `className`
src/lib/cn.ts             removed  →  nothing needed it once slot-class went
src/components/widget.tsx removed  →  bespoke compound; rebuild from a plan
```

Status: observed — 721 lines deleted, `vp check` clean across the 11 that remain.

## 4. What Base UI and `motion` own

Base UI 1.5.0 declares 48 component subpaths plus the composition hooks. Read from its
`package.json` `exports`:

```txt
accordion, alert-dialog, autocomplete, avatar, button, checkbox, checkbox-group, collapsible,
combobox, context-menu, dialog, drawer, field, fieldset, form, input, menu, menubar, meter,
navigation-menu, number-field, otp-field, popover, preview-card, progress, radio, radio-group,
scroll-area, select, separator, slider, switch, tabs, toast, toggle, toggle-group, toolbar, tooltip
· plus: use-render, merge-props, direction-provider, csp-provider, unstable-use-media-query
```

`motion` 12.40.0 (re-exporting framer-motion 12.40.0) covers the whole motion layer:

```txt
values   useMotionValue useSpring useTransform useMotionTemplate useVelocity useTime useFollowValue
layout   motion m LayoutGroup AnimatePresence MotionConfig LazyMotion useIsPresent usePresence
drag     Reorder Reorder.Group Reorder.Item useDragControls
loop     useAnimationFrame animate scroll inView useInView useScroll
control  useReducedMotion MotionGlobalConfig useInstantTransition useInstantLayoutTransition
```

Project use, and this is the finding that mattered:

- **`Reorder` ships drag-to-reorder.** The board's drag-and-reflow is not ours to write.
- **`layout` plus `LayoutGroup` ships FLIP.** The masonry reflow is a prop, not an engine.
- **`MotionConfig` is where motion tokens belong** — one place for duration, easing and
  reduced-motion, which is the token tier of a motion system.
- `useInstantTransition` suppresses layout animation for a frame, which is exactly what a camera
  move needs so widgets do not FLIP while the viewport itself is moving.

Status: observed from the installed packages' declared surfaces.

## 5. What is genuinely ours

The design tokens in `src/theme.css`, and the two-layer backgrounds that cannot live in a class
list (`.pk-rim`, `.pk-tear`, `.pk-paper`). Everything else is a library's job.

The packer is the one open question: no library was found that packs a lattice with the
POC's anti-rail tile constraint. That is not a licence to write one — it is a thing to check
against `react-grid-layout`, `muuri` and `potpack` at the point a board actually needs packing.

Status: unresolved, deliberately.

## Open gaps

- Q6/Q7 are untouched and Q7 carries the real architectural risk: R3F draws through three.js,
  TypeGPU owns a `GPUDevice`. Whether one device can back both decides whether widgets and the
  world share a frame or are composited as two layers.
- The `Widget` compound has no design. It is the one piece with no library owner and it was got
  wrong twice; it needs a plan before a third attempt.

Resume at: a plan for `Widget`, then Q7.
