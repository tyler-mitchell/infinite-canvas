# API Reference

The public surface of `@hyphened/infinite-canvas`: 192 values and 164 types across
two entries. Anything not exported from a barrel is internal and unstable —
including every `data-infinite-canvas-*` attribute, which is a behavioural hook
for hit-testing, not a styling contract.

This document is **hand-maintained and machine-checked**, which is not the same
as generated — it said "generated from the barrel, so it cannot drift" for the
first month of its life, while drifting by 43 names. `verify-api-doc.mjs` now
asserts every export appears here, and `verify-api-stability.mjs` asserts every
exporting module is classified below. Neither writes a word of prose; both fail
the build when the prose stops matching the code.

The `@hyphened/infinite-canvas/scene` entry is documented separately below. It is
the only entry that pulls in `three` and `@react-three/fiber`.

> Pre-1.0: the API may change between minor versions.

## Stability

**Two tiers, assigned per module.** A change to a stable export is called out
under `Changed` or `Removed` in the changelog. An experimental export may change
or disappear in any release.

Classification lives in
[`packages/infinite-canvas/scripts/api-stability.json`](../packages/infinite-canvas/scripts/api-stability.json)
and `verify-api-stability.mjs` enforces it: a barrel that re-exports from an
unclassified module fails the build. **A new export inside an already-classified
module inherits that module's tier**, which is the intended asymmetry — adding a
function to `geometry.ts` should not require a manifest edit, and adding a whole
module to the public surface should require a decision.

Every experimental entry names one of three reasons, and each reason is a fact
about this repository rather than a feeling about the code.

| Reason             | Meaning                                                                                                                                                                                   | Modules                                                                                   |
| ------------------ | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------- |
| **unobserved**     | Shipped, typechecked, gated — never watched running.                                                                                                                                      | `canvas-handle`                                                                           |
| **off-by-default** | Behind a policy prop that no default configuration turns on, so nothing exercises the shipped path.                                                                                       | `rasterization-layer`, `visibility`, `diagnostics`, `native-drop`                         |
| **r3f-canary**     | Reachable only through `@hyphened/infinite-canvas/scene`, whose `@react-three/fiber` peer range admits a v10 canary. The framework cannot promise stability across someone else's canary. | `scene-surface`, `scene:scene-surface`, `scene:visibility-probes`, `scene:webgpu-surface` |

Plus six types in `types.ts`, which is a grab-bag holding
`InfiniteCanvasSceneLayer` next to `InfiniteCanvasRect`: the `SceneLayer` family
and `InfiniteCanvasSceneVector3`, all **r3f-canary**.

There is no **unconsumed** tier, and the absence is deliberate: an export nothing
uses is not classified, it is removed. `window-scene-shell` (fifteen names, called
only by its own test) and `scene-model` (a re-export of `window-proxy` under
pre-proxy names) were both public and both dead on 2026-07-08; they were unexported
that day rather than given a tier. The package has never been published, so the
removal broke no one. `window-scene-shell.ts` stays on disk because `window-proxy`
calls one function from it, and it is re-exportable in a minor if a consumer ever
asks — a promise not yet made is cheaper to keep than one made and withdrawn.

`canvas-handle` is a narrower case than the others and its entry used to say the
wrong thing — "a debug and automation seam, not a consumer API". It is in fact the
incubator app's persistence spine: Polkadot's autosave runs on
`subscribeDocument`, and that path has been watched working. What remains
unobserved is the rest of the surface — `subscribe`, `snapshot`, and
`getContextualCommands` are driven by nothing — and the handle may still grow
spatial queries. Experimental for what is untested, not for what it is.

`minimap` followed the same path on 2026-08-26. Its entry had read "landed
2026-07-08. No minimap has been drawn in a browser" for seven weeks, which is a
long time for a module to sit in the public surface untested by any design.
Polkadot drew one, and both exported functions were driven:
`getInfiniteCanvasMinimapLayout` placed windows and the viewport frame with the
camera panned away from content, and `getInfiniteCanvasMinimapWorldPoint` turned
a click into a camera move and a drag into continuous scrubbing.

Consuming it also produced the finding that reading it never would: the map is a
corner-sized surface, and `viewportInsets` can only describe it as a full-width
band. Declaring the band overstates it; declaring a right inset loses a column
down the whole viewport. Per-edge scalars cannot express a corner. Recorded
rather than acted on — one consumer is not enough to reshape a prop, and this is
the second time this app has met that edge.

`offscreen` was **unobserved** until Polkadot drew its indicator ring and the
arrows were watched tracking offscreen notes in a browser. It moved to stable the
day that stopped being true, which is the only thing that should ever move an
entry: these reasons are facts with expiry dates, not permanent labels.

### What is deliberately _not_ experimental

**Purity is not a stability reason and neither is size.** `scene-layer-geometry`,
`spatial-target`, and `window-proxy` sound like 3D and are not: all three are
pure-core roots — `verify-pure-core.mjs` proves none of them can reach `three` —
and all three have consumers. They are stable, and they stay on the main entry,
because a consumer drawing window connectors into an SVG overlay needs them with
no 3D engine anywhere. Moving them behind `/scene` would force the 3D peers on
someone who never asked for them.

## Components

`InfiniteCanvasDesktop` is the one component most apps mount — a preset that
supplies defaults and resolves policies around `InfiniteCanvasViewport`.

**The parts compose without it**, which this file asserted for a month before it
was true. Nine of `Viewport`'s props were required in their already-resolved
form while every default and every `resolve*` call lived inside `Desktop`, so a
"custom shell" had to re-implement `Desktop` to satisfy the component `Desktop`
renders. Everything now defaults except `windowDefinitions`, which is genuinely
required because a canvas cannot render a window kind it has never heard of:

```tsx
<InfiniteCanvasProvider initialState={state}>
  <InfiniteCanvasViewport windowDefinitions={registry} />
</InfiniteCanvasProvider>
```

`compound-api.test.tsx` mounts exactly that and asserts windows and bodies
render, so re-adding a required prop without a default breaks a test rather
than a consumer. `InfiniteCanvas` is a namespace object bundling the same
components — asserted identical, not a parallel set that could drift.

**`infinite-canvas`**

- `InfiniteCanvas`
- `InfiniteCanvasDesktop`
- `InfiniteCanvasHud`
- `InfiniteCanvasViewport`
- `InfiniteCanvasWindowLayer`

<details><summary>types (2)</summary>

- `InfiniteCanvasDesktopProps`
- `InfiniteCanvasViewportProps`

</details>

## State & store

