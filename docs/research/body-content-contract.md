# Window body content contract and low-zoom representation

> Provenance: This document distills `window-content-strategy.md` and
> `window-scaling-plan.md` from kek-monorepo. The distillation occurred on 2026-06-10.
> The source date is 2026-04-23, with an update on 2026-05-05.

The in-tree rasterization plan owns the proposed levels and all LOD or raster
work.

This document keeps the unbuilt body contract and low-zoom findings for FR-8
input unification and FR-9 accessibility.

## Browser constraints

- `transform` changes coordinates without a relayout. A transformed wrapper
  creates a stacking context and a containing block.
- `position: fixed` descendants of a transformed wrapper do not stay fixed to
  the viewport.
- CSS `zoom` rescales layout, unlike `transform`. It also changes coordinate
  behavior and does not make snapshots.
- At low zoom, each technique makes live DOM text and hit targets too small.
  The architecture requires mode transitions.

## Open contract

### Body root

- Each window body mounts in a body root that the framework owns.
- The body root clips its content to the body rectangle.
- The body root is the scroll container unless the window kind overrides this
  behavior.
- `overflowY` and `wheelBehavior: "native-scroll"` provide current overrides.
  The root and clipping rules remain implicit.

### Portal roots

- A window-local portal root holds menus, tooltips, and popovers that track a
  window.
- A desktop-level portal root holds overlays that extend past window bounds.
- Both roots shipped on 2026-07-08 in `portal.tsx`. The former entry said
  "neither exists today" for one month after that date.
- The desktop root is on the viewport. The window root tracks the screen
  rectangle of its window.
- `<InfiniteCanvasPortal scope="window" | "desktop">` mounts content in them.
- A window kind enables its local root with `portalRoot: true`.
- A root for each window requires one style write for each window after
  each camera change. Frame memoization prevents this work.
- `/portals` demonstrates them.

### Positioning semantics

- App content cannot use viewport-global `position: fixed` behavior inside the
  transformed window subtree.
- The framework documents the portal root for viewport overlays.

### Input ownership

- Desktop pan and zoom own empty space and desktop gestures.
- Body content owns local pointer and scroll behavior.
- Modifier-based desktop zoom from body content remains a policy decision. See
  [../zoom-policy.md](../zoom-policy.md).

### Focus and accessibility

- Body content keeps standard DOM accessibility behavior.
- Desktop focus management must preserve IME, text selection, and keyboard
  navigation inside bodies.
- The shortcut guard covers part of this requirement. Focus restoration rules
  remain unwritten.

## DOM structure rule

Status: implemented. Keep this invariant during the headless extraction.

The outer shell uses screen position and owns `z-index` and `transform`. The
inner shell uses intrinsic frame size and owns chrome and body layout.

This split keeps stack order separate from local geometry.

## Low-zoom chrome findings

- Fractional-pixel frame strokes can disappear at low scale.
- The zoom-aware chrome metrics clamp the minimum world length for hit areas.
- A minimum screen-space stroke policy or a simpler low-zoom chrome style
  remains open in the theme and headless track.
- Resize handles must keep a constant screen size or use inverse scaling with
  a minimum hit area.
- Chrome metrics implement this rule. A restyle must preserve it.

## Mode model

`RASTERIZATION_PLAN.md` owns this model.

- **Live:** The window is near its working scale and has full interaction.
- **Scaled:** The window uses the same DOM with a transform and remains
  legible.
- **Preview/semantic:** The window is too small for live interaction. It uses
  a summary, icon, or snapshot.

Semantic substitution keeps far-zoom content readable.
