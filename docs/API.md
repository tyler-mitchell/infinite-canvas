# API reference

The public surface of `@hyphened/infinite-canvas`: 261 values and 206 types across two entries.
Anything absent from these barrels is internal and unstable.
This rule includes each `data-infinite-canvas-*` attribute, which supports hit tests instead of styles.

The project maintains this document by hand.
`verify-api-doc.mjs` makes sure that each export appears here.
`verify-api-stability.mjs` makes sure that each export module has a stability class.

Only `@hyphened/infinite-canvas/scene` imports `typegpu` and `@typegpu/react`.

> Pre-1.0: the API can change between minor versions.

## Stability

Each module has a stable or experimental class.
The changelog lists changes to stable exports under `Changed` or `Removed`.
An experimental export can change or disappear in a release.

The classifications are in
[`packages/infinite-canvas/scripts/api-stability.json`](../packages/infinite-canvas/scripts/api-stability.json)
and `verify-api-stability.mjs` enforces them.
A barrel cannot export a module without a class.
A new export inherits the class of its module.

| Reason             | Meaning                                                 | Modules                                                                                                                                                                                                                                                                                                                                                                                                                                                                                |
| ------------------ | ------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **unobserved**     | Product use does not exercise every exported path.      | `canvas-handle`                                                                                                                                                                                                                                                                                                                                                                                                                                                                        |
| **off-by-default** | Default configuration does not enable the path.         | `rasterization-layer`, `visibility`, `diagnostics`, `native-drop`                                                                                                                                                                                                                                                                                                                                                                                                                      |
| **compositor**     | The path is the new TypeGPU compositor behind `/scene`. | `scene-surface`, `scene:scene-surface`, `compositor/policy`, `scene:compositor/policy`, `scene:compositor/pass`, `scene:compositor/backend/camera`, `scene:compositor/backend/instances`, `scene:compositor/backend/surface`, `scene:compositor/passes/area-light`, `scene:compositor/passes/contact-shadow`, `scene:compositor/passes/focus-field`, `scene:compositor/passes/grid`, `scene:compositor/passes/particle-field`, `scene:compositor/passes/proximity`, `window-proximity` |

The `SceneLayer` types and `InfiniteCanvasWindowProximity` in `types.ts` also have the **compositor** reason.
The compositor records into TypeGPU's typed command encoder, which TypeGPU 0.12 marks unstable.
The affected type group includes `InfiniteCanvasSceneLayerRenderContext` beside stable geometry such as `InfiniteCanvasRect`.

The project removes exports that have no consumers.
`window-scene-shell` and `scene-model` lost their public exports.
`scene-model` duplicated `window-proxy`.
`window-scene-shell.ts` remains internal because `window-proxy` calls one of its functions.
`canvas-handle` is experimental because some methods have no product caller.

Polkadot uses `subscribeDocument`, `snapshot`, `getState`, and `commands`.
The handle method `subscribeDocument` supplies document changes.
No caller uses `subscribe` or the `getContextualCommands` handle method.
The slice method `subscribe` has no caller.
The radial menu calls `getAvailableInfiniteCanvasContextualCommands` directly.

`minimap` and `offscreen` have product consumers.
`viewportInsets` describes edge bands, while `viewportOccluders` describes covered rectangles.

### Stable geometry

`scene-layer-geometry`, `spatial-target`, and `window-proxy` are pure modules with consumers.
`geometry.ts` also remains in the main entry.
`verify-pure-core.mjs` makes sure that they do not import `three`.
They remain outside `/scene` so SVG overlays do not require the 3D peers.

## Components

`InfiniteCanvasDesktop` applies each `resolve*` default for `InfiniteCanvasViewport`.
You can also compose the provider and viewport directly.
`InfiniteCanvas.Viewport` uses the same completed policy values.

Direct composition does not require the `InfiniteCanvasDesktop` preset.
`InfiniteCanvas` exposes the same components as namespace properties.
Only `windowDefinitions` is required:

```tsx
<InfiniteCanvasProvider initialState={state}>
  <InfiniteCanvasViewport windowDefinitions={registry} />
</InfiniteCanvasProvider>
```

`compound-api.test.tsx` covers this composition.
`InfiniteCanvas` is a namespace object for the same components.

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

## State and store

The store adapts the pure reducer to Legend State signals.
`InfiniteCanvasProvider` supplies the store, and the hooks read it.
Use `useInfiniteCanvasSelector` for a narrow subscription in a window body.

A window can define `closable`, `maximizable`, `minimizable`, and `resizable` capabilities.
Each field is optional, and an absent field permits the operation.
`capabilities` uses the same default in the reducer and chrome.
`isInfiniteCanvasWindowCapable` applies this default.

The reducer enforces each capability.
`actions.closeWindow` returns unchanged state for a `closable: false` window.
`interaction.startResize` refuses a window that does not permit resizing.
Chrome controls remain present with `disabled` and `data-disabled`.
Resize handles are absent for a window that does not permit resizing.
Serialization omits a capability with the value `true` because absence has the same meaning.

**`workspace`**

Each workspace names a set of windows and stores its camera and selection.
`workspace` operations manage the ordered `workspaces` list.
If no workspace is active, the canvas shows all windows.
A workspace switch stores the outgoing camera and selection. It then restores the incoming values.

`activeWorkspaceId` and `workspaces` are part of the undo document.
The top-level camera and selection remain view state. Each workspace stores its own camera and selection.

- `findInfiniteCanvasWorkspace`: Returns one workspace by ID, or `null`.

<details><summary>types (1)</summary>

- `InfiniteCanvasWorkspace`: Contains `camera`, `id`, `selection`, `title`, and `windowIds`.

</details>

`useInfiniteCanvasActions` provides the workspace operations.
`reorderWorkspace({ toIndex, workspaceId })` moves a workspace to its final index.
`toIndex` has the same final-order meaning as `reorderGroupChild`.
An index outside the list is clamped.