The store adapts the pure reducer to Legend State signals.
`InfiniteCanvasProvider` supplies it; the hooks read from it.
`useInfiniteCanvasSelector` is the narrow subscription you want inside window
bodies.

**Declining chrome affordances.** A window may carry `capabilities` — `closable`,
`maximizable`, `minimizable`, `resizable`, using AppKit's vocabulary rather than an
invented one. Every field is optional and **absent means permitted**, so nothing
existing changes and no persisted document needs migrating; read them through
`isInfiniteCanvasWindowCapable`, which owns that default.

They are enforced by the reducer, not merely respected by the chrome:
`actions.closeWindow` on a `closable: false` window returns state unchanged, and
`interaction.startResize` refuses an unresizable one exactly as it already refuses a
grouped pane. An advisory flag would be a lie the UI tells. Withheld controls render
`disabled` with `data-disabled` rather than disappearing, so the chrome keeps its
shape; resize handles are withheld entirely, because an invisible hit target has no
useful disabled state. A capability set to `true` is not serialized, since it means
the same as absent and two canvases that behave alike should serialize alike.

**`workspace`**

Virtual desktops: a named set of windows with the camera and selection you left it at.
Deliberately _not_ nested canvases — a canvas inside a canvas needs a second camera and a
second input plane, which is a different program. Opt-in like groups: with no workspace
active, nothing is filtered and a canvas behaves exactly as it did before they existed.

Switching saves the outgoing workspace's camera and selection and restores the incoming
one's, which is why `activeWorkspaceId` and `workspaces` are part of the undo document while
the camera is not — panning is not an edit, but changing which desktop you are on is.

- `findInfiniteCanvasWorkspace` — one workspace by id, or `null`.

The verbs are actions rather than exported functions, reached through
`useInfiniteCanvasActions`. `reorderWorkspace({ toIndex, workspaceId })` moves a
desktop within the list — `toIndex` is the position in the _final_ order, matching
`reorderGroupChild`, and out-of-range values clamp rather than refuse because the
caller is a drag: running past the end of a strip means "put it last". Until it
existed, `workspaces` was ordered but nothing could reorder it, so a desktop stayed
wherever creation happened to put it.

**`workspace-membership`** — the reader, kept apart from the verbs because `selection` needs
it and `workspace` needs `selection`.

- `getInfiniteCanvasWorkspaceWindowIds` — the ids the active workspace admits, or `null`
  when none is active, which means "admits everything". Right for a render pass asking about
  every window once.
- `isInfiniteCanvasWindowInActiveWorkspace` — the same question about one window, without
  building the set.

<details><summary>types (1)</summary>

- `InfiniteCanvasWorkspace` — `camera`, `id`, `selection`, `title`, `windowIds`.

</details>

**`window-capabilities`**

- `isInfiniteCanvasWindowCapable` — the one reader of a window's capabilities, owning the
  "absent means permitted" default so the reducer, the command layer, the chrome, and a
  consumer's replacement chrome cannot disagree about it.

<details><summary>types (2)</summary>

- `InfiniteCanvasWindowCapability` — one affordance: `"closable"`, `"maximizable"`,
  `"minimizable"`, or `"resizable"`.
- `InfiniteCanvasWindowCapabilities` — the optional set carried on a window; every field
  may be omitted, and omission permits.

</details>

**Owning the store from outside.** `InfiniteCanvasProvider` takes either
`initialState` or a `store` you built with `createInfiniteCanvasStore` — never both;
supplying both is a compile error. Injecting one is how a parent reads, subscribes
to, or drives a canvas it renders, and it is what makes `createInfiniteCanvasHandle`
reachable at all: hold the store, and call the handle factory on it. Until
2026-08-12 the provider always minted its own, so both of those exports were public
and unusable, and the only way to reach the store was a child component that existed
solely to read down into it.

Persistence follows `storageKey`, not store ownership: an injected store with a
`storageKey` is hydrated and persisted like any other, because wanting parent access
is orthogonal to wanting the framework to persist. One difference — `onReset` can
only be wired when a store is constructed, so a reset on an injected store is written
by the ordinary debounce rather than flushed immediately. Pass `onReset` to
`createInfiniteCanvasStore` yourself if you need that flush.

**`store`**

- `InfiniteCanvasProvider`
- `createInfiniteCanvasStore`
- `useInfiniteCanvasActions`
- `useInfiniteCanvasSelector`
- `useInfiniteCanvasState`
- `useInfiniteCanvasState$`
- `useInfiniteCanvasStore`

<details><summary>types (2)</summary>

- `InfiniteCanvasStateValidator`
- `InfiniteCanvasStore`

</details>

**`state`**

- `cloneInfiniteCanvasState`
- `resetInfiniteCanvasState`

## Factories

Construct canonical state without hand-filling volatile runtime fields.
`defineInfiniteCanvasWindowRegistry` type-checks that every registry key equals
its definition's `kind`. `getInfiniteCanvasWindowData` reads a window's opaque
`data` payload through a type guard.

**`factory`**

- `createInfiniteCanvasState`
- `createInfiniteCanvasWindow`
- `defineInfiniteCanvasWindowRegistry`
- `getInfiniteCanvasWindowData`

<details><summary>types (3)</summary>

- `InfiniteCanvasStateInput`
- `InfiniteCanvasWindowInput`
- `InfiniteCanvasWindowRegistryInput` — types each kind's `data` while the registry literal is written, then erases it

</details>

## Registry

Validate and normalize state against a window registry.
`recoverInfiniteCanvasStateForWindowRegistry` drops windows whose `kind` no
longer exists — how stale persisted layouts are made safe.

**`registry`**

- `assertInfiniteCanvasStateMatchesWindowRegistry`
- `getRegisteredInfiniteCanvasWindowKinds`
- `getUnknownInfiniteCanvasWindowKinds`
- `isRegisteredInfiniteCanvasWindow`
- `isRegisteredInfiniteCanvasWindowKind`
- `normalizeInfiniteCanvasStateForWindowRegistry`
- `recoverInfiniteCanvasStateForWindowRegistry`

## Commands & keyboard

Every layout mutation resolves through a named command, so pointer, keyboard, UI
buttons, and programmatic drivers share one mutation path.
`getInfiniteCanvasContextualCommands` answers "what can be done right now".

**`commands`**

- `DEFAULT_INFINITE_CANVAS_COMMAND_DESCRIPTORS`
- `executeInfiniteCanvasCommand`
- `getAvailableInfiniteCanvasContextualCommands`
- `getInfiniteCanvasCommandGroup`
- `getInfiniteCanvasContextualCommands`
- `getInfiniteCanvasHotkeyBindings`
- `isInfiniteCanvasCommandEnabled`

