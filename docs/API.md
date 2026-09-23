# API reference

The public surface of `@hyphened/infinite-canvas`: 235 values and 228 types.

Anything absent from the public barrels is internal and unstable.
This rule includes each `data-infinite-canvas-*` attribute, which supports hit tests instead of styles.

The project maintains this document by hand.
`verify-api-doc.mjs` makes sure that each export appears here.
`verify-api-stability.mjs` makes sure that each export module has a stability class.

Only `@hyphened/infinite-canvas/scene` imports `typegpu` and `@typegpu/react`.
Import state and geometry APIs from `@hyphened/infinite-canvas/core`.
The main entry adds React components and hooks.

> Pre-1.0: the API can change between minor versions.

## Workspace `/next` API

Portfolio Board uses `@hyphened/infinite-canvas/next`.
The package's published entry points still use the API described below.

`canvas.commands.openWindow.run` accepts one floating placement or one docking target:

- `placement: { region, gap? }`: viewport placement.
- `placement: { relativeTo, side, matchWidth?, gap? }`: placement beside a visible window.
  `side` is `left`, `right`, `top`, or `bottom`. `matchWidth` copies the anchor width at creation.
  Placement clears existing content along that side. Existing windows keep their rectangles.
- `target: { window, edge? }`: dock into or beside a window.

`groupWindows` accepts `heightMode` and `section` at creation.
Use `heightMode: "content"` for a group that grows with its children.
Use `section: false` to exclude the group from the reading route.

Camera motion uses D3 zoom interpolation. `cameraMotion.curvature` defaults to `sqrt(2)`;
values near zero approach a straight path. `transition` controls timing and
`reducedMotion` controls whether navigation animates.
`navigateCamera` and `revealWindow` accept `curvature` and `reducedMotion` overrides.
Set `reducedMotion: "always"` for immediate navigation.

`useCanvasOccluder<Element>()` returns a callback ref for a viewport overlay.
Attach it to the overlay element. It reports the element's screen rectangle,
updates it on element or viewport resize, and removes it when the element detaches.
The return value has no `.current` property.

```ts
createCanvasState({
  document,
  windowDefinitions,
  cameraMotion: {
    curvature: 0.8,
    transition: { type: "tween", duration: 0.45, ease: "easeInOut" },
    reducedMotion: "user",
  },
});
```

## Stability

Each module has a stable or experimental class.
The changelog lists changes to stable exports under `Changed` or `Removed`.
An experimental export can change or disappear in a release.

The classifications are in
[`packages/infinite-canvas/scripts/api-stability.json`](../packages/infinite-canvas/scripts/api-stability.json)
and `verify-api-stability.mjs` enforces them.
A barrel cannot export a module without a class.
A new export inherits the class of its module.

| Reason             | Meaning                                                | Modules                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                               |
| ------------------ | ------------------------------------------------------ | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **unobserved**     | Product use does not exercise every exported path.     | `tools`, `use-component-palette`, `component`, `command-trigger`, `schema`                                                                                                                                                                                                                                                                                                                                                                                                                                                                                            |
| **off-by-default** | Default configuration does not enable the path.        | `rasterization-layer`, `visibility`, `diagnostics`, `native-drop`                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                     |
| **compositor**     | The path uses the TypeGPU compositor through `/scene`. | `scene-surface`, `scene:scene-surface`, `compositor/policy`, `scene:compositor/policy`, `scene:compositor/pass`, `scene:compositor/backend/camera`, `scene:compositor/backend/surface`, `scene:compositor/backend/instances`, `scene:compositor/passes/area-light`, `scene:compositor/passes/connections`, `scene:compositor/passes/contact-shadow`, `scene:compositor/passes/drop-preview`, `scene:compositor/passes/focus-field`, `scene:compositor/passes/grid`, `scene:compositor/passes/particle-field`, `scene:compositor/passes/proximity`, `window-proximity` |

The `SceneLayer` types and `InfiniteCanvasWindowProximity` in `types.ts` also have the **compositor** reason.
The compositor records into TypeGPU's typed command encoder, which TypeGPU 0.12 marks unstable.
The affected type group includes `InfiniteCanvasSceneLayerRenderContext` beside stable geometry such as `InfiniteCanvasRect`.