**`workspace-membership`**

- `getInfiniteCanvasWorkspaceWindowIds`: Returns the active workspace window IDs. When no workspace is active, it returns `null`.
- `isInfiniteCanvasWindowInActiveWorkspace`: Reports whether one window is in the active workspace.

**`window-capabilities`**

- `isInfiniteCanvasWindowCapable`: Reads one capability and treats an absent value as permitted.

<details><summary>types (2)</summary>

- `InfiniteCanvasWindowCapability`: One of `"closable"`, `"maximizable"`, `"minimizable"`, or `"resizable"`.
- `InfiniteCanvasWindowCapabilities`: The optional capability set for a window. An absent field permits its operation.

</details>

`InfiniteCanvasProvider` accepts either `initialState` or a `store` from `createInfiniteCanvasStore`.
The two values together cause a compile error.
An injected store gives the parent read, subscription, command, and handle access.
Pass that store to `createInfiniteCanvasHandle` for a programmatic client.

`storageKey` enables persistence for internal and injected stores.
Store ownership does not change `storageKey` behavior.
For an immediate reset write, pass `onReset` to `createInfiniteCanvasStore`.
Without `onReset`, the normal debounce writes the reset.

**`store`**

- `InfiniteCanvasProvider`
- `createInfiniteCanvasStore`
- `useInfiniteCanvasActions`
- `useInfiniteCanvasSelectionBounds`: Returns bounds for selected windows and consumer targets.
- `useInfiniteCanvasSelector`
- `useInfiniteCanvasState`
- `useInfiniteCanvasState$`
- `useInfiniteCanvasStore`

<details><summary>types (3)</summary>

- `InfiniteCanvasSignals`: The store's GPU readback slices, `signals$`. View state: `proximity` is null until the compositor's proximity pass has run.
- `InfiniteCanvasStateValidator`
- `InfiniteCanvasStore`

</details>

When a control measures the full selection, use the selection bounds hook instead of `selection.windowIds.length`.

**`state`**

- `cloneInfiniteCanvasState`
- `resetInfiniteCanvasState`

## Factories

Use these factories to construct canonical state.
`defineInfiniteCanvasWindowRegistry` requires each registry key to equal its definition `kind`.
`getInfiniteCanvasWindowData` reads an opaque `data` payload through a type guard.
The registry input types each kind-specific `data` value before runtime erases it.

**`factory`**

- `createInfiniteCanvasState`
- `createInfiniteCanvasWindow`
- `defineInfiniteCanvasWindowRegistry`
- `getInfiniteCanvasWindowData`

<details><summary>types (3)</summary>

- `InfiniteCanvasStateInput`
- `InfiniteCanvasWindowInput`
- `InfiniteCanvasWindowRegistryInput`: Types each `data` value while you define the registry. Runtime state erases this type.

</details>

## Registry

These functions validate and normalize state against a window registry.
`recoverInfiniteCanvasStateForWindowRegistry` removes windows with an unknown `kind`.

**`registry`**

- `assertInfiniteCanvasStateMatchesWindowRegistry`
- `getRegisteredInfiniteCanvasWindowKinds`
- `getUnknownInfiniteCanvasWindowKinds`
- `isRegisteredInfiniteCanvasWindow`
- `isRegisteredInfiniteCanvasWindowKind`
- `normalizeInfiniteCanvasStateForWindowRegistry`
- `recoverInfiniteCanvasStateForWindowRegistry`

## Commands and keyboard

Every layout change uses a named command.
Pointer input, keyboard input, controls, and programmatic clients share this command path.
`getInfiniteCanvasContextualCommands` returns the commands that are available for the current state.

**`commands`**

- `DEFAULT_INFINITE_CANVAS_COMMAND_DESCRIPTORS`
- `executeInfiniteCanvasCommand`
- `getAvailableInfiniteCanvasContextualCommands`
- `getInfiniteCanvasCommandGroup`
- `getInfiniteCanvasContextualCommands`
- `getInfiniteCanvasHotkeyBindings`
- `isInfiniteCanvasCommandEnabled`

**`contextual-entries`**

`getInfiniteCanvasContextualEntries` combines canvas commands with consumer `hotkeyActions`.
It evaluates each `isEnabled` function against current state and binds each `run` function.
A consumer action replaces a canvas command with the same ID.
Only canvas entries have a `group`.
`isInfiniteCanvasCommandEnabled` controls canvas commands, while `hotkeyActions` supplies consumer actions.

- `getInfiniteCanvasContextualEntries`

<details><summary>types (1)</summary>

- `InfiniteCanvasContextualEntry`: Contains an ID, label, description, enablement, hotkeys, and a bound `run` function.

</details>

**`group-tree`**

- `createInfiniteCanvasGroupWindowNode`, `dockInfiniteCanvasGroupWindow`, `undockInfiniteCanvasGroupWindow`
- `findInfiniteCanvasGroupNode`, `getInfiniteCanvasGroupParent`, `getInfiniteCanvasGroupWindowIds`
- `isInfiniteCanvasGroupContainer`, `normalizeInfiniteCanvasGroupTree`, `DEFAULT_INFINITE_CANVAS_GROUP_WEIGHT`

<details><summary>types (5)</summary>

- `InfiniteCanvasGroupAxis`
- `InfiniteCanvasGroupContainerNode`
- `InfiniteCanvasGroupLayoutMode`: `"accordion" | "split" | "tabs"`
- `InfiniteCanvasGroupNode`
- `InfiniteCanvasGroupWindowNode`

</details>

**`group-layout`**