**`group-tree`** — the n-ary container tree a group shell owns

- `createInfiniteCanvasGroupWindowNode`, `dockInfiniteCanvasGroupWindow`, `undockInfiniteCanvasGroupWindow`
- `findInfiniteCanvasGroupNode`, `getInfiniteCanvasGroupParent`, `getInfiniteCanvasGroupWindowIds`
- `isInfiniteCanvasGroupContainer`, `normalizeInfiniteCanvasGroupTree`, `DEFAULT_INFINITE_CANVAS_GROUP_WEIGHT`

<details><summary>types (5)</summary>

- `InfiniteCanvasGroupAxis`
- `InfiniteCanvasGroupContainerNode`
- `InfiniteCanvasGroupLayoutMode` — `"accordion" | "split" | "tabs"`
- `InfiniteCanvasGroupNode`
- `InfiniteCanvasGroupWindowNode`

</details>

**`group-layout`** — solving that tree into rects

- `getInfiniteCanvasGroupLayout` — tree + shell rect → window rects, gutters, tab strips, accordion headers
- `getInfiniteCanvasGroupDockEdgeAtPoint` — which edge a pointer docks against, from a _model_ rect
- `getInfiniteCanvasGroupGutterWeights` — the reweighting a gutter drag produces
- `getInfiniteCanvasGroupMinimumSize` — the smallest rect a tree solves into: gutters, strips, headers, panes. **Not** a member's `minSize`, which the solver has never consulted. Pass the metrics you laid the shell out with, and hand the result to `startGroupResize`
- `resolveInfiniteCanvasGroupMetrics` — a partial to the three sizes, mirroring
  `resolveInfiniteCanvasZoomPolicy` and `resolveInfiniteCanvasChromeMetrics`. Set them through the
  desktop's `groupMetrics` prop, which lands in `state.groupMetrics`: the reducer places member
  windows from that same value, so chrome cannot be drawn at a height the panes were not placed
  for. Field by field rather than a spread, so an explicit `undefined` does not erase a default
- `DEFAULT_INFINITE_CANVAS_GROUP_METRICS`, `MINIMUM_GROUP_PANE_EXTENT`

<details><summary>types (6)</summary>

- `InfiniteCanvasGroupAccordionHeader`
- `InfiniteCanvasGroupDockEdge`
- `InfiniteCanvasGroupGutter`
- `InfiniteCanvasGroupLayout`
- `InfiniteCanvasGroupTabStrip`
- `InfiniteCanvasGroupWindowPlacement`

</details>

**`group-state`** — groups projected onto canvas state

- `findInfiniteCanvasGroup`, `getInfiniteCanvasWindowGroup`, `isInfiniteCanvasWindowGrouped`
- `getInfiniteCanvasGroupedWindowIds`, `getInfiniteCanvasGroupProjection`, `reconcileInfiniteCanvasGroups`
- `DEFAULT_INFINITE_CANVAS_GROUP_TITLE` — what a group is called when nobody named it. Exported so
  a consumer can tell an unnamed group from a named one, which is the difference between offering
  "Name this group" and offering "Rename"
- `getInfiniteCanvasGroupTabLabel` — what a tab or accordion header is called: the window's
  `title`, or for a nested tabs/accordion container whatever it is currently showing. A split has
  no single occupant and takes the group's title. Pass `groupTabLabel` to the desktop to replace
  it — label by kind, by a domain record the window's `data` points at, by anything.

<details><summary>types (5)</summary>

- `InfiniteCanvasDockPreview`
- `InfiniteCanvasGroup` — a group shell: a world object owning a local layout
- `InfiniteCanvasGroupProjection`
- `InfiniteCanvasGroupTabLabel` — the `groupTabLabel` prop's signature
- `InfiniteCanvasGroupTabLabelContext` — the child being named, its group, and the canvas's windows

</details>

**`window-focus`**

- `getInfiniteCanvasDirectionalFocusTarget` — the window an arrow key moves focus to; searches the group's own members first (FOCUS-001), and a floating window's contextual parent (FOCUS-002)
- `getInfiniteCanvasContextualGroup` — the smallest group whose rect contains a point. A floating window over a shell belongs to it for keyboard purposes, so floating windows need no separate keyboard model
- `getInfiniteCanvasWindowNearestCameraCenter` — the keyboard's way into an unfocused canvas
- `isInfiniteCanvasWindowFullyVisible` — whether focusing a window should also move the camera

<details><summary>types (1)</summary>

- `InfiniteCanvasDirection`

</details>

**`detail-level`** — what a window shows when it is too small to read (semantic LOD)

The readability half of P7, and independent of the capture lane it was long filed beside.
Rasterization cannot solve this and never could: **a rasterized paragraph is still a
paragraph**, only blurrier. At far zoom a window has to say something _different_ — a title, an
icon, a count — not the same thing smaller.

- `getInfiniteCanvasWindowDetailLevel` — rect + zoom + previous level → `"full" | "summary"`.
- `DEFAULT_INFINITE_CANVAS_DETAIL_POLICY` — demote below 180 screen px, restore above 240.

The threshold is on **effective screen size, not zoom**. Zoom belongs to the camera and
readability belongs to the window: at 20% zoom a 200px window is 40px and illegible while a
1200px window is 240px and fine. Thresholding on zoom would demote both or neither.

The gap between the two thresholds is a **hysteresis band**, and it is not optional — zoom is
continuous, so a window sitting at a single threshold would flicker between its body and its
summary for every pixel of zoom. The snap resolver carries hysteresis for exactly this reason.
`previousLevel` is how the band works while the function stays pure: the caller holds the last
answer and hands it back.

Opt in per window kind with `renderSummary` on the definition. **A kind that declares none
always renders its body at any zoom** — the framework cannot invent a meaningful summary for
content it does not understand, and a generic one would be worse than small text, which at
least still says what it says.

<details><summary>types (2)</summary>

- `InfiniteCanvasDetailLevel` — `"full" | "summary"`
- `InfiniteCanvasDetailPolicy` — `summaryBelowPx`, `fullAbovePx`

</details>

**`window-arrange`** — aligning and distributing a set of windows

Sibling to `window-placement`, and the distinction is load-bearing: placement answers "where
does _one_ window go inside a region", arrange answers "how do _these_ windows relate to each
other". Alignment is relative to the windows' **own collective bounds**, never the viewport —
aligning three windows left means "share the leftmost one's left edge", not "go to the left of
the screen", which is `window.place`.

