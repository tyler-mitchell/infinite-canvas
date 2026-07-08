# API Reference

The public surface of `@infinite-canvas/react`: 203 values and 171 types across
two entries. Anything not exported from a barrel is internal and unstable —
including every `data-infinite-canvas-*` attribute, which is a behavioural hook
for hit-testing, not a styling contract.

This document is **hand-maintained and machine-checked**, which is not the same
as generated — it said "generated from the barrel, so it cannot drift" for the
first month of its life, while drifting by 43 names. `verify-api-doc.mjs` now
asserts every export appears here, and `verify-api-stability.mjs` asserts every
exporting module is classified below. Neither writes a word of prose; both fail
the build when the prose stops matching the code.

The `@infinite-canvas/react/scene` entry is documented separately below. It is
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

Every experimental entry names one of four reasons, and each reason is a fact
about this repository rather than a feeling about the code.

| Reason             | Meaning                                                                                                                                                                                | Modules                                                                                   |
| ------------------ | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------- |
| **unobserved**     | Shipped, typechecked, gated — never watched running.                                                                                                                                   | `canvas-handle`, `minimap`, `offscreen`                                                   |
| **off-by-default** | Behind a policy prop that no default configuration turns on, so nothing exercises the shipped path.                                                                                    | `rasterization-layer`, `visibility`, `diagnostics`                                        |
| **unconsumed**     | Nothing outside its own test file calls it. An API nobody has used is an API nobody has found the flaws in.                                                                            | `window-scene-shell`                                                                      |
| **r3f-canary**     | Reachable only through `@infinite-canvas/react/scene`, whose `@react-three/fiber` peer range admits a v10 canary. The framework cannot promise stability across someone else's canary. | `scene-surface`, `scene:scene-surface`, `scene:visibility-probes`, `scene:webgpu-surface` |

Plus six types in `types.ts`, which is a grab-bag holding
`InfiniteCanvasSceneLayer` next to `InfiniteCanvasRect`: the `SceneLayer` family
and `InfiniteCanvasSceneVector3`, all **r3f-canary**.

### What is deliberately _not_ experimental

**Purity is not a stability reason and neither is size.** `scene-layer-geometry`,
`scene-model`, `spatial-target`, and `window-proxy` sound like 3D and are not:
all four are pure-core roots — `verify-pure-core.mjs` proves none of them can
reach `three` — and all four have consumers. They are stable, and they stay on
the main entry, because a consumer drawing window connectors into an SVG overlay
needs them with no 3D engine anywhere. Moving them behind `/scene` would force
the 3D peers on someone who never asked for them.

`window-scene-shell` is equally pure and is _not_ stable, on evidence rather than
on smell: grepping the tree for its fifteen exported names finds callers only
inside `window-scene-shell.test.ts`, and `getMinimumWorldLength` has no reference
anywhere at all.

## Components

`InfiniteCanvasDesktop` is the one component most apps mount.
`InfiniteCanvasViewport`, `InfiniteCanvasWindowLayer` and `InfiniteCanvasHud`
are its internals, exported for custom shells; `InfiniteCanvas` is a namespace
object bundling them.

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
- `DEFAULT_INFINITE_CANVAS_GROUP_METRICS`, `MINIMUM_GROUP_PANE_EXTENT`

<details><summary>types (7)</summary>

- `InfiniteCanvasGroupAccordionHeader`
- `InfiniteCanvasGroupDockEdge`
- `InfiniteCanvasGroupGutter`
- `InfiniteCanvasGroupLayout`
- `InfiniteCanvasGroupMetrics`
- `InfiniteCanvasGroupTabStrip`
- `InfiniteCanvasGroupWindowPlacement`

</details>

**`group-state`** — groups projected onto canvas state

- `findInfiniteCanvasGroup`, `getInfiniteCanvasWindowGroup`, `isInfiniteCanvasWindowGrouped`
- `getInfiniteCanvasGroupedWindowIds`, `getInfiniteCanvasGroupProjection`, `reconcileInfiniteCanvasGroups`

<details><summary>types (3)</summary>

- `InfiniteCanvasDockPreview`
- `InfiniteCanvasGroup` — a group shell: a world object owning a local layout
- `InfiniteCanvasGroupProjection`

</details>

**`window-focus`**

- `getInfiniteCanvasDirectionalFocusTarget` — the window an arrow key moves focus to; searches the group's own members first (FOCUS-001), and a floating window's contextual parent (FOCUS-002)
- `getInfiniteCanvasContextualGroup` — the smallest group whose rect contains a point. A floating window over a shell belongs to it for keyboard purposes, so floating windows need no separate keyboard model
- `getInfiniteCanvasWindowNearestCameraCenter` — the keyboard's way into an unfocused canvas
- `isInfiniteCanvasWindowFullyVisible` — whether focusing a window should also move the camera