- `getInfiniteCanvasGroupLayout`: Converts a tree and shell rectangle into window rectangles, gutters, tab strips, and accordion headers.
- `getInfiniteCanvasGroupDockEdgeAtPoint`: Returns the dock edge at a point in a model rectangle.
- `getInfiniteCanvasGroupGutterWeights`: Returns the weights from a gutter drag.
- `getInfiniteCanvasGroupMinimumSize`: Returns the smallest size for gutters, strips, headers, and panes. It does not use member `minSize` values.
- `resolveInfiniteCanvasGroupMetrics`: Completes a partial `groupMetrics` value. The reducer and chrome use the result from `state.groupMetrics`.
- `DEFAULT_INFINITE_CANVAS_GROUP_METRICS`, `MINIMUM_GROUP_PANE_EXTENT`

Pass the minimum size to `startGroupResize`.
This result does not clamp against a member `minSize`.
This resolver follows `resolveInfiniteCanvasZoomPolicy` and `resolveInfiniteCanvasChromeMetrics`.
An explicit `undefined` value does not erase a default.

<details><summary>types (6)</summary>

- `InfiniteCanvasGroupAccordionHeader`
- `InfiniteCanvasGroupDockEdge`
- `InfiniteCanvasGroupGutter`
- `InfiniteCanvasGroupLayout`
- `InfiniteCanvasGroupTabStrip`
- `InfiniteCanvasGroupWindowPlacement`

</details>

**`group-state`**

- `findInfiniteCanvasGroup`, `getInfiniteCanvasWindowGroup`, `isInfiniteCanvasWindowGrouped`
- `getInfiniteCanvasGroupedWindowIds`, `getInfiniteCanvasGroupProjection`, `reconcileInfiniteCanvasGroups`
- `getInfiniteCanvasGroupableWindowIds`: Returns eligible window IDs in input order. It omits missing, minimized, and grouped windows.
- `getInfiniteCanvasGroupTitle`: Returns a supplied title. If `title` is `null`, it derives a title from current members.
- `DEFAULT_INFINITE_CANVAS_GROUP_TITLE`: Names an empty group. Use `title === null` to distinguish a derived title from a supplied title.
- `getInfiniteCanvasGroupTabLabel`: Returns a window title or the visible child label. A split container uses the group title.

This helper applies the same eligibility rules as `createInfiniteCanvasGroup`.
A persisted `string` value in `title` remains a supplied title.
A `title` value of `null` requests a derived title.
Pass `groupTabLabel` to replace the default tab label.

<details><summary>types (5)</summary>

- `InfiniteCanvasDockPreview`
- `InfiniteCanvasGroup`: A world object that owns a local layout.
- `InfiniteCanvasGroupProjection`
- `InfiniteCanvasGroupTabLabel`: The signature of the `groupTabLabel` prop.
- `InfiniteCanvasGroupTabLabelContext`: The child, its group, and the canvas windows.

</details>

**`window-focus`**

- `getInfiniteCanvasDirectionalFocusTarget`: Finds a focus target. It searches group members first, then the contextual group of a floating window.
- `getInfiniteCanvasContextualGroup`: Returns the smallest group that contains a point.
- `getInfiniteCanvasWindowNearestCameraCenter`: Returns the window nearest the camera center.
- `isInfiniteCanvasWindowFullyVisible`: Reports whether focus can change without camera movement.

<details><summary>types (1)</summary>

- `InfiniteCanvasDirection`

</details>

**`detail-level`**

Detail levels replace unreadable window content with a consumer summary.
Rasterization changes the image but does not change its information.

- `getInfiniteCanvasWindowDetailLevel`: Uses the rectangle, zoom, and previous level to return `"full" | "summary"`.
- `DEFAULT_INFINITE_CANVAS_DETAIL_POLICY`: Uses summary below 180 screen pixels and full content above 240 screen pixels.

The policy uses effective screen size instead of zoom.
The gap between thresholds supplies hysteresis.
`previousLevel` supplies the current level while the size remains inside that gap.

Add `renderSummary` to a window definition to enable summaries for that kind.
A window definition without a summary renderer always renders its body.

<details><summary>types (2)</summary>

- `InfiniteCanvasDetailLevel`: `"full" | "summary"`
- `InfiniteCanvasDetailPolicy`: `summaryBelowPx` and `fullAbovePx`.

</details>

**`window-arrange`**

Arrange functions align or distribute windows within their collective bounds.
They translate rectangles without resizing them and preserve input order.
They do not change a window size or its `minSize` constraint.

- `getInfiniteCanvasAlignedRects`: Returns rectangles that share the selected edge or centerline.
- `getInfiniteCanvasDistributedRects`: Returns rectangles with equal gaps and fixed outer rectangles.
- `getInfiniteCanvasSwappedRects`: Exchanges the centers of exactly two rectangles. Each rectangle keeps its size.

With a different rectangle count, `getInfiniteCanvasSwappedRects` returns the input unchanged.

`window.align` and `window.distribute` operate on the selection.
They omit grouped windows and have no default keyboard chords.
Use `hotkeyBindings` or a control to expose them.
These commands make one-time changes. They do not create a persistent layout mode.

<details><summary>types (2)</summary>

- `InfiniteCanvasAlignment`: `"left" | "right" | "top" | "bottom" | "horizontal-center" | "vertical-center"`
- `InfiniteCanvasDistribution`: `"horizontal" | "vertical"`

</details>

**`window-placement`**

- `getInfiniteCanvasWindowPlacementRect`: Places one size within a region of the supplied bounds. Placement does not snap.
- `getInfiniteCanvasVacantRect`: Finds the nearest clear rectangle of the same size.
- `getInfiniteCanvasPlacedWindowRect`: Finds where one window fits in the current state. It reads the camera, viewport insets, occluders, groups, and the windows of the active workspace.

`window-placement` places one window within a region.
`getInfiniteCanvasVacantRect` accepts `{ bounds, occupied, preferred, gapPx? }`.
It clamps `preferred` into `bounds` and returns it when that rectangle is clear.

Candidates then grow outward from `preferred` and can pass outside `bounds`.
A full viewport is a reason to look further out, not a reason to return an occupied rectangle.
The caller decides whether to move the camera to the result.