- `getInfiniteCanvasAlignedRects` — rects + alignment → rects sharing an edge or centreline.
- `getInfiniteCanvasDistributedRects` — rects + axis → rects with even **gaps**, holding the
  outermost two still. Equal gaps rather than equal centres: with rects of differing size the
  two differ, and equal gaps is what every design tool means by "distribute".
- `getInfiniteCanvasSwappedRects` — exactly two rects trade **centres**, each keeping its own
  size. Exchanging corners is the tiling-manager convention, but these windows float at
  arbitrary sizes, so corner-swapping lands the smaller one somewhere nobody pointed at; for
  equal sizes the two are identical. Fewer or more than two rects pass through unchanged,
  which is what keeps the command unavailable rather than guessing a pair.

**These translate and never resize**, which is what makes them safe: a window cannot be pushed
below its `minSize` by an arrange, so there is no clamping pass and no constraint to violate.
Order in equals order out, so a caller pairing rects with window ids by index stays correct.

Driven by the `window.align` and `window.distribute` commands, which act on the **selection**
and ship with **no default chords** — eight commands would need eight chords, the unclaimed
space is nearly exhausted, and design tools do not agree on bindings for these anyway. Bind
them through `hotkeyBindings`, or put them in a toolbar. Grouped windows are skipped, as
`window.place` refuses one, because a member's rect is its group's projection.

They are one-shot commands, **not a layout mode**: a canvas that keeps windows aligned as they
move is a tiling manager, which risk R5 exists to prevent.

<details><summary>types (2)</summary>

- `InfiniteCanvasAlignment` — `"left" | "right" | "top" | "bottom" | "horizontal-center" | "vertical-center"`
- `InfiniteCanvasDistribution` — `"horizontal" | "vertical"`

</details>

**`window-placement`** — where a tiling shortcut puts a window (FOCUS-003)

- `getInfiniteCanvasWindowPlacementRect` — bounds + region + size → rect. The only thing that
  knows what "left half" means, so pointer and keyboard cannot disagree. **Placement never
  snaps**: a left half nudged to align with its neighbour is no longer a left half, and the
  shortcut pressed twice would give two different rects.
- `getInfiniteCanvasVacantRect` — `{ bounds, occupied, preferred, gapPx? }` → the nearest rect of
  the same size that overlaps nothing, or `preferred` unchanged when it is already clear or when
  `bounds` has no room at all. **Where a new window wants to be stays the consumer's policy**; this
  answers only whether that spot is free. A cascade is a bounded desktop's answer — it offsets by
  the _count_ of windows and so never learns where any of them are, which on an infinite canvas
  means overlapping while empty space sits one screen away. Falling back to `preferred` rather than
  placing outside `bounds` is deliberate: a window put out of view to avoid an overlap is the "did
  it open?" failure.

Driven by the `window.place` command (`Mod+Shift+Arrow` for halves, `Mod+Shift+Enter` to fill).
Centring and the quarters have no default chord and stay dispatchable by region: the canvas
`preventDefault()`s any chord it owns, and the obvious centring keys (`Mod+Alt+C`,
`Mod+Shift+C`) open browser devtools. `Mod+Alt+Arrow` switches browser tabs on macOS and is not
page-cancellable, so it is not bound either. The command acts on the **active** window, not the
selection — tiling three selected windows into one rect buries two of them — and refuses a
grouped window, whose rect belongs to its tree.

<details><summary>types (1)</summary>

- `InfiniteCanvasWindowPlacementRegion` — `"left" | "right" | "top" | "bottom"`, the four
  quarters, `"fill"`, `"center"`

</details>

**`minimap`** — a world overview, as geometry rather than as a widget

An infinite canvas has a failure mode nothing bounded does: you can pan into empty space and
lose everything. Fit-all, directional focus, and recipes all recover you _after_ you are lost;
an overview is the only affordance that answers "where is everything, and where am I in it"
continuously. This module computes it and draws nothing — a minimap is almost entirely a
projection problem, and the projection is the part a consumer cannot easily get right.

- `getInfiniteCanvasMinimapLayout` — `(state, size, options?)`. Windows, groups, and the
  camera's visible rect, projected into a box of `size` pixels. Uniform scale on both axes; the
  camera's rect is **unioned into the bounds**, so panning away from every window shrinks the
  content rather than pushing the viewport indicator out of the box. Returns `null` for an
  unmeasured viewport or an empty canvas: rendering nothing beats rendering a degenerate
  projection.
- `getInfiniteCanvasMinimapWorldPoint` — `(layout, minimapPoint)`. The exact inverse, for
  click-to-navigate. Hand the result to `navigateToPoint`.

Windows behind an inactive tab or a collapsed fold are omitted, as are minimized ones: an
overview is a map of what is on screen to be found.

<details><summary>types (4)</summary>

- `InfiniteCanvasMinimapGroup`
- `InfiniteCanvasMinimapLayout`
- `InfiniteCanvasMinimapOptions`
- `InfiniteCanvasMinimapWindow`

</details>

**`offscreen`** — edge indicators for what has fallen off the viewport

The minimap answers "where am I?" — you look at it. This answers "where did my window go?" — you
don't. Peripheral rather than central, and on an infinite canvas both halves are load-bearing: a
bounded document can only scroll, so a lost window is always one `Home` away. Here it can be
anywhere, and fit-all is a blunt instrument that moves the camera off everything else to find one
thing.

- `getInfiniteCanvasOffscreenIndicators` — `(state, options?)`. Every drawn thing that does not
  overlap the viewport, nearest first, each with the `point` on the inset viewport edge where an
  arrow belongs, the `angle` to rotate it by (radians, clockwise, `0` is right), the
  `distancePx` it sorts on, and the `rect` to navigate to.

A **group is one indicator, not one per pane** — four panes docked together share a bearing and a
distance, and four arrows on one pixel is not information. Minimized windows are omitted; windows
hidden behind a tab are omitted individually and counted through their group, which is the thing
you would navigate to.

`options.limit` is unbounded by default. A hundred and sixty windows means a hundred and forty
arrows, which is a border rather than a hint — but only the consumer knows how big their canvas
is, and a consumer who caps should say so, because a silent cap reads as "that's everything" when
it isn't.

<details><summary>types (3)</summary>

- `InfiniteCanvasOffscreenIndicator`
- `InfiniteCanvasOffscreenOptions`
- `InfiniteCanvasOffscreenTargetKind`

</details>

**`keyboard`**