The project removes exports that have no consumers.
`window-scene-shell` and `scene-model` lost their public exports.
`scene-model` duplicated `window-proxy`.
`window-scene-shell.ts` remains internal because `window-proxy` calls one of its functions.
Polkadot uses `document$`, `snapshot`, `getState`, and `dispatch`.
The derived `document$` observable supplies completed document changes.
The radial menu calls `getAvailableInfiniteCanvasContextualCommands` directly.

`minimap` and `offscreen` have product consumers.
`viewportInsets` describes edge bands, while `viewportOccluders` describes covered rectangles.

### Stable geometry

`scene-layer-geometry`, `spatial-target`, and `window-proxy` are pure modules with consumers.
`geometry.ts` also remains in the main entry.
`verify-pure-core.mjs` makes sure that they reach none of the GPU stack.
They remain outside `/scene` so SVG overlays do not require the optional peers.

## Registered window content

- `getCanvasLayout`, `CanvasLayout`, `getTargetBounds`, `TransformTarget`: projected bounds and visibility.
- `defineComponent`, `defineComponentRegistry`, `ComponentRenderContext`: registered content rendering.
- `CommandId`, `CommandTrigger`, `CommandTriggerProps`, `CommandMenuItem`, `CommandMenuItemProps`: command controls.
- `ComponentPalettePayload`, `useComponentPalette`: palette insertion state and controls.
- `createComponentWindow`, `insertComponent`: window-based component insertion.
- `editComponentProps`: validates authored properties and dispatches one content edit.
- `resolveInfiniteCanvasGroupInsertion`: group placement for component insertion.
- `InfiniteCanvasDocument`: the persisted canvas document.
- `DocumentContent`: the document fields that history restores and persistence saves.

```tsx
import {
  InfiniteCanvas,
  createInfiniteCanvasStore,
  defineComponentRegistry,
} from "@hyphened/infinite-canvas";
import { type } from "arktype";
import "@hyphened/infinite-canvas/theme.css";

const components = defineComponentRegistry({
  window: { bodyPointerBehavior: "move", textSelection: "native" },
  components: {
    note: {
      schema: type({ text: "string = ''" }),
      render: ({ text }) => <p>{text}</p>,
    },
  },
});
const store = createInfiniteCanvasStore({ windows: [] });

<InfiniteCanvas.Provider store={store} storageKey="notes">
  <InfiniteCanvas.Viewport windowDefinitions={components} componentPalette>
    <InfiniteCanvas.Palette.Root>
      <InfiniteCanvas.Palette.Input aria-label="Search components" />
      <InfiniteCanvas.Palette.List>
        {({ id }) => (
          <InfiniteCanvas.Palette.Item key={id} componentId={id}>
            {id}
          </InfiniteCanvas.Palette.Item>
        )}
      </InfiniteCanvas.Palette.List>
      <InfiniteCanvas.Palette.Empty>No matching components.</InfiniteCanvas.Palette.Empty>
      <InfiniteCanvas.Palette.Error />
    </InfiniteCanvas.Palette.Root>
  </InfiniteCanvas.Viewport>
</InfiniteCanvas.Provider>;
```

Each component definition is a native window definition: `window.kind` selects it,
and `window.data` contains its authored properties. The schema supplies rendering
values; edits preserve authored inputs and enter the shared reducer path.
`window` supplies registry-wide frame and interaction defaults; individual
definitions can override those same native window options.
The store owns `getState`, `snapshot`, `getContextualCommands`, and
`document$`; content edits use the same state and dispatch path.

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

### Component authoring

```tsx
import { type } from "arktype";
import {
  createInfiniteCanvasStore,
  defineComponent,
  insertComponent,
} from "@hyphened/infinite-canvas";

const components = {
  note: defineComponent({
    id: "note",
    schema: type({ text: "string = ''" }),
    render: ({ text }) => <p>{text}</p>,
  }),
};
const store = createInfiniteCanvasStore({ windows: [] });
const result = insertComponent({
  store,
  components,
  input: {
    windowId: "note-1",
    componentId: "note",
    props: { text: "A note" },
    rect: { x: 0, y: 0, width: 320, height: 240 },
  },
});
```

`insertComponent` returns the created window, an `Error`, or ArkType errors.
`createComponentWindow` creates the validated window without dispatching it.
A window registry renders the instance through its component definition.
`defineComponent` and `defineComponentRegistry` accept an optional `size` per component.
The palette uses this size for insertion and drag previews; the default is 320 × 240 world units.