Supply `placement` to the `window.open` action to place a window through
`getInfiniteCanvasPlacedWindowRect` instead of supplying a rectangle.
The reducer resolves it from the state it holds.
A caller that computes a rectangle from its own snapshot places against a canvas that has changed,
and a caller that awaits before opening places against one that is older still.

The `window.place` command uses `Mod+Shift+Arrow` for halves and `Mod+Shift+Enter` for fill.
`window.place` defines the shared placement policy.
Center and quarter regions have no default chord.

`preventDefault()` consumes each owned chord.
`Mod+Alt+C` and `Mod+Shift+C` open browser developer tools, so the default map omits them.
`Mod+Alt+Arrow` changes browser tabs on macOS, so the default map omits it.
The command operates on the active window and refuses a grouped window.

<details><summary>types (2)</summary>

- `InfiniteCanvasWindowPlacementRegion`: Halves, quarters, `"fill"`, and `"center"`.
- `InfiniteCanvasWindowPlacement`: `{ gapPx?, region? }`. The region defaults to `"center"`.

The half regions are `"left" | "right" | "top" | "bottom"`.

</details>

**`minimap`**

This module returns minimap geometry and draws no user interface.
`getInfiniteCanvasMinimapLayout` accepts `(state, size, options?)`.
`getInfiniteCanvasMinimapWorldPoint` accepts `(layout, minimapPoint)`.

- `getInfiniteCanvasMinimapLayout`: Projects visible windows, groups, and the camera rectangle into a box. It uses one scale for both axes.
- `getInfiniteCanvasMinimapWorldPoint`: Converts a minimap point to its world point.

The layout includes the camera rectangle in the bounds.
The `size` value sets the minimap pixel box.
It returns `null` for an unmeasured viewport or an empty canvas.
It omits minimized windows and content hidden by a tab or collapsed accordion.
Pass the converted point to `navigateToPoint`.

<details><summary>types (4)</summary>

- `InfiniteCanvasMinimapGroup`
- `InfiniteCanvasMinimapLayout`
- `InfiniteCanvasMinimapOptions`
- `InfiniteCanvasMinimapWindow`

</details>

**`offscreen`**

- `getInfiniteCanvasOffscreenIndicators`: Returns offscreen targets from nearest to farthest.

The function accepts `(state, options?)`.

Each result has an edge `point`, clockwise `angle`, `distancePx`, and navigation `rect`.
The angle uses radians, and `0` points right.
A group produces one indicator for its shell.
The function omits minimized windows and members hidden by their group.
`options.limit` has no default limit.

<details><summary>types (3)</summary>

- `InfiniteCanvasOffscreenIndicator`
- `InfiniteCanvasOffscreenOptions`
- `InfiniteCanvasOffscreenTargetKind`

</details>

**`keyboard`**

- `focusInfiniteCanvasCommandSurface`
- `focusInfiniteCanvasCommandSurfaceFrom`: Returns focus from a child element to its canvas command surface.
- `registerInfiniteCanvasHotkeys`: Registers canvas commands and consumer actions in one keyboard scope.
- `shouldHandleInfiniteCanvasKeyboardEvent`

`bindings` replaces the default keymap.
`actions` adds consumer actions to the keymap.
`focusInfiniteCanvasCommandSurface` requires the command surface element.
Without focus restoration, chrome can leave focus on `<body>`.

<details><summary>types (2)</summary>

- `InfiniteCanvasHotkeyAction`: Defines `hotkeys`, `run(state)`, and optional `isEnabled(state)` for a consumer action.
- `InfiniteCanvasHotkeyRegistrationInput`

`spatialTargetResolvers` identifies a consumer object, and `selection.targets` stores its selection.
`InfiniteCanvasHotkeyBinding` changes the chord of a canvas command.

</details>

## Selection

Selection is explicit state and is separate from focus.
It contains window IDs and typed targets for scene objects or edges.
All selection functions are pure.

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

These functions frame a window, selection, visible windows, world point, or rectangle.
The available behaviors are `center`, `centerAtZoom`, and `fit`.

**`camera-navigation`**

- `DEFAULT_INFINITE_CANVAS_CAMERA_NAVIGATION_BEHAVIOR`
- `getCameraNavigationFrame`
- `getCameraNavigationTargetRect`
- `getNavigableWindow`
- `isCameraNavigationAvailable`
- `navigateCamera`
- `navigateCameraToWindow`

## Geometry helpers

These pure functions project points and rectangles for consumer overlays and scene layers.

**`geometry`**

- `getInfiniteCanvasContentViewport`
- `getInfiniteCanvasContentWorldRect`
- `getInfiniteCanvasOccluderWorldRects`: Converts screen occluder rectangles to world rectangles for the `occupied` input of `getInfiniteCanvasVacantRect`.
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

Camera framing ignores these occluders because a corner occluder must not shrink the full frame target.

**`constants`**

- `DEFAULT_INFINITE_CANVAS_INPUT_POLICY`
- `DEFAULT_INFINITE_CANVAS_SNAP_POLICY`
- `DEFAULT_INFINITE_CANVAS_ZOOM`
- `MIN_RENDERABLE_INFINITE_CANVAS_ZOOM`
- `resolveInfiniteCanvasChromeMetrics`
- `resolveInfiniteCanvasZoomPolicy`

`resolveInfiniteCanvasChromeMetrics` completes a partial `chrome` value with the viewport defaults.
Pass its result to `resolveInfiniteCanvasSpatialTarget`, which requires complete metrics.

`resizeHandleSize` and `groupLabelSize` use screen pixels.
The other four metrics use world units.
Set `groupLabelSize: 0` to hide the label.
Group tab strips and accordion headers use world units.

**`activity`**

The activity value describes the current canvas operation.
`getInfiniteCanvasPointerMode` returns the selected tool.
`isInfiniteCanvasActivityTransient` reports whether the activity lasts only while a pointer is down.

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