- `focusInfiniteCanvasCommandSurface`
- `focusInfiniteCanvasCommandSurfaceFrom` — hand the keyboard back to the canvas from any element
  inside it. Hotkeys only fire for events landing in the command surface, so chrome that takes
  focus and does not return it leaves focus on `<body>`, where every shortcut silently stops
  working. The counterpart to `focusInfiniteCanvasCommandSurface`, which needs the surface element
  and therefore needs the consumer to know this framework's DOM contract.
- `registerInfiniteCanvasHotkeys` — bind the canvas's own commands, and any verbs the consumer
  claims, to one keyboard scope. `bindings` **replaces** the default keymap; `actions` is **added**
  to it. That asymmetry is the API: swapping the whole keymap is a coherent thing to want, losing
  it because you wanted one more chord is not.
- `shouldHandleInfiniteCanvasKeyboardEvent`

<details><summary>types (2)</summary>

- `InfiniteCanvasHotkeyAction` — a chord a consumer claims for a verb this canvas does not have.
  The canvas can already hold a consumer's own objects and select them — `spatialTargetResolvers`
  resolves a pointer to one, `selection.targets` holds it — and knows nothing about what they are,
  so it can offer no verb over them. Supply `hotkeys`, a `run(state)`, and an `isEnabled(state)`
  when the verb only sometimes applies; the command surface, the exclusion list, and the swallow
  rule stay the framework's. Distinct from `InfiniteCanvasHotkeyBinding`, which re-chords a command
  the canvas already owns and is gated by `isInfiniteCanvasCommandEnabled`.
- `InfiniteCanvasHotkeyRegistrationInput`

</details>

## Selection

Selection is explicit state, distinct from focus. Window ids and typed non-
window targets (scene objects, edges) are both first-class. All functions are
pure.

**`selection`**

- `EMPTY_INFINITE_CANVAS_SELECTION`
- `addSelection`
- `addTargetSelection`
- `clearSelection`
- `getSelectableWindowIds`
- `getSelectedWindowBounds`
- `getSelectionAnchorTarget`
- `getSelectionTargetKey`
- `getSelectionTargets`
- `getVisibleWindowBounds`
- `getWindowBounds`
- `hasInfiniteCanvasSelection`
- `isSelectionTargetSelected`
- `isWindowSelected`
- `normalizeSelection`
- `normalizeSelectionTargets`
- `normalizeSelectionWindowIds`
- `removeSelection`
- `removeTargetSelection`
- `replaceSelection`
- `replaceTargetSelection`
- `selectAllVisibleWindows`
- `toggleSelection`
- `toggleTargetSelection`

## Camera navigation

Frame a window, the selection, all visible windows, a world point, or an
arbitrary rect, with `center`, `centerAtZoom`, or `fit` behaviour.

**`camera-navigation`**

- `DEFAULT_INFINITE_CANVAS_CAMERA_NAVIGATION_BEHAVIOR`
- `getCameraNavigationFrame`
- `getCameraNavigationTargetRect`
- `getNavigableWindow`
- `isCameraNavigationAvailable`
- `navigateCamera`
- `navigateCameraToWindow`

## Geometry helpers

Pure projection and rect maths that consumer overlays and scene layers
legitimately need, plus the default policies.

**`geometry`**

- `getInfiniteCanvasContentViewport`
- `getInfiniteCanvasContentWorldRect`
- `getRectCenter`
- `getVisibleWorldRect`
- `isUsableViewport`
- `isWorldRectWithinViewport`
- `rectContainsPoint`
- `rectsIntersect`
- `screenPointToWorldPoint`
- `unionRects`
- `worldPointToScreenPoint`
- `worldRectToScreenRect`

**`constants`**

- `DEFAULT_INFINITE_CANVAS_INPUT_POLICY`
- `DEFAULT_INFINITE_CANVAS_SNAP_POLICY`
- `DEFAULT_INFINITE_CANVAS_ZOOM`
- `MIN_RENDERABLE_INFINITE_CANVAS_ZOOM`
- `resolveInfiniteCanvasChromeMetrics`
- `resolveInfiniteCanvasZoomPolicy`

`resolveInfiniteCanvasChromeMetrics` merges a partial chrome override with the
defaults, exactly as `InfiniteCanvas.Viewport` does with its `chrome` prop. Pass
its result to `resolveInfiniteCanvasSpatialTarget`, which requires complete
metrics: a consumer that overrides one metric on the viewport and then spreads
the defaults by hand at each hit-test call site will drift from what the viewport
draws the moment a metric is added.

**`activity`**

What the canvas is _doing_, for chrome that must respond to it — distinct from
`getInfiniteCanvasPointerMode`, which is the tool the user selected and does not change when a
drag begins. `isInfiniteCanvasActivityTransient` separates the states that last only while a
pointer is down, which is when chrome should recede.

- `getInfiniteCanvasActivity`
- `isInfiniteCanvasActivityTransient`
- `InfiniteCanvasActivity`

**`input-policy`**

- `DEFAULT_INFINITE_CANVAS_CURSOR_POLICY`
- `getInfiniteCanvasIdleCursor`
- `getInfiniteCanvasInteractionCursor`
- `getInfiniteCanvasPointerMode`
- `withInfiniteCanvasPointerMode`

## Connection authoring

Dragging from one window to another to declare a relationship between them. The
framework owns the gesture — where the handles sit, when they appear, when they
must not disappear, and what the far end is at this instant — because all of it
is a question about windows and a camera. A consumer supplies only whether a
given pair may be joined and what to write when it is; nothing here knows what a
connection means.

**`window-connection`**

- `DEFAULT_CONNECTION_HANDLE_OFFSET_PX`
- `DEFAULT_CONNECTION_HANDLE_RADIUS_PX`
- `getInfiniteCanvasConnectionAffordanceRect`
- `getInfiniteCanvasConnectionAffordanceWindowId`
- `getInfiniteCanvasConnectionHandles`
- `getInfiniteCanvasConnectionPreviewPath`

<details><summary>types (3)</summary>

- `InfiniteCanvasConnectionEdge`
- `InfiniteCanvasConnectionHandle`
- `InfiniteCanvasConnectionHandleOptions`

</details>

`getInfiniteCanvasConnectionAffordanceWindowId` is the one that is easy to get
wrong. Handles sit _outside_ a window, so visibility driven by "is the pointer
over the window" makes them vanish the instant anyone moves toward one — the
pointer leaves the rect on its way to the thing the rect revealed. Pass the
previously-showing window back in on every pointer move: the affordance is held
while the pointer is anywhere in the ring the handles occupy, and handed over
only when the pointer is properly inside a different window, so a neighbour
cannot steal it mid-reach.