<details><summary>types (1)</summary>

- `InfiniteCanvasDirection`

</details>

**`window-placement`** — where a tiling shortcut puts a window (FOCUS-003)

- `getInfiniteCanvasWindowPlacementRect` — bounds + region + size → rect. The only thing that
  knows what "left half" means, so pointer and keyboard cannot disagree. **Placement never
  snaps**: a left half nudged to align with its neighbour is no longer a left half, and the
  shortcut pressed twice would give two different rects.

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
- `registerInfiniteCanvasHotkeys`
- `shouldHandleInfiniteCanvasKeyboardEvent`

<details><summary>types (1)</summary>

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
- `resolveInfiniteCanvasZoomPolicy`

**`input-policy`**

- `DEFAULT_INFINITE_CANVAS_CURSOR_POLICY`
- `getInfiniteCanvasIdleCursor`
- `getInfiniteCanvasInteractionCursor`
- `getInfiniteCanvasPointerMode`
- `withInfiniteCanvasPointerMode`

## Scene layer helpers

For `sceneLayers` content: projected window proxies, connector paths and
orthogonal routes, world-segment scene transforms, frustum visibility. Prefer
these over hand-rolled path maths.

**`scene-layer-geometry`**

- `getInfiniteCanvasRectConnectorPath`
- `getInfiniteCanvasRectConnectorPoint`
- `getInfiniteCanvasRectConnectorSegment`
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

**`window-scene-shell`**

- `createInfiniteCanvasWindowLocalFrameRect`
- `frameLocalPointToScenePoint`
- `frameLocalRectToScenePlane`
- `getInfiniteCanvasWindowBodyProjection`
- `getInfiniteCanvasWindowSceneChromeMetrics`
- `getInfiniteCanvasWindowSceneShell`
- `getInfiniteCanvasWindowSceneShellLayout`
- `getMinimumWorldLength`
- `toInfiniteCanvasWindowWorldRect`

<details><summary>types (6)</summary>

- `InfiniteCanvasScenePlane`
- `InfiniteCanvasWindowBodyProjection`
- `InfiniteCanvasWindowSceneChromeMetrics`
- `InfiniteCanvasWindowSceneHandle`
- `InfiniteCanvasWindowSceneShell`
- `InfiniteCanvasWindowSceneShellLayout`

</details>

**`scene-model`**

- `getInfiniteCanvasWindowSceneModel`
- `getInfiniteCanvasWindowSceneModels`

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

**`drop-interaction`**

- `EMPTY_INFINITE_CANVAS_DROP`
- `createInfiniteCanvasDropInteraction`
- `getInfiniteCanvasDropPlacement`
- `isPointInsideInfiniteCanvasViewport`
- `normalizeInfiniteCanvasDropValidation`

<details><summary>types (2)</summary>

- `InfiniteCanvasDropPlacement`
- `InfiniteCanvasDropPlacementInput`

</details>

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

<details><summary>types (87)</summary>

- `InfiniteCanvasAction`
- `InfiniteCanvasCamera`
- `InfiniteCanvasCameraNavigationBehavior`
- `InfiniteCanvasCameraNavigationRequest`
- `InfiniteCanvasCameraNavigationTarget`
- `InfiniteCanvasChromeMetrics`
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
- `InfiniteCanvasSpatialWindowArea`
- `InfiniteCanvasStackBands`
- `InfiniteCanvasState`
- `InfiniteCanvasTheme`
- `InfiniteCanvasViewport as InfiniteCanvasViewportSize`
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
- `InfiniteCanvasWindowFrameSurfaceProps`
- `InfiniteCanvasWindowFrameTitleProps`
- `InfiniteCanvasWindowMode`
- `InfiniteCanvasWindowProxy`
- `InfiniteCanvasWindowRegistry`
- `InfiniteCanvasWindowRenderContext`
- `InfiniteCanvasWindowSceneModel`
- `InfiniteCanvasWindowTextSelection`
- `InfiniteCanvasWindowWheelBehavior`
- `InfiniteCanvasZoomPolicy`
- `InfiniteCanvasZoomPolicyInput`

</details>

## `@infinite-canvas/react/scene`

A separate entry point, and the only one that imports `three` and
`@react-three/fiber`. Import it to opt into a 3D engine, then pass the surface
to `<InfiniteCanvasDesktop sceneSurface={...} />`. If you never import it, both
peers can stay uninstalled and neither enters your bundle.

```tsx
import { InfiniteCanvasWebGpuSurface } from "@infinite-canvas/react/scene";
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