These functions support a connection drag between two windows.
The framework controls handle placement, handle visibility, and the live target.
The consumer decides whether the connection is valid and writes its domain value.

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

Pass the previous window to `getInfiniteCanvasConnectionAffordanceWindowId` during each pointer move.
The function keeps handles visible while the pointer is in their outer ring.
It changes the window only after the pointer enters another window.

`getInfiniteCanvasConnectionPreviewPath` accepts a point or rectangle as the far endpoint.
Both inputs use the same route logic.

`getInfiniteCanvasRectBundledConnectorPaths` routes one rect's connectors as a set.
Each target is grouped by the face it sits off, and one group shares one anchor and one trunk.
`getInfiniteCanvasRectConnectorPath` routes a pair alone, so a rect with many connectors meets them
at many boundary points and the fan reads as unrelated lines.
The trunk of a group sits midway between the source face and the nearest target in that group.
Paths come back in the order of the given targets.

`getInfiniteCanvasPathData` turns points into an SVG path and rounds the corners by `cornerRadius`.
A polyline can only draw sharp corners, so an orthogonal route arrives as right angles.
The points carry no unit: convert them to screen points first to keep one corner size at every zoom.
The reach shrinks to half of the shorter neighbouring segment, so a short segment bends and does not
overshoot.

## Scene layer helpers

These helpers provide window proxies, connector routes, scene transforms, and frustum visibility for `sceneLayers`.

**`scene-layer-geometry`**

- `getInfiniteCanvasLongestUnoccludedRun`
- `getInfiniteCanvasLongestUnoccludedSegment`
- `getInfiniteCanvasPathData`
- `getInfiniteCanvasRectBundledConnectorPaths`
- `getInfiniteCanvasRectConnectorPath`
- `getInfiniteCanvasRectConnectorPoint`
- `getInfiniteCanvasRectConnectorSegment`
- `getInfiniteCanvasSegmentsWithinRect`
- `getInfiniteCanvasUnoccludedRuns`
- `getInfiniteCanvasUnoccludedSegments`
- `getInfiniteCanvasViewportScreenRect`
- `getInfiniteCanvasWindowConnectorPath`
- `getInfiniteCanvasWindowConnectorPoint`
- `getInfiniteCanvasWindowConnectorSegment`
- `getInfiniteCanvasWindowProxyCullingRect`
- `getInfiniteCanvasWorldPath`
- `getInfiniteCanvasWorldPathPointAtProgress`
- `getInfiniteCanvasWorldSegment`
- `getVisibleInfiniteCanvasWindowProxies`

<details><summary>types (7)</summary>

- `InfiniteCanvasPathDataOptions`
- `InfiniteCanvasRectFacing`
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

- `useInfiniteCanvasVisibilitySummary`
- `useInfiniteCanvasWindowFramed`

<details><summary>types (2)</summary>

- `InfiniteCanvasVisibilityState`
- `InfiniteCanvasVisibilitySummary`

</details>

## Spatial targeting

These resolvers find the target under a pointer or drop point.
Targets can include windows, window areas, handles, empty space, overlays, scene objects, and edges.

**`spatial-target`**

- `createInfiniteCanvasEdgeTargetResolver`
- `createInfiniteCanvasOverlayTargetResolver`
- `createInfiniteCanvasSceneObjectTargetResolver`
- `getInfiniteCanvasSelectableTargetFromSpatialTarget`
- `getInfiniteCanvasSelectionBounds`: Returns bounds for selected windows and targets. Without target resolvers, it equals `getSelectedWindowBounds`.
- `getInfiniteCanvasSelectionTargetBounds`: Returns bounds for selected non-window targets. It omits a target without a resolver.
- `resolveInfiniteCanvasSpatialTarget`

<details><summary>types (6)</summary>

- `InfiniteCanvasSelectionBoundsInput`
- `InfiniteCanvasSpatialEdgeTarget`
- `InfiniteCanvasSpatialRectTarget`
- `InfiniteCanvasSpatialTargetInput`
- `InfiniteCanvasSpatialTargetResolverInput`
- `InfiniteCanvasSpatialTargetSource`

</details>

## Drag and drop

The drop policy carries a typed opaque payload through validation and commit.
`getInfiniteCanvasDropPlacement` gives the preview and commit the same snapped placement.

Native and internal drags use the same `canDrop`, `placement`, guide, and preview paths.
The framework sends each described drag to `canDrop`.
The `drag` state supplies the overlay preview.
The browser exposes only `types` before a native drop.

Add `InfiniteCanvasNativeDropPayload` to the consumer payload type.
Then narrow `payload.type` to `"files"` or `"text"`.
The browser keeps control of a native drag that the framework cannot describe.

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

The native-drop helper reads a drag that started outside the page.
Use it to add native drops to a consumer surface.
`null` means that the browser must control the drag.

- `getInfiniteCanvasNativeDropPayload`
- `URI_LIST_TYPE`

## Persistence and validation

Serialization uses versioned JSON and omits transient interaction state.
`documentKey` scopes the stored value.
Each `parse*` function validates the structure, removes unknown keys, and returns the value or `null`.

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
- `parseInfiniteCanvasRecipe`: Parses an untrusted recipe from storage.
- `parseInfiniteCanvasRect`
- `parseInfiniteCanvasSelection`
- `parseInfiniteCanvasSerializedState`
- `parseInfiniteCanvasSize`
- `parseInfiniteCanvasWindow`

## History (undo and redo)

History contains changes to document windows and groups.
Camera movement does not add an entry.
A drag adds one entry from its start state.
`INFINITE_CANVAS_HISTORY_LIMIT` limits session history, and serialization omits it.

**`history`**