`getInfiniteCanvasConnectionPreviewPath` accepts a point or a rect as its far
end and routes both identically, so the line shown during a drag is the line
that will be committed rather than one that resembles it.

## Scene layer helpers

For `sceneLayers` content: projected window proxies, connector paths and
orthogonal routes, world-segment scene transforms, frustum visibility. Prefer
these over hand-rolled path maths.

**`scene-layer-geometry`**

- `getInfiniteCanvasLongestUnoccludedSegment`
- `getInfiniteCanvasRectConnectorPath`
- `getInfiniteCanvasRectConnectorPoint`
- `getInfiniteCanvasRectConnectorSegment`
- `getInfiniteCanvasSegmentsWithinRect`
- `getInfiniteCanvasUnoccludedSegments`
- `getInfiniteCanvasViewportScreenRect`
- `getInfiniteCanvasWindowConnectorPath`
- `getInfiniteCanvasWindowConnectorPoint`
- `getInfiniteCanvasWindowConnectorSegment`
- `getInfiniteCanvasWindowProxyCullingRect`
- `getInfiniteCanvasWorldPath`
- `getInfiniteCanvasWorldPathPointAtProgress`
- `getInfiniteCanvasWorldPathSceneTransforms`
- `getInfiniteCanvasWorldSegment`
- `getInfiniteCanvasWorldSegmentSceneTransform`
- `getVisibleInfiniteCanvasWindowProxies`

<details><summary>types (6)</summary>

- `InfiniteCanvasSceneSegmentTransform`
- `InfiniteCanvasWindowConnectorOptions`
- `InfiniteCanvasWindowConnectorPathOptions`
- `InfiniteCanvasWindowConnectorRoute`
- `InfiniteCanvasWorldPath`
- `InfiniteCanvasWorldSegment`

</details>

**`window-proxy`**

- `getInfiniteCanvasWindowProxies`
- `getInfiniteCanvasWindowProxy`

**`visibility`**

- `getInfiniteCanvasVisibilitySummary`
- `getWindowFrustumVisibility`
- `isWindowFramed`
- `useInfiniteCanvasVisibilitySummary`
- `useInfiniteCanvasWindowFramed`
- `useInfiniteCanvasWindowFrustum`

<details><summary>types (3)</summary>

- `InfiniteCanvasVisibilityState`
- `InfiniteCanvasVisibilitySummary`
- `InfiniteCanvasWindowFrustumVisibility`

</details>

## Spatial targeting

One answer to "what is under this pointer or drop point?" across windows, window
areas, resize handles, empty world, and consumer-provided overlays, scene
objects, and edges.

**`spatial-target`**

- `createInfiniteCanvasEdgeTargetResolver`
- `createInfiniteCanvasOverlayTargetResolver`
- `createInfiniteCanvasSceneObjectTargetResolver`
- `getInfiniteCanvasSelectableTargetFromSpatialTarget`
- `resolveInfiniteCanvasSpatialTarget`

<details><summary>types (5)</summary>

- `InfiniteCanvasSpatialEdgeTarget`
- `InfiniteCanvasSpatialRectTarget`
- `InfiniteCanvasSpatialTargetInput`
- `InfiniteCanvasSpatialTargetResolverInput`
- `InfiniteCanvasSpatialTargetSource`

</details>

## Drag & drop

Typed, opaque payloads threaded through validation and commit.
`getInfiniteCanvasDropPlacement` is the canonical pointer-anchored, snap-
integrated placement shared by a drag preview and its commit.

Drags from outside the page arrive through the same policy. The viewport listens
for the native drag events on its own element and translates them into the
interaction the pointer path already produces, so `canDrop`, `placement`,
snapping, the guides, and the preview an overlay draws from `drag` all behave
identically — a consumer writes no coordinate maths and no second placement. The
payload for those is supplied by the framework rather than the consumer, since
nobody starts an OS drag: widen your own payload with
`InfiniteCanvasNativeDropPayload` and narrow on `payload.type`, which is
`"files"` for a file drag and `"text"` for a dragged link or selection.

The bridge does not decide which drags are interesting. Anything it can describe
reaches `canDrop`, which refuses the rest in flight — from `types` alone, since
the browser withholds contents until the drop. A drag it can describe nothing of
is left alone entirely, so a canvas never takes the browser's own handling away
from a page.

**`drop-interaction`**

- `EMPTY_INFINITE_CANVAS_DROP`
- `createInfiniteCanvasDropInteraction`
- `getInfiniteCanvasDropPlacement`
- `isPointInsideInfiniteCanvasViewport`
- `normalizeInfiniteCanvasDropValidation`

<details><summary>types (5)</summary>

- `InfiniteCanvasDropPlacement`
- `InfiniteCanvasDropPlacementInput`
- `InfiniteCanvasFileDropPayload`
- `InfiniteCanvasNativeDropPayload`
- `InfiniteCanvasTextDropPayload`

</details>

**`native-drop`**

Reading a drag that started outside the page. The viewport uses this internally;
it is public for a consumer wiring drops onto its own surface — a library rail, a
sidebar — rather than onto the canvas. `null` means the drag carries nothing
describable and should be left to the browser.

- `getInfiniteCanvasNativeDropPayload`
- `URI_LIST_TYPE`

## Persistence & validation

Versioned JSON serialization with transient interaction state stripped, scoped
by `documentKey`. The `parse*` functions are structural validators returning the
value or `null`; unknown keys are stripped.

**`persistence`**

- `getInfiniteCanvasScopedStorageKey`
- `parseInfiniteCanvasState`
- `parseInfiniteCanvasStateJson`
- `serializeInfiniteCanvasState`
- `stringifyInfiniteCanvasState`

<details><summary>types (1)</summary>

- `InfiniteCanvasStorageKeyInput`

</details>

**`validation`**

- `parseInfiniteCanvasCamera`
- `parseInfiniteCanvasPoint`
- `parseInfiniteCanvasRecipe` — a recipe crossing storage is untrusted input
- `parseInfiniteCanvasRect`
- `parseInfiniteCanvasSelection`
- `parseInfiniteCanvasSerializedState`
- `parseInfiniteCanvasSize`
- `parseInfiniteCanvasWindow`

## History (undo / redo)

History is over the _document_ — the windows and the groups — because everything else
is a view onto it. Panning is not an edit. A drag is one entry, checkpointed when the
drag begins. Bounded at `INFINITE_CANVAS_HISTORY_LIMIT`, session-scoped, never
serialized: a layout is a document, not its edit log.

**`history`**