```tsx
<InfiniteCanvas.Palette.Root>
  <InfiniteCanvas.Palette.Input aria-label="Search components" />
  <InfiniteCanvas.Palette.List>
    {({ id }) => (
      <InfiniteCanvas.Palette.Item key={id} componentId={id}>
        {id}
      </InfiniteCanvas.Palette.Item>
    )}
  </InfiniteCanvas.Palette.List>
  <InfiniteCanvas.Palette.Empty>No matching components.</InfiniteCanvas.Palette.Empty>
</InfiniteCanvas.Palette.Root>
```

An item inserts on activation and uses native canvas drag/drop when dragged.
The palette uses Base UI Autocomplete for filtering and keyboard navigation.
`Root.autocomplete` accepts its input, filter, and navigation options; items and inline visibility are framework-owned.
`Input`, `Clear`, and `Empty` expose the native parts. Visual treatment belongs to the consumer.
`resolveComponentProps` resolves literals and record bindings, then applies an optional component schema.
Its result includes effective props and their origins. Required missing bindings return an error.

For group insertion, supply `target: { groupId, containerId?, index?, layout? }`.
The container defaults to the group root. `layout` accepts masonry `x`, `y`, `span`, `rows`, and `hidden`.
An explicit rectangle is optional when a target group is supplied.

`editComponentProps({ store, definition, input })` accepts `{ windowId, props }`.
It merges the properties into the current window data and validates the result before dispatching.

`CommandTrigger` and `CommandMenuItem` accept `commandId` and their Base UI component props.
They derive labels and availability from the command catalog and recheck availability on activation.

### Content sizing

`window.heightMode` accepts `"content"` or `"manual"`.
Dispatch `{ type: "window.setContentHeight", windowId, height }` with an outer height in world units.
It updates floating height or masonry rows. Manual windows ignore this command.
Pointer and keyboard resizing select manual height control.
Dispatch `window.setRect` to update a floating window's rectangle.
`InfiniteCanvas.Content` supplies the allocated body height in manual mode and measures intrinsic height in content mode.

`bodyPointerBehavior: "move"` makes non-interactive body content a drag handle.
`bodyDragThresholdPx` defaults to 6 screen pixels.
Body focus uses a React Fragment ref to enter the first focusable descendant.
`--icx-layout-transition` overrides the default spring transition for frame position and size.
`--icx-content-layout-transition` overrides position and width transitions for content-sized frames.
Content-sized frame height follows measured content without a second transition.
Pointer-owned frames and reduced-motion rendering use no transition.

**`schema`**

- `canvasModel` — ArkType module for canvas geometry, windows, groups, selection, and persisted data.

The store adapts the pure reducer to Legend State signals.
`InfiniteCanvasProvider` supplies the store, and the hooks read it.
Use `useInfiniteCanvasSelector` for a narrow subscription in a window body.

A window can define `closable`, `maximizable`, `minimizable`, `movable`, and `resizable` capabilities.
Each field is optional, and an absent field permits the operation.
`capabilities` uses the same default in the reducer and chrome.
`isInfiniteCanvasWindowCapable` applies this default.

The reducer enforces each capability.
`window.close` returns unchanged state for a `closable: false` window.
`interaction.startResize` refuses a window that does not permit resizing.
`interaction.startMove`, `window.nudge`, `window.place`, and the arrange commands skip a floating window with `movable: false`. A grouped window still moves with its shell.
Chrome controls remain present with `disabled` and `data-disabled`.
Resize handles are absent for a window that does not permit resizing.
Serialization omits a capability with the value `true` because absence has the same meaning.

```ts
dispatch({
  type: "interaction.startMove",
  target: { type: "window", id: "note-1" },
  pointerId,
  point,
});
dispatch({
  type: "interaction.startMove",
  target: { type: "group", id: "collection-1" },
  pointerId,
  point,
});
```

`point` uses viewport coordinates. Missing targets leave state unchanged.

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

`useInfiniteCanvasDispatch` provides the canvas dispatch function.
Dispatch `{ type: "workspace.reorder", toIndex, workspaceId }` to move a workspace.
`workspace.create` enters the new workspace unless `activate` is `false`.
`toIndex` has the same final-order meaning as `reorderGroupChild`.
An index outside the list is clamped.

**`workspace-membership`**

- `getInfiniteCanvasWorkspaceWindowIds`: Returns the active workspace window IDs. When no workspace is active, it returns `null`.
- `isInfiniteCanvasWindowInActiveWorkspace`: Reports whether one window is in the active workspace.