- `canUndoInfiniteCanvas`, `canRedoInfiniteCanvas`: Report whether the commands are available.
- `undoInfiniteCanvasHistory`, `redoInfiniteCanvasHistory`
- `getInfiniteCanvasDocument`: Returns the document state that enters history.
  The framework renders that region itself as `data-slot="revealed-change"`, styled by
  `--icx-revealed-change` and faded by a CSS animation keyed on `token`, so each undo restarts it.
  Nothing clears the state: the element ends at zero opacity. `prefers-reduced-motion` hides it
  outright, because a mark that flashes and vanishes is worse than none for a reader sensitive to
  motion.

Undo and redo set `state.revealedChange` to `{ rect, token }` and frame that region when it is not
already fully in view. A change already on screen leaves the camera alone, because an unnecessary
jump is more disruptive than none, and it is still reported so a consumer can mark it. `token`
counts reveals: undoing twice in the same place yields the same rectangle, so a marker keyed on
geometry alone would not restart and the second undo would look like nothing happened. The field is
session state and is never serialized.

- `getInfiniteCanvasDocumentChangeRect`: Returns the world region that differs between two
  documents, or `null` when nothing placed moved. Undo on a canvas can revert something off screen,
  so a person sees no movement and presses undo again; pair this with `navigateToRect` to answer
  "where". A moved item contributes both rectangles, so the frame covers where it left and where it
  arrived. An item only one document holds contributes its one rectangle. An unchanged item
  contributes nothing, which is what stops every undo framing the whole canvas.
- `EMPTY_INFINITE_CANVAS_HISTORY`, `INFINITE_CANVAS_HISTORY_LIMIT`

<details><summary>types (2)</summary>

- `InfiniteCanvasDocument`
- `InfiniteCanvasHistory`

</details>

## Layout recipes

A recipe stores a selection, named set, or full canvas relative to its own origin.
A recipe application translates the arrangement and does not scale it.
The consumer owns and persists these serializable values.

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

A window frame uses `transform: scale(zoom)`.
This transform makes the frame the containing block for `position: fixed`.
Portals mount content outside the frame transform.
Set `portalRoot: true` on each window kind that requires a window portal.

**`portal`**

- `InfiniteCanvasPortal`: `scope="desktop"` escapes the window. `scope="window"` tracks it at natural size.
- `useInfiniteCanvasPortalRoots`
- `useInfiniteCanvasDesktopPortalRoot`
- `useInfiniteCanvasWindowPortalRoot`

<details><summary>types (1)</summary>

- `InfiniteCanvasPortalScope`

</details>

## Presence

These functions group active, visible, pinned, and minimized windows for docks, taskbars, and trays.

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

These types define the snapshot policy and scheduler for window bodies.
The `rasterization` prop enables this feature, which is off by default.

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

## Window proximity

The compositor's proximity pass measures the space between windows on the GPU each frame and publishes
one reading per window to `store.signals$.proximity`. Signals are the store's view state for GPU
readbacks: never in the undo document, never serialized. Window bodies and HUD read them through hooks;
no consumer wiring is needed beyond passing a scene surface.

**`window-proximity`**

- `useInfiniteCanvasWindowProximity`: Returns the latest reading for one window, or null before the compositor has measured it.

The reading type `InfiniteCanvasWindowProximity` (`nearest` world distance, `nearestWindowId`,
`neighbors`, crowding `pressure`) and the store's `InfiniteCanvasSignals` type live in `types` and
`store`.

## Compositor policy

The `compositor` prop on `InfiniteCanvasDesktop` selects which framework passes the scene surface runs
and tunes each one. Each field takes `true` for the defaults, `false` to remove the pass, or a partial
options object. The viewport resolves the input once and passes the resolved policy to the surface.
The policy has no GPU import, so a consumer without `/scene` can still read the defaults.

**`compositor/policy`**

- `DEFAULT_INFINITE_CANVAS_COMPOSITOR`
- `resolveInfiniteCanvasCompositorPolicy`

<details><summary>types (7)</summary>

- `InfiniteCanvasCompositorPolicy`
- `InfiniteCanvasCompositorPolicyInput`
- `InfiniteCanvasContactShadowOptions`: `offsetPx`, `softnessPx`, `opacity`, and `cornerRadiusPx` of the shadow below each window.
- `InfiniteCanvasFocusFieldOptions`: `reachPx` and `dimStrength` of the attention field.
- `InfiniteCanvasParticleFieldOptions`: `count`, `sizePx`, `opacity`, `tint`, the motion terms `gravity`, `reach`, `drift`, `damping`, `maxSpeed` in world units, `activeBoost`, the extra pull of the active window, and `respectReducedMotion`, which places the particles once and stops when the viewer prefers reduced motion.
- `InfiniteCanvasAreaLightOptions`: `heightStep`, the world units a window rises per step up the stack, and `intensity`.
- `InfiniteCanvasGridOptions`: `minorOpacity`, `majorOpacity`, `majorEvery`, `lineWidthPx`, `tint`, and `falloff`, how much the grid fades toward the edges of the view.
- `InfiniteCanvasProximityOptions`: `reach` in world units.

</details>

## Diagnostics

Developer overlays use inline styles and do not require `theme.css`.

**`diagnostics`**

- `DEFAULT_INFINITE_CANVAS_DIAGNOSTICS`
- `resolveInfiniteCanvasDiagnosticsPolicy`

<details><summary>types (2)</summary>

- `InfiniteCanvasDiagnosticsPolicy`
- `InfiniteCanvasDiagnosticsPolicyInput`

</details>

## Theming and data attributes

`data-slot` is the public selector contract for styles.
`theme.css` targets these attributes.
The `data-infinite-canvas-*` attributes are internal behavior hooks.
`hud` policy resolution is part of this module group.

`theme.css` uses one `infinite-canvas` cascade layer.
The `infinite-canvas` layer gets its order from its first declaration.
Use `theme.css` as the full token inventory.
If the application uses cascade layers, declare the order before the imports:

```css
@layer infinite-canvas, components, utilities;
```