- `canUndoInfiniteCanvas`, `canRedoInfiniteCanvas` — gate the commands
- `undoInfiniteCanvasHistory`, `redoInfiniteCanvasHistory`
- `getInfiniteCanvasDocument` — the undoable half of the canvas
- `EMPTY_INFINITE_CANVAS_HISTORY`, `INFINITE_CANVAS_HISTORY_LIMIT`

<details><summary>types (2)</summary>

- `InfiniteCanvasDocument`
- `InfiniteCanvasHistory`

</details>

## Layout recipes

A named arrangement — the selection, a named set, or the whole canvas — captured
relative to its own origin so it drops into any region of an unbounded world. Recipes
**translate rather than scale**: fitting an arrangement into a smaller region would
push windows below their own `minSize`. They are plain serializable values the
consumer owns and persists.

**`recipes`**

- `captureInfiniteCanvasRecipe`, `applyInfiniteCanvasRecipe`
- `getInfiniteCanvasRecipeOrigin`
- `INFINITE_CANVAS_RECIPE_VERSION`

<details><summary>types (4)</summary>

- `InfiniteCanvasRecipe`
- `InfiniteCanvasRecipeGroup`
- `InfiniteCanvasRecipePlacement`
- `InfiniteCanvasRecipeWindow`

</details>

## Portals

A window frame is `transform: scale(zoom)`, which makes it the containing block for
`position: fixed` — so a popover inside a window body resolves against the _frame_ and
is scaled by the zoom. These mount content outside every transform. The window root is
opt-in per window kind (`portalRoot: true`).

**`portal`**

- `InfiniteCanvasPortal` — `scope="desktop"` escapes the window; `scope="window"` tracks it at natural size
- `useInfiniteCanvasPortalRoots`
- `useInfiniteCanvasDesktopPortalRoot`
- `useInfiniteCanvasWindowPortalRoot`

<details><summary>types (1)</summary>

- `InfiniteCanvasPortalScope`

</details>

## Presence

Headless grouping of active / visible / pinned / minimized windows for docks,
taskbars, and trays.

**`window-presence`**

- `getInfiniteCanvasMinimizedWindowItems`
- `getInfiniteCanvasVisibleWindowItems`
- `getInfiniteCanvasWindowPresence`
- `getInfiniteCanvasWindowPresenceItem`

<details><summary>types (2)</summary>

- `InfiniteCanvasWindowPresence`
- `InfiniteCanvasWindowPresenceItem`

</details>

## Rasterization

Snapshot policy and scheduler for window bodies. Off by default; enable through
the `rasterization` prop.

**`rasterization-layer`**

- `DEFAULT_INFINITE_CANVAS_RASTERIZATION`
- `resolveInfiniteCanvasRasterizationPolicy`

<details><summary>types (5)</summary>

- `InfiniteCanvasRasterDisplayMode`
- `InfiniteCanvasRasterSnapshot`
- `InfiniteCanvasRasterSummary`
- `InfiniteCanvasRasterizationPolicy`
- `InfiniteCanvasRasterizationPolicyInput`

</details>

## Diagnostics

Developer overlays. They style themselves inline and render correctly without
`theme.css`.

**`diagnostics`**

- `DEFAULT_INFINITE_CANVAS_DIAGNOSTICS`
- `resolveInfiniteCanvasDiagnosticsPolicy`

<details><summary>types (2)</summary>

- `InfiniteCanvasDiagnosticsPolicy`
- `InfiniteCanvasDiagnosticsPolicyInput`

</details>

## Theming & data attributes

The `data-slot` vocabulary is the public _styling_ selector contract, targeted
by `theme.css` — separate from the behavioural `data-infinite-canvas-*`
attributes, which are internal. `hud` policy resolution lives here.

`theme.css` is one cascade layer, `infinite-canvas`, and a layer's position is
decided by where it is first established. Importing the theme after a utility
framework therefore ranks it above `utilities`, and the theme wins against
every utility class — with no symptom other than the class not applying. A
consumer using cascade layers declares the order once, above the imports, and
source order stops mattering:

```css
@layer infinite-canvas, components, utilities;
```

Slot overrides then belong in a layer between the two. Written unlayered they
still beat the theme, but they also beat the consumer's own utilities, which is
the same defect facing the other way.

**`data-attributes`**

- `INFINITE_CANVAS_SLOTS`
- `getInfiniteCanvasWindowStateAttributes`

<details><summary>types (1)</summary>

- `InfiniteCanvasSlot`

</details>

**`canvas-hud`**

- `DEFAULT_INFINITE_CANVAS_HUD_POLICY`
- `resolveInfiniteCanvasHudPolicy`

## Icons

Built-in inline SVGs, overridable per action via the `icons` prop. The package
has no icon-library dependency.

**`icons`**

- `DEFAULT_INFINITE_CANVAS_ICONS`
- `useInfiniteCanvasIcons`

<details><summary>types (3)</summary>

- `InfiniteCanvasIconName`
- `InfiniteCanvasIconProps`
- `InfiniteCanvasIcons`

</details>

## Handle (experimental)

`createInfiniteCanvasHandle(store)` — the programmatic consumer contract: state
snapshot, typed commands, contextual command descriptors. Shape may change
before 1.0.

**`canvas-handle`**

- `createInfiniteCanvasHandle`

<details><summary>types (1)</summary>

- `InfiniteCanvasHandle`

</details>

## Types

All public types. `InfiniteCanvasViewport` (the size type) is re-exported as
`InfiniteCanvasViewportSize` to avoid colliding with the component of the same
name.

**`types`**

<details><summary>types (89)</summary>

- `InfiniteCanvasAction`
- `InfiniteCanvasCamera`
- `InfiniteCanvasCameraNavigationBehavior`
- `InfiniteCanvasCameraNavigationRequest`
- `InfiniteCanvasCameraNavigationTarget`
- `InfiniteCanvasChromeMetrics`
- `InfiniteCanvasChromeMetricsInput`
- `InfiniteCanvasCommand`
- `InfiniteCanvasCommandDescriptor`
- `InfiniteCanvasCommandGroup`
- `InfiniteCanvasCommandId`
- `InfiniteCanvasCommands`
- `InfiniteCanvasContextualCommand`
- `InfiniteCanvasCursor`
- `InfiniteCanvasCursorInteraction`
- `InfiniteCanvasCursorPolicy`
- `InfiniteCanvasDragStartInput`
- `InfiniteCanvasDropCommitContext`
- `InfiniteCanvasDropInteraction`
- `InfiniteCanvasDropPayload`
- `InfiniteCanvasDropPolicy`
- `InfiniteCanvasDropTargetContext`
- `InfiniteCanvasDropValidationInput`
- `InfiniteCanvasDropValidationResult`
- `InfiniteCanvasEmptyCanvasDragMode`
- `InfiniteCanvasHotkeyBinding`
- `InfiniteCanvasGroupGutterInteraction`
- `InfiniteCanvasGroupMetrics`, `InfiniteCanvasGroupMetricsInput` — the three chrome sizes, and the
  partial a consumer writes. `state.groupMetrics` holds the resolved form
