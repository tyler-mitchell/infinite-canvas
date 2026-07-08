# API Reference

The public surface of `@infinite-canvas/react`: 155 values and 131 types,
generated from the barrel (`packages/infinite-canvas/src/index.ts`) so it cannot
drift. Anything not exported from the barrel is internal and unstable —
including every `data-infinite-canvas-*` attribute, which is a behavioural hook
for hit-testing, not a styling contract.

> Pre-1.0: the API may change between minor versions. `createInfiniteCanvasHandle` is explicitly **experimental**.

## Components

`InfiniteCanvasDesktop` is the one component most apps mount.
`InfiniteCanvasViewport`, `InfiniteCanvasWindowLayer`,
`InfiniteCanvasWebGpuSurface` and `InfiniteCanvasHud` are its internals,
exported for custom shells; `InfiniteCanvas` is a namespace object bundling
them.

**`infinite-canvas`**

- `InfiniteCanvas`
- `InfiniteCanvasDesktop`
- `InfiniteCanvasHud`
- `InfiniteCanvasViewport`
- `InfiniteCanvasWebGpuSurface`
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

<details><summary>types (2)</summary>

- `InfiniteCanvasStateInput`
- `InfiniteCanvasWindowInput`

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
- `parseInfiniteCanvasRect`
- `parseInfiniteCanvasSelection`
- `parseInfiniteCanvasSerializedState`
- `parseInfiniteCanvasSize`
- `parseInfiniteCanvasWindow`

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
- `InfiniteCanvasHudPolicy`
- `InfiniteCanvasHudPolicyInput`
- `InfiniteCanvasInputPolicy`
- `InfiniteCanvasInteraction`
- `InfiniteCanvasMarqueeInteraction`
- `InfiniteCanvasMarqueeMode`
- `InfiniteCanvasMoveInteraction`
- `InfiniteCanvasMoveOriginRect`
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