**`window-capabilities`**

- `isInfiniteCanvasWindowCapable`: Reads one capability and treats an absent value as permitted.

<details><summary>types (2)</summary>

- `InfiniteCanvasWindowCapability`: One of `"closable"`, `"maximizable"`, `"minimizable"`, `"movable"`, or `"resizable"`.
- `InfiniteCanvasWindowCapabilities`: The optional capability set for a window. An absent field permits its operation.

</details>

`InfiniteCanvasProvider` accepts either `initialState` or a `store` from `createInfiniteCanvasStore`.
The two values together cause a compile error.
An injected store gives the parent read, subscription, snapshot, and dispatch access.

`storageKey` enables persistence for internal and injected stores.
Store ownership does not change `storageKey` behavior.
Reset publishes through `store.document$`, like other completed edits.
Subscribe with `store.document$.onChange(({ value }) => { ... })`.
The value is `null` during an interaction; persist non-null values.

**`store`**

- `createInfiniteCanvasStore`

**`react/store`**

- `InfiniteCanvasProvider`
- `useInfiniteCanvasDispatch`
- `useInfiniteCanvasSelectionBounds`: Returns bounds for selected windows and consumer targets.
- `useInfiniteCanvasSelector`
- `useInfiniteCanvasState`
- `useInfiniteCanvasState$`
- `useInfiniteCanvasStore`

<details><summary>types (3)</summary>

- `InfiniteCanvasSignals`: The store's GPU readback slices, `signals$`. View state: `proximity` is null until the compositor's proximity pass has run.
- `InfiniteCanvasStoreOptions`: The options `createInfiniteCanvasStore` accepts.
- `ComponentAction`: A named edit a component declares for its own data, with `set` or `update`.
- `ContextMenuPolicy`: Which context menu a right-click opens, per target.
- `InfiniteCanvasStore`

</details>

`InfiniteCanvasStore.dispatch` is the only mutation entry point.
`useInfiniteCanvasDispatch` returns the same function inside the provider.
Send operations as `InfiniteCanvasAction` values:

```tsx
import { useInfiniteCanvasDispatch } from "@hyphened/infinite-canvas";

function CanvasControls() {
  const dispatch = useInfiniteCanvasDispatch<"note">();

  return (
    <>
      <button onClick={() => dispatch({ type: "window.focus", windowId: "note-1" })}>Focus</button>
      <button onClick={() => dispatch({ type: "history.undo" })}>Undo</button>
      <button onClick={() => dispatch({ type: "view.fitAll" })}>Fit all</button>
    </>
  );
}
```

`InfiniteCanvasAction` is one discriminated union for commands and targeted mutations:

- `camera.*`: navigate, pan, and zoom.
- Command actions include selection, history, layout, workspace, and view operations.
- `connection.*`: open, close, and update connections.
- `desktop.*`: hydrate or reset the desktop.
- `group.*`: create, close, dock, undock, reorder, and update group layout.
- `interaction.*`: start, step, and finish pointer interactions.
- `recipe.apply`: place a saved layout recipe.
- `selection.*`: add, remove, replace, toggle, select all, and edit target selection.
- `viewport*` and `groupMetrics.set`: publish measured canvas inputs.
- `window.*`: open, close, focus, restore, resize, rename, and update window data.
- `workspace.*`: create, close, activate, reorder, rename, and change membership.

Window, drop, overlay, and scene render contexts expose the same dispatch function.
`store.getContextualCommands()` returns enabled commands.
`store.getContextualCommands({ includeDisabled: true })` also returns unavailable commands.
The store option `getSelectionBounds(state)` supplies bounds for consumer selection targets.
The store resolves this callback once for each action that needs selection geometry.

When a control measures the full selection, use the selection bounds hook instead of `selection.windowIds.length`.

**`stacking`**

- `findInfiniteCanvasWindow`: Returns one window by ID, or `null`. The reducer's own lookup, published because every consumer was writing `state.windows.find((window) => window.id === id) ?? null` by hand.

## Factories

Use these factories to construct canonical state.
`defineInfiniteCanvasWindowRegistry` requires each registry key to equal its definition `kind`.
`getInfiniteCanvasWindowData` reads an opaque `data` payload through a type guard.
It accepts an absent window and answers `null`, so it chains with `findInfiniteCanvasWindow` without a null check between them.
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