- `InfiniteCanvasGroupMoveInteraction`
- `InfiniteCanvasGroupResizeInteraction`
- `InfiniteCanvasHudPolicy`
- `InfiniteCanvasHudPolicyInput`
- `InfiniteCanvasInputPolicy`
- `InfiniteCanvasInteraction`
- `InfiniteCanvasMarqueeInteraction`
- `InfiniteCanvasMarqueeMode`
- `InfiniteCanvasMoveInteraction`
- `InfiniteCanvasMoveOriginRect`
- `InfiniteCanvasOverlayReadContext` — covariant in `Payload`; a utility that only reads takes this
- `InfiniteCanvasOverlayRenderContext`
- `InfiniteCanvasPanInteraction`
- `InfiniteCanvasPoint`
- `InfiniteCanvasPointerMode`
- `InfiniteCanvasRect`
- `InfiniteCanvasResizeHandle`
- `InfiniteCanvasResizeInteraction`
- `InfiniteCanvasResolveSpatialTarget`
- `InfiniteCanvasResolvedDropTarget`
- `InfiniteCanvasResolvedSpatialTarget`
- `InfiniteCanvasSceneLayer`
- `InfiniteCanvasSceneLayerFrameloop`
- `InfiniteCanvasSceneLayerPlacement`
- `InfiniteCanvasSceneLayerRenderContext`
- `InfiniteCanvasSceneLayerSpace`
- `InfiniteCanvasSceneVector3`
- `InfiniteCanvasSelection`
- `InfiniteCanvasSelectionTarget`
- `InfiniteCanvasSelectionTargetType`
- `InfiniteCanvasSerializedState`
- `InfiniteCanvasSize`
- `InfiniteCanvasSnapGuide`
- `InfiniteCanvasSnapPolicy`
- `InfiniteCanvasSnapPreview`
- `InfiniteCanvasSpatialTarget`
- `InfiniteCanvasSpatialTargetResolver`
- `InfiniteCanvasSpatialTargetResolverContext`
- `InfiniteCanvasSpatialTargetResolverPhase`
- `InfiniteCanvasSlotElementProps`
- `InfiniteCanvasSlotRender`
- `InfiniteCanvasSpatialWindowArea`
- `InfiniteCanvasStackBands`
- `InfiniteCanvasState`
- `InfiniteCanvasTheme`
- `InfiniteCanvasViewport as InfiniteCanvasViewportSize`
- `InfiniteCanvasViewportInsets`, `InfiniteCanvasViewportInsetsInput`
- `InfiniteCanvasWindow`
- `InfiniteCanvasWindowBodyPointerBehavior`
- `InfiniteCanvasWindowDefinition`
- `InfiniteCanvasWindowFrameActiveCornersProps`
- `InfiniteCanvasWindowFrameBodyProps`
- `InfiniteCanvasWindowFrameChrome`
- `InfiniteCanvasWindowFrameControlsProps`
- `InfiniteCanvasWindowFrameHeaderProps`
- `InfiniteCanvasWindowFrameRenderContext`
- `InfiniteCanvasWindowFrameSlots`

</details>

### Slots are headless, not just unstyled

Every frame slot takes **the element's own attributes** — `id`, `role`, `tabIndex`, every `aria-*`,
every DOM event, `ref` — plus **`render`**, which replaces the element entirely:

```tsx
renderFrame: ({ frame: { Header, Surface } }) => (
  <Surface>
    <Header render={(props, { children }) => <nav {...props}>{children}</nav>} />
  </Surface>
);
```

The framework keeps its behaviour and gives up its tag. `ref` needs no `forwardRef` because React
19 passes it as an ordinary prop.

**Merging is per-kind, not last-wins**, and the rules are Base UI's `mergeProps` semantics:

| Prop kind       | Rule                                                                                                                                                                                                                                                                                                     |
| --------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Event handlers  | **Both run, consumer first.** Passing `onPointerDown` to a header cannot silently disable window dragging. To decline the framework's behaviour, call `event.preventInfiniteCanvasHandler()` — deliberately not `preventDefault`, which means "skip the browser's default" and is a different intention. |
| `className`     | Concatenated, consumer first.                                                                                                                                                                                                                                                                            |
| `style`         | Shallow-merged, consumer last — overriding one declaration keeps the geometry the framework computed for the rest.                                                                                                                                                                                       |
| `data-slot`     | **Framework-owned.** It is the styling contract's only anchor; a consumer who could set it would silently detach the stylesheet while everything still looked wired.                                                                                                                                     |
| Everything else | Consumer-owned.                                                                                                                                                                                                                                                                                          |

- `InfiniteCanvasWindowFrameSurfaceProps`
- `InfiniteCanvasWindowFrameTitleProps`
- `InfiniteCanvasWindowMode`
- `InfiniteCanvasWindowProxy`
- `InfiniteCanvasWindowRegistry`
- `InfiniteCanvasWindowRenderContext`
- `InfiniteCanvasWindowTextSelection`
- `InfiniteCanvasWindowWheelBehavior`
- `InfiniteCanvasZoomPolicy`
- `InfiniteCanvasZoomPolicyInput`

</details>

## `@hyphened/infinite-canvas/scene`

A separate entry point, and the only one that imports `three` and
`@react-three/fiber`. Import it to opt into a 3D engine, then pass the surface
to `<InfiniteCanvasDesktop sceneSurface={...} />`. If you never import it, both
peers can stay uninstalled and neither enters your bundle.

```tsx
import { InfiniteCanvasWebGpuSurface } from "@hyphened/infinite-canvas/scene";
```

**`scene`**

- `InfiniteCanvasWebGpuSurface` — the transparent WebGPU surface that paints `sceneLayers`
- `InfiniteCanvasWindowFrustumProbeLayer` — the frustum-visibility probe used by `diagnostics.frustum`

<details><summary>types (2)</summary>

- `InfiniteCanvasSceneSurface`
- `InfiniteCanvasSceneSurfaceProps`

</details>

Both types are also re-exported from the main entry, so you can type a
`sceneSurface` prop without importing the scene entry.