This declaration keeps `utilities` after the canvas theme.
Unlayered styles override all layers.
If utilities must override them, put slot overrides in the middle layer.

### The `--icx-*` tokens

`theme.css` defines the full token list.
The tokens have three groups:

1. Eleven bridged tokens mirror `DEFAULT_INFINITE_CANVAS_THEME`. The `theme` prop writes these values.
2. Semantic color tokens include `--icx-color-foreground`,
   `--icx-color-accent`, `--icx-color-shadow`, `--icx-color-surface-raised`,
   `--icx-color-surface-sunken`, `--icx-color-accent-muted`,
   `--icx-color-accent-surface`, and the ramp
   `--icx-color-accent-bright` / `-soft` / `-dim` / `-faint`.
3. Per-slot tokens cover controls, host chrome, snapping, marquees, HUD elements, and groups.

`theme-tokens.test.ts` compares the bridged tokens with the default theme.
`--icx-group-gutter` styles a group seam.
`--icx-group-tab-fg` styles inactive tab text.
`--icx-group-label-fg-active` styles the label of the active group.

The accent ramp is brighter than the accent for use on a dark surface.
If one slot must differ from its semantic token, override its per-slot token.

The runtime writes `--icx-chrome-stroke`, `--icx-resize-handle-size`, and `--icx-screen-px` on each window frame.
It writes `--icx-group-label-size` on each group shell.
These world lengths keep a constant screen size.
Read these tokens in overrides.
Do not declare these tokens because the next camera frame overwrites their inline values.
`--icx-group-label-text-scale` controls the text size as a fraction of the label band.

**`data-attributes`**

- `INFINITE_CANVAS_SLOTS`
- `getInfiniteCanvasWindowStateAttributes`

<details><summary>types (1)</summary>

- `InfiniteCanvasSlot`

</details>

**`canvas-hud`**

- `DEFAULT_INFINITE_CANVAS_HUD_POLICY`
- `resolveInfiniteCanvasHudPolicy`

## Announcements

Each canvas has one `aria-live` region for its full mount lifetime.
This region does not depend on HUD chrome.

**`announcer`**

- `useInfiniteCanvasAnnounce`: Sends a message to a screen reader. It ignores duplicate messages and calls outside a canvas.

## Icons

The package includes inline SVG icons and has no icon library dependency.
The `icons` prop overrides each action icon.

**`icons`**

- `DEFAULT_INFINITE_CANVAS_ICONS`
- `useInfiniteCanvasIcons`

<details><summary>types (3)</summary>

- `InfiniteCanvasIconName`
- `InfiniteCanvasIconProps`
- `InfiniteCanvasIcons`

</details>

## Handle (experimental)

`createInfiniteCanvasHandle(store)` returns a state snapshot, typed commands, and contextual command descriptors.
This experimental shape can change before 1.0.

**`canvas-handle`**

- `createInfiniteCanvasHandle`

<details><summary>types (1)</summary>

- `InfiniteCanvasHandle`

</details>

## Types

This section lists all public types.
The size type `InfiniteCanvasViewport` is exported as `InfiniteCanvasViewportSize` to prevent a name conflict with the component.

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
- `InfiniteCanvasGroupMetrics`, `InfiniteCanvasGroupMetricsInput`: The three chrome sizes and their partial input. `state.groupMetrics` holds the completed value.
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
- `InfiniteCanvasOverlayReadContext`: A read-only context that is covariant in `Payload`.
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
- `InfiniteCanvasSceneLayerPlacement`
- `InfiniteCanvasSceneLayerRenderContext`
- `InfiniteCanvasSceneLayerSpace`
- `InfiniteCanvasSelection`
- `InfiniteCanvasSelectionTarget`
- `InfiniteCanvasSelectionTargetType`
- `InfiniteCanvasSerializedState`
- `InfiniteCanvasSize`
- `InfiniteCanvasSnapGuide`
- `InfiniteCanvasSnapPolicy`
- `InfiniteCanvasSnapPreview`
- `InfiniteCanvasSpatialTarget`
- `InfiniteCanvasSpatialTargetGeometryContext`
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
- `InfiniteCanvasViewportInsets`, `InfiniteCanvasViewportInsetsInput`: One chrome inset per viewport edge.
- `InfiniteCanvasViewportOccluder`: A viewport rectangle covered by consumer chrome, in screen pixels.
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

### Headless slots

Each frame slot accepts `id`, `role`, `tabIndex`, `aria-*` attributes, DOM events, `ref`, and a replacement element.
The `render` prop replaces the element:

```tsx
renderFrame: ({ frame: { Header, Surface } }) => (
  <Surface>
    <Header render={(props, { children }) => <nav {...props}>{children}</nav>} />
  </Surface>
);
```

The framework keeps its behavior while the consumer selects the element.
React 19 passes `ref` as an ordinary prop, so `forwardRef` is not necessary.

The merge uses Base UI `mergeProps` rules:

| Prop kind       | Rule                                                                                                          |
| --------------- | ------------------------------------------------------------------------------------------------------------- |
| Event handlers  | Both run, with the consumer first. Call `event.preventInfiniteCanvasHandler()` to skip the framework handler. |
| `className`     | Values concatenate, with the consumer first.                                                                  |
| `style`         | Values shallow-merge, with the consumer last.                                                                 |
| `data-slot`     | The framework owns this value.                                                                                |
| Everything else | The consumer owns the value.                                                                                  |

An `onPointerDown` consumer handler runs before the framework handler.
`preventDefault` controls the browser action, not the framework handler.

- `InfiniteCanvasWindowFrameSurfaceProps`
- `InfiniteCanvasWindowFrameTitleProps`
- `InfiniteCanvasWindowMode`
- `InfiniteCanvasWindowProximity`: One window's GPU proximity reading: `nearest`, `nearestWindowId`, `neighbors`, `pressure`.
- `InfiniteCanvasWindowProxy`
- `InfiniteCanvasWindowRegistry`
- `InfiniteCanvasWindowRenderContext`
- `InfiniteCanvasWindowTextSelection`
- `InfiniteCanvasWindowWheelBehavior`
- `InfiniteCanvasZoomPolicy`
- `InfiniteCanvasZoomPolicyInput`