- `defineInfiniteCanvasWindowRegistry`, `getInfiniteCanvasWindowData`: see Factories.

## Commands and keyboard

Every layout command is an `InfiniteCanvasAction`.
Pointer input, keyboard input, controls, and programmatic clients dispatch the same payloads.
`getInfiniteCanvasContextualCommands` returns the commands that are available for the current state.

**`commands`**

- `DEFAULT_INFINITE_CANVAS_COMMAND_DESCRIPTORS`
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
- `InfiniteCanvasGroupLayoutMode`: `"accordion" | "masonry" | "split" | "tabs"`. Masonry is a cell lattice run by `react-grid-layout`'s pure core. A container's `masonry` is the library's grid config (`cols`, `margin`, `containerPadding`, `rowHeight`, `maxRows`) plus its compaction settings (`compactType`, `preventCollision`, `allowOverlap`), each optional over the library's defaults; an absent `rowHeight` makes cells square. A member node carries its cells: `x`, `y`, `span` (the library's `w`), `rows` (its `h`), and `hidden`. A member drag or resize runs the library's own drag and resize logic (`moveElement`, the default constraints, the compactor).
- `InfiniteCanvasGroupMasonry`, `InfiniteCanvasGroupWindowNodeLayout`
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

Pass the minimum size in an `interaction.startGroupResize` action.
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

**`group-projection`**

- `getCanvasLayout(state)`: Returns layout bounds, visibility, and active move previews.
- `CanvasLayout`: Contains `windowRects`, `groupRects`, `layouts`, `hiddenWindowIds`, `visibleWindowIds`, and `visibleGroupIds`.

Projection leaves stored window rectangles unchanged.
`interaction.startGroupGutter` identifies a container and adjacent children; layout supplies its axis and extent.

**`group-state`**

- `findInfiniteCanvasGroup`, `getInfiniteCanvasWindowGroup`, `isInfiniteCanvasWindowGrouped`
- `getInfiniteCanvasGroupedWindowIds`, `reconcileInfiniteCanvasGroups`
- `getInfiniteCanvasGroupableWindowIds`: Returns eligible window IDs in input order. It omits missing, minimized, and grouped windows.
- `getInfiniteCanvasGroupTitle`: Returns a supplied title. If `title` is `null`, it derives a title from current members.
- `DEFAULT_INFINITE_CANVAS_GROUP_TITLE`: Names an empty group. Use `title === null` to distinguish a derived title from a supplied title.
- `getInfiniteCanvasGroupTabLabel`: Returns a window title or the visible child label. A split container uses the group title.

This helper applies the same eligibility rules as `group.create`.
A persisted `string` value in `title` remains a supplied title.
A `title` value of `null` requests a derived title.
Pass `groupTabLabel` to replace the default tab label.

<details><summary>types (5)</summary>

- `InfiniteCanvasDockPreview`
- `InfiniteCanvasGroup`: A world object that owns a local layout.
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
- `getInfiniteCanvasPackedRects`: Packs rectangles into rows inside the width they already span, tallest first. This is First-Fit Decreasing Height, the standard algorithm for two-dimensional strip packing, so the block is short and no two results overlap. Rectangles move and never resize. Pass `stripWidth` to pack into a different width, and `gapPx` for the space between neighbours.
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
If no candidate is clear, the result goes below every occupied rectangle, which is clear at any `x`.
The result never overlaps an `occupied` rectangle, so a caller can place a window without a check.
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
Dispatch `camera.navigate` with a `point` target from the converted point.

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
- `getSelectableWindowIds`
- `getSelectedWindowIds`: The window ids among the selection targets, in selection order.
- `getSelectionTargetKey`
- `getVisibleWindowBounds`
- `isSelectionTargetSelected`
- `normalizeSelection`
- `updateSelection`: `(state, { mode, targets, anchorTarget? })`. Returns the state with the selection replaced, added to, removed from or toggled, and the active window that follows from the anchor.

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
- `CameraNavigation`: A navigation request with an optional `transition` (or `false` for a jump) and an abort `signal`.
- `CameraNavigationResult`: `completed`, `cancelled` or `unavailable`.
- `CameraAnimationRequest`: A camera to animate to, with the same `transition` and `signal`.
- `CameraTransition`: The Motion value transition the rig accepts, without its callbacks.
- `CameraRig`, `CameraRigOptions`: The animated camera: `animate`, `navigate`, `stop`; options set the default transition and the reduced-motion policy.
- `CameraComposition`, `CameraFramingMode`: How a target rectangle is placed and scaled in the viewport.
- `createCanvasTools`, `CanvasToolsContext`, `CanvasToolsOptions`: The WebMCP tools a canvas store exposes, or a function that derives them from the store context.

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
- `getInfiniteCanvasEdgePanVelocity`: How fast a drag held at a point should pan the canvas, in screen pixels per second, or `null` when the pointer is clear of every edge. Measured from the content viewport, so consumer chrome cannot bury the band under itself.
- `rectsEqual`: Whether two rects cover the same region. Absent is a value, so two absent rects are equal and one absent rect differs from any real one, and a caller asking "did this change" needs no check of its own.
- `rectsIntersect`
- `screenPointToWorldPoint`
- `unionRects`
- `worldPointToScreenPoint`
- `worldRectToScreenRect`

Camera framing ignores these occluders because a corner occluder must not shrink the full frame target.

**`constants`**

- `DEFAULT_INFINITE_CANVAS_INPUT_POLICY`
- `DEFAULT_INFINITE_CANVAS_EDGE_PAN`: The default edge-pan band and speed. `InfiniteCanvasDesktop` and `InfiniteCanvasViewport` take an `edgePan` prop; `false` holds the camera still during a drag.
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

These helpers provide window proxies, connector routes, scene transforms, and frustum visibility to the compositor's passes.

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
- `getInfiniteCanvasSelectionBounds`: Returns bounds for selected windows and targets. It omits a target without a resolver.
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

Persistence and validation run through the store's schema; see State and store.

## History (undo and redo)

History contains changes to document windows and groups.
Camera movement does not add an entry.
A drag adds one entry from its start state.
`INFINITE_CANVAS_HISTORY_LIMIT` limits session history, and serialization omits it.

**`history`**

- `reduceInfiniteCanvasState`, `InfiniteCanvasReducerOptions`: `(state, action, options?)`. The pure reducer behind the store, with the window definitions, history, snap and zoom policies it needs.
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

- `getDocumentChangeRect`: `({ state, before, after })`. Compares projected bounds using the current layout metrics and viewport. Changed items contribute their previous and next bounds; unchanged items contribute nothing.
- `revealDocumentChange`: `({ state, before, after })`. Marks that region as the revealed change so the viewport can show where an undo or redo landed.

Dispatch `{ type: "history.undo" }` or `{ type: "history.redo" }`.
The reducer restores the document, reconciles membership and selection, and cancels the active interaction.

<details><summary>types (3)</summary>

- `InfiniteCanvasConnection`: A directed edge between two windows, by window id. `kind` names the
  relation in the consumer's vocabulary and `data` is the consumer's payload, both the way a window
  carries a kind and data. Connections are document state: they undo and they serialize. Closing a
  window drops the edges that touch it. Dispatch `connection.open`, `connection.close` and
  `connection.update` to change them.
- `InfiniteCanvasDocument`

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
- `InfiniteCanvasConnectionsOptions`: `tint`, `opacity`, and `thicknessPx` of a resting edge, and `selectedTint`, `selectedOpacity`, and `selectedThicknessPx` of the selected one.
- `InfiniteCanvasDropPreviewOptions`: `validTint` and `validOpacity` of an accepted placement, and `invalidTint` and `invalidOpacity` of a refused one.
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

## Types

This section lists all public types.
The size type `InfiniteCanvasViewport` is exported as `InfiniteCanvasViewportSize` to prevent a name conflict with the component.

**`types`**

<details><summary>types</summary>

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
- `InfiniteCanvasDispatch`: `(action: InfiniteCanvasAction<Kind>) => void`.
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
- `InfiniteCanvasEdgePanPolicy`: `bandPx` and `maxSpeedPxPerSecond` for the drag edge pan.
- `InfiniteCanvasEmptyCanvasDragMode`
- `InfiniteCanvasHotkeyBinding`
- `InfiniteCanvasGroupGutterInteraction`
- `InfiniteCanvasGroupMetrics`, `InfiniteCanvasGroupMetricsInput`: The three chrome sizes and their partial input. `state.groupMetrics` holds the completed value.
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

| Prop kind       | Rule                                                                                                  |
| --------------- | ----------------------------------------------------------------------------------------------------- |
| Event handlers  | Both run, with the consumer first. Call `event.preventBaseUIHandler()` to skip the framework handler. |
| `className`     | Values concatenate, with the consumer first.                                                          |
| `style`         | Values shallow-merge, with the consumer last.                                                         |
| `data-slot`     | The framework owns this value.                                                                        |
| Everything else | The consumer owns the value.                                                                          |

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

- `InfiniteCanvasCompositorSurface`: The transparent WebGPU surface that paints the framework's passes for one placement. Which passes run comes from `compositor`, not from a consumer list. Each draw takes the canvas from `target()` and submits its own render pass: the first claim of a frame clears, every later one keeps what is already there. Pass a stable `compositor` object: the surface builds every pipeline again when its identity changes.
- `createInfiniteCanvasAreaLightPass`: The medium lit by the windows above it. Each window is a rectangular area light and the floor takes its diffuse irradiance, so falloff and softness come from the geometry rather than a radius. A window higher in the stack casts a wider, weaker pool. Mounted by the surface from `compositor.areaLight`, which is off by default: irradiance on a featureless plane is a radial gradient, so it reads as an aura until the medium has structure. Set `areaLight` to `true` or an object to turn it on.
- `DEFAULT_AREA_LIGHT_OPTIONS`: The area light defaults.
- `screenToWorld`: The inverse of `worldToScreen`, for a pass that shades a point on the medium.
- `createInfiniteCanvasGridPass`: The grid of the medium, drawn in world space and faded toward the edges of the view so the plane recedes instead of tiling flat. Mounted by the surface from `compositor.grid`; while it is mounted the CSS backdrop stands down, so there is one grid.
- `DEFAULT_GRID_OPTIONS`: The grid defaults.
- `createInfiniteCanvasContactShadowPass`: A soft shadow below each window from the union of the window distance fields, so the plane reads as lifted from the medium. Mounted by the surface from `compositor.contactShadow`.
- `createInfiniteCanvasConnectionsPass`, `CONNECTION_CAPACITY`: Draws the `connections` slice, one instanced quad per edge between the two windows it names, and the capacity beyond which edges are not drawn. Neutral at rest and brighter when an edge target selects it, so the loudest value marks what a person is acting on rather than whatever exists. An edge whose endpoints are not both open draws nothing. Mounted by the surface from `compositor.connections`, on by default because an edge in the document is content.
- `createInfiniteCanvasFocusFieldPass`: The attention field. The medium stays bright around the active window and dims with distance from it. Mounted by the surface from `compositor.focusField`, which is off by default because the halo it leaves reads as an aura; set `focusField` to `true` or an object to turn it on.
- `createInfiniteCanvasParticleFieldPass`: Small particles in the medium that drift and fall gently toward the windows. One compute dispatch and one instanced draw per frame; it keeps the surface redrawing. Mounted by the surface from `compositor.particleField`.
- `Particle`, `Particles`, `PARTICLE_CAPACITY`: The particle record, its fixed-capacity array, and the capacity.
- `instanceCount`: The accessor a shader reads for how many leading `instances` are live this frame.
- `createInfiniteCanvasProximityPass`: The first shipped compute pass. It measures the gap between every pair of windows on the GPU and publishes nearest neighbour, neighbour count, and crowding pressure to the canvas store's proximity signal. Mounted by the surface from `compositor.proximity`, which is off by default because the pass costs a compute dispatch and a GPU-to-CPU map every frame and the map forces a synchronisation; set `proximity` to `true` or an object to turn it on.
- `createInfiniteCanvasDropPreviewPass`: The ghost rect where a dragged payload will land, in the placement `dropPolicy` resolved, coloured by whether the target accepted it. Mounted by the surface from `compositor.dropPreview`, on by default and inert until a consumer supplies a `dropPolicy`, since without one no placement is ever resolved.
- `DEFAULT_INFINITE_CANVAS_COMPOSITOR`, `DEFAULT_CONNECTIONS_OPTIONS`, `DEFAULT_CONTACT_SHADOW_OPTIONS`, `DEFAULT_DROP_PREVIEW_OPTIONS`, `DEFAULT_FOCUS_FIELD_OPTIONS`, `DEFAULT_PARTICLE_FIELD_OPTIONS`, `DEFAULT_PROXIMITY_OPTIONS`: The default policy and the per-pass defaults each factory takes when called without options.
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