</details>

## `@hyphened/infinite-canvas/scene`

This separate entry is the only entry that imports `typegpu` and `@typegpu/react`.
Import this entry.
Then pass its surface to `<InfiniteCanvasDesktop sceneSurface={...} />`.
If the application does not import this entry, it does not require or bundle these peers.

```tsx
import { InfiniteCanvasCompositorSurface } from "@hyphened/infinite-canvas/scene";
```

The compositor is a render graph. A scene layer is a pass: `build` runs once against the device and
returns `record`, which draws into one shared render pass each frame. Every pass reads the camera of
its space through the `camera` accessor and every window instance through the `instances` accessor.
The surface binds both on the configured root it hands to `build`.

**`scene`**

- `InfiniteCanvasCompositorSurface`: The transparent WebGPU surface that paints `sceneLayers`. Each draw takes the canvas from `target()` and submits its own render pass: the first claim of a frame clears, every later one keeps what is already there. Memoize the `sceneLayers` array: the surface builds every pipeline again when the array identity changes.
- `createInfiniteCanvasAreaLightPass`: The medium lit by the windows above it. Each window is a rectangular area light and the floor takes its diffuse irradiance, so falloff and softness come from the geometry rather than a radius. A window higher in the stack casts a wider, weaker pool. Mounted by the surface from `compositor.areaLight`, which is off by default: irradiance on a featureless plane is a radial gradient, so it reads as an aura until the medium has structure. Set `areaLight` to `true` or an object to turn it on.
- `DEFAULT_AREA_LIGHT_OPTIONS`: The area light defaults.
- `screenToWorld`: The inverse of `worldToScreen`, for a pass that shades a point on the medium.
- `createInfiniteCanvasGridPass`: The grid of the medium, drawn in world space and faded toward the edges of the view so the plane recedes instead of tiling flat. Mounted by the surface from `compositor.grid`; while it is mounted the CSS backdrop stands down, so there is one grid.
- `DEFAULT_GRID_OPTIONS`: The grid defaults.
- `createInfiniteCanvasContactShadowPass`: A soft shadow below each window from the union of the window distance fields, so the plane reads as lifted from the medium. Mounted by the surface from `compositor.contactShadow`.
- `createInfiniteCanvasFocusFieldPass`: The attention field. The medium stays bright around the active window and dims with distance from it. Mounted by the surface from `compositor.focusField`, which is off by default because the halo it leaves reads as an aura; set `focusField` to `true` or an object to turn it on.
- `createInfiniteCanvasParticleFieldPass`: Small particles in the medium that drift and fall gently toward the windows. One compute dispatch and one instanced draw per frame; it keeps the surface redrawing. Mounted by the surface from `compositor.particleField`.
- `Particle`, `Particles`, `PARTICLE_CAPACITY`: The particle record, its fixed-capacity array, and the capacity.
- `instanceCount`: The accessor a shader reads for how many leading `instances` are live this frame.
- `createInfiniteCanvasProximityPass`: The first shipped compute pass. It measures the gap between every pair of windows on the GPU and publishes nearest neighbour, neighbour count, and crowding pressure to the canvas store's proximity signal. Mounted by the surface from `compositor.proximity`, which is off by default because the pass costs a compute dispatch and a GPU-to-CPU map every frame and the map forces a synchronisation; set `proximity` to `true` or an object to turn it on.
- `DEFAULT_INFINITE_CANVAS_COMPOSITOR`, `DEFAULT_CONTACT_SHADOW_OPTIONS`, `DEFAULT_FOCUS_FIELD_OPTIONS`, `DEFAULT_PARTICLE_FIELD_OPTIONS`, `DEFAULT_PROXIMITY_OPTIONS`: The default policy and the per-pass defaults each factory takes when called without options.
- `WindowProximity`, `WindowProximities`: The per-window proximity record and its fixed-capacity array.
- `CompositorCamera`: The camera uniform schema. `viewport` and `zoom` are CSS pixels; `devicePixelRatio` is the viewport's ratio.
- `camera`: The accessor a shader reads for the camera of the pass's space.
- `WindowInstance`, `WindowInstances`: Per-window instance data, and the fixed-capacity array of it.
- `instances`: The accessor a shader reads for every window instance.
- `worldToScreen`, `screenToClip`: Shader functions that match the DOM plane's projection.
- `PREMULTIPLIED_OVER_BLEND`, `ADDITIVE_BLEND`: The two blend states a pass gives `targets.blend`. The canvas is premultiplied, so a pass that lays paint on the medium takes the first; a pass whose contributions add rather than cover takes the second.

<details><summary>types (9)</summary>

- `CompositorBuildContext`: `configured` (TypeGPU's `WithBinding`, with the camera and window instances already bound), `format`, `root`, `signals$`.
- `CompositorBuiltPass`: `build` output: optional `compute` (dispatches before every draw), optional `record` (draws), optional `readback` (after the draws, the only place a GPU-to-CPU read may start).
- `CompositorColorAttachment`: the canvas as one draw sees it: `view`, `loadOp`, `storeOp`, and `clearValue`.
- `CompositorFrameBase`: `context`, `instanceCount`, `deltaSeconds`, and `elapsedSeconds`.
- `CompositorFrame`: a `CompositorFrameBase` and `target`.
- `CompositorTarget`: claims the canvas for one draw. The first claim of a frame clears it; later claims keep what earlier draws put there.
- `InfiniteCanvasScenePass`
- `InfiniteCanvasSceneSurface`
- `InfiniteCanvasSceneSurfaceProps`

</details>

The main entry also exports both types.
This lets a consumer type `sceneSurface` without importing the scene entry.
