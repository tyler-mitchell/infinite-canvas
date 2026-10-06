# Legend State v3: canvas state replacement

Target: installed `@legendapp/state@3.0.0-beta.48` with the repository patch. Sources checked 2026-09-16. Migration is in progress.

## Model requirements

Playground `/normal`, `/custom-frames` and `/workspaces` use the native model. Other routes and consumers still use the earlier store.

| Required behavior                                     | Data ownership                                                     | Current gap                                                                                        |
| ----------------------------------------------------- | ------------------------------------------------------------------ | -------------------------------------------------------------------------------------------------- |
| Edit content during a drag; cancel preserves the edit | Committed entities stay separate from pending input                | Native headless cases cover this; earlier consumers still use gesture drafts                       |
| Distinguish a click from a drag                       | The press retains its pointer, target and starting point           | Native press thresholds are implemented; application migration remains open                        |
| Pan the camera while dragging                         | World pointer position depends on the current camera and viewport  | The draft derives this value; the running input still repeats pointer steps                        |
| Move, resize, dock and undock windows and groups      | One layout calculation owns displayed and hit-test geometry        | Native actions include mixed movement and docking; pointer docking and other consumers remain open |
| Restore a maximized or grouped window                 | Saved placement remains separate from computed layout              | Window restore and camera arrival witnessed on `/normal`; broader cases remain open                |
| Switch workspaces and retain each view                | Camera, selection and focus belong to the selected view            | Native view link verified; workspace lifecycle and consumers remain open                           |
| Apply window-kind constraints                         | Definitions supply sizes and aspect ratios outside saved entities  | Native guards use effective capabilities; consumer integration remains open                        |
| Undo an accepted edit once                            | History observes committed content                                 | Group creation undo witnessed; stale view references now have explicit cleanup                     |
| Save without losing local work on failure             | Sync observes `state.document`; input and gestures stay outside it | Local reload witnessed on `/workspaces`; Polkadot sync and failure recovery remain open            |

Evidence: `src/store-commit.test.ts`, `src/frame-slots.tsx`, `src/infinite-canvas.tsx`, and the existing workspace, group and persistence consumers. These establish behavior and integration points. Existing mutation functions do not define the replacement API.

Before adding a transition, identify its input producer, affected stored fields, derived readers, history scope and cancellation behavior. An unconnected function cannot establish these boundaries.

`next/model.ts` creates the state and computed observables. Definitions return plain function fields. Computed dependencies read the model's computed nodes. Record-to-list conversion belongs to a named computed field; dependent queries reuse it. ID lookup uses the record.

## Rendering boundary

| Concept          | Responsibility                                               |
| ---------------- | ------------------------------------------------------------ |
| Window           | Content identity, placement, capabilities and document state |
| Layout container | Child membership, arrangement and bounds                     |
| Window view      | Optional renderer of one window                              |
| Window chrome    | Optional title bar, controls and decoration                  |
| Content host     | Content rendering, focus, scrolling and raster integration   |

`next/core.ts` has no renderer or stylesheet import. `next/react.tsx` is an optional adapter. Its `renderWindow` callback supplies the complete interior; `WindowDragHandle` supplies pointer behavior. The adapter owns outer geometry and resize handles. The stylesheet is optional.

The existing `renderFrame` mixes the last three responsibilities. Its six slots are not an accepted replacement contract.

Observed consumers:

- Playground custom frames change surface styling and header composition.
- Portfolio replaces the surface, omits the header and renders content-only cards and icons.
- Polkadot uses default window presentation with distinct content, scrolling and selection policies.

Content hosting, portals and raster placement still need integration. Consumer composition must preserve these behaviors and use the same geometry as hit testing.

Sources: `src/window-frame.tsx`, `src/frame-slots.tsx`, `apps/playground/src/routes/custom-frames.tsx`, `packages/polkadot-ui/portfolio/components.tsx`, and `apps/polkadot/src/canvas/window-registry.tsx`.

Figma frames are document containers with independent bounds and child-layout rules. This is a separate concept from window chrome. [Figma frames](https://help.figma.com/hc/en-us/articles/360041539473-Frames-in-Figma-Design).

## Replacement boundary

| Owner                          | Native operation                                               | Retire                                                        |
| ------------------------------ | -------------------------------------------------------------- | ------------------------------------------------------------- |
| Document actions               | Field `.set()`, `.assign()`, `.delete()`; batch related writes | Whole-state reducer results copied back into observables      |
| Derived geometry and selection | Cached observable functions, including keyed functions         | Repeated caller-owned calculations and mirrored derived state |
| React window/group lists       | `For` over canonical observable collections                    | Parent reads of complete arrays followed by raw-value props   |
| Persisted document             | `syncObservable` on its owning subtree                         | Separate save controllers and copied persistence state        |
| Document history               | `undoRedo` on committed data                                   | History writes and store read-back inside the reducer         |
| Gesture preview                | Observable gesture inputs consumed by geometry computeds       | Whole-document interaction drafts                             |

Sources: [observable operations][observable], [For and tracking][performance], [sync][sync], [history][helpers].

## Required cancellation behavior

Observed failure in `src/store-commit.test.ts`:

```ts
store.dispatch({
  type: "interaction.startMove",
  pointerId: 1,
  point: { x: 0, y: 0 },
  target: { type: "window", id: "a" },
});
store.dispatch({ type: "interaction.step", pointerId: 1, point: { x: 100, y: 0 } });
store.dispatch({ type: "window.setData", windowId: "b", data: { text: "Saved during drag" } });
store.dispatch({ type: "desktop.cancel" });
// Current: b.data is undefined. Required: retain the edit.
```

Cancellation must remove gesture state only. Other document edits must remain committed.

## Keyed computed geometry

Current draft: `next/state.ts`.

```ts
type WindowDrag = {
  pointerId: number;
  startPoint: Point;
  startRects: Record<string, Rect>;
} & ({ kind: "move"; groupRects: Record<string, Rect> } | { kind: "resize"; handle: ResizeHandle });

canvas.computed.pointerWorld.get();
canvas.computed.dragDisplacement.get();
canvas.computed.windowRect[windowId].get();
```

`pointerWorld` converts viewport coordinates through the current camera. `dragDisplacement` subtracts the drag's starting world point. `windowRect` combines that displacement with the starting rectangle. Resize constraints come from `config.windowDefinitions`.

Headless execution covers camera and viewport changes, live resize constraints, pointer ownership, deletion during movement, mixed selection movement, and cancellation with unrelated edits. Pointer behavior in the new browser adapter remains unverified.

`dragStartRects` is a cached record. Each window reads only its entry. Clearing the drag leaves unrelated geometry subscriptions unchanged.

### Initial absence

Installed `index.mjs:2220` changes an initial computed `null` to `undefined`. Lookup keys use `undefined` for absence. Nullable values use native `linked({ get, initial: null })`; this also avoids the installed function-field type branch that treats an `undefined` return as `void`.

```ts
canvas.computed.windowGroupId.a.get(); // undefined for a floating window
canvas.computed.marqueeRect.get(); // null without a marquee
```

Source: installed `activateNodeFunction`; acceptance case in `next/state.test.ts`.

## Workspace view ownership

Target composition; native link reads and writes were runtime-proven with the installed package.

```ts
const session$ = observable({
  activeWorkspaceId: null as string | null,
  canvasView: initialView,
  workspaceViews: initialWorkspaceViews,
  view: (): Observable<ViewState> => {
    const id = session$.activeWorkspaceId.get();
    return id === null ? session$.canvasView : session$.workspaceViews[id];
  },
});

session$.activeWorkspaceId.set("research");
session$.view.camera.zoom.set(2);
```

The write reaches the selected view. Replace `workspace.ts` outgoing camera/selection copies with this link. The installed-package probe also verified these batches:

```ts
batch(() => {
  session$.activeWorkspaceId.set(null);
  session$.workspaceViews.research.delete();
});

batch(() => {
  session$.workspaceViews.new.set(newView);
  session$.activeWorkspaceId.set("new");
});
```

## Selection identity

Use a keyed record for selection targets:

```ts
type TargetKey = `${SelectionTarget["type"]}:${string}`;
type Selection = {
  targets: Record<TargetKey, SelectionTarget>;
  anchor: TargetKey | null;
};

selection$.targets["window:a"].set({ type: "window", id: "a" });
selection$.targets["edge:a"].set({ type: "edge", id: "a", kind: "relation" });
selection$.targets["edge:a"].delete();
```

Runtime-proven: deleting `edge:a` preserves both the value and observable identity of `window:a`. An array probe with duplicate IDs failed after reordering despite a key extractor.

## Record-backed rendering

Observed installed contract, `react.d.ts:For`:

```ts
each?: ObservableParam<T[] | Record<any, T> | Map<any, T>>;
children?: (value: Observable<T>, id: string | undefined) => ReactElement;
```

Target:

```tsx
<For each={canvas.computed.workspaceWindows}>
  {(window) => (
    <WindowView canvas={canvas} window={window} viewport={viewport} renderWindow={renderWindow} />
  )}
</For>
```

`WindowView` observes its own fields and keyed layout. Hidden windows retain their mounted content. Browser render counts and DOM continuity remain unverified.

## Running consumer

`apps/playground/src/routes/normal.tsx` supplies its own window content, controls, dock and command dialog. `CanvasTools` exposes the same native commands through WebMCP.

```ts
await canvas.commands.fitAll.run({});
await canvas.commands.createGroup.run({
  id: "documents",
  windows: ["archive-window", "log-window"],
  layout: "tabs",
});
await canvas.commands.activateGroupChild.run({
  groupId: "documents",
  containerId: "root",
  childId: "window:log-window",
});
```

Witnessed on `/normal`: three window interiors, camera fitting with completed results, tab selection with accessible panel ownership, group creation undo, and minimized-window restore followed by camera arrival. Undo left stale group view references; `clearInvalidViewState` and a regression case now cover that cleanup. The correction still needs browser verification.

`next/camera-controller.ts` owns Motion values, grouped animation, retargeting, abort, interruption and disposal. Frame writes are coalesced into `session.camera`. Completion or cancellation commits the captured workspace view. Headless cases cover insets, absent targets, abort and disposal; animated interruption remains open.

## Persistence owner

```ts
syncObservable(canvas.state.document, {
  persist: { name: "playground.workspaces", plugin: ObservablePersistLocalStorage },
});
undoRedo(canvas.state.document.content, { limit: 100 });
```

`state.document` contains content, the canvas view, workspace views and the active workspace ID. History observes only `content`. Configuration, pointer input and pending gestures remain outside this subtree. Constructor inputs transfer ownership; callers must supply fresh mutable data.

A derived persistence setter lost the sync-origin boundary. It was removed. Direct-root loading also exposed an installed history defect: `undoRedo` checked temporary global flags after they had cleared. The maintained patch now checks listener fields `isFromPersist` and `isFromSync`. Both module formats receive the same correction. The existing failed-get counter patch remains intact.

Evidence: `next/state.test.ts`, installed `helpers/undoRedo.mjs:14`, `ListenerParams`, and `patches/@legendapp__state@3.0.0-beta.48.patch`. Browser reload restored the workspace ID, changed window title, camera center and zoom; undo remained unavailable after hydration.

## History transaction boundary

Runtime-proven with installed CommonJS exports, Node 24.21.0:

```ts
const content$ = observable({ count: 0 });
const history = undoRedo(content$);
content$.count.set(1);
content$.count.set(2);
history.undo();
// count: 1; undos: 1; redos: 1
```

```ts
// Separate instance with the same initial writes.
batch(() => history.undo());
// count: 1; undos: 2; redos: 0
```

Batch separate writes only when observers must receive one complete change. A single `.set()` or `.assign()` already owns its notification boundary. Nested batches flush at the outer boundary. Invoke native undo/redo outside an outer batch: the installed restoration flag clears before deferred listeners run. Sources: `index.js:batch`, `endBatch`, and `helpers/undoRedo.js:undoRedo`.

## Collection and measurement decisions

| Helper                     | Decision                                  | Evidence                                                    |
| -------------------------- | ----------------------------------------- | ----------------------------------------------------------- |
| Keyed computed functions   | Use for entity-specific derived values    | Cache probe above; [observable docs][observable]            |
| `recordAsArray`            | Exclude as a writable boundary            | Field-write probe throws in the installed setter            |
| `arrayAsRecord`            | Exclude                                   | Installed getter repeats the same incorrect key dereference |
| `arrayAsSet`, `setAsArray` | Exclude from mixed-target identity        | Object reference equality does not represent `type:id`      |
| `useMeasure`               | Exclude from fractional body measurements | Reads integer `offsetWidth/offsetHeight`                    |
| `useHover`                 | Exclude from current controls             | CSS/Base UI already owns hover                              |

```ts
const records$ = observable({ a: { id: "a", title: "A" } });
const array$ = observable(recordAsArray(records$));
array$.get(); // [{ id: "a", title: "A" }]
array$[0].title.set("Updated");
// TypeError: reading 'id' of undefined in recordAsArray's setter.
```

Sources: installed `as/{recordAsArray,arrayAsRecord,arrayAsSet,setAsArray}.js` and `react-hooks/{useMeasure,useHover}.js`.

## Persistence binding

Plugin decision:

| Boundary                                  | Use                                                                          |
| ----------------------------------------- | ---------------------------------------------------------------------------- |
| Canvas state and computed geometry        | Native `observable`, computed functions and links                            |
| Whole-document saves with revision checks | Native `syncObservable` with the existing backend binding                    |
| Browser local persistence                 | Existing `ObservablePersistLocalStorage` plugin                              |
| Entity CRUD                               | `syncedCrud` when the backend exposes entity create/update/delete operations |
| Custom sync plugin                        | None in the current foundation                                               |

`syncedCrud` supports single values as well as collections; single-document shape is not a reason to reject it. This canvas backend exposes a revision-checked layout save. CRUD routing adds no required behavior to that boundary. No new database or CRUD integration is part of `state.ts`.

Source: [CRUD plugin: get/list, update, onSaved](https://legendapp.com/open-source/state/v3/sync/crud/).

Observed: `apps/polkadot/src/canvas/use-canvas-runtime.ts:useCanvasRuntime`.

```ts
sync: {
  debounceSet: 250,
  set: ({ value, value$ }) => saves.add(async () => {
    const result = await database.saveCanvas({
      canvasId: canvas.id,
      layout: value,
      revision: revision$.peek(),
    });
    revision$.set(result.revision);
    syncState(value$).error.set(undefined);
  }, { signal: controller.signal }),
}
```

Keep the serial queue at this backend boundary: each save needs the revision returned by the previous save. Bind it directly to the canonical document's native sync configuration.

Target conflict handling, using installed `SyncedErrorParams`:

```ts
onError: (error, { retry, setParams }) => {
  if (error.name === "CanvasRevisionConflictError") {
    controller.abort(error);
    retry.cancelRetry = true;
    if (setParams) syncState(setParams.value$).isSyncEnabled.set(false);
  }
  console.warn("Canvas save failed", { canvasId, error });
};
```

Preserve the local document on failure. Exclude automatic `revert()` from conflict handling. The conflict UI reads `syncState(document$)` directly. Route unmount disables sync. Source: installed `sync.d.ts:SyncedOptions`, `SyncedErrorParams` and the existing runtime hook.

Installed `sync.js:createRevertChanges` applies previous path values to the current observable value, then sets the result through `onChangeRemote`. It has no later-edit comparison at that boundary. It does not satisfy the requirement to retain local work after a revision conflict.

## Command definition boundary

| Rule                                                                           | Owner                              |
| ------------------------------------------------------------------------------ | ---------------------------------- |
| Input shape, title trimming, non-empty title, input cross-field constraints    | ArkType input schema               |
| Window existence, capability, active interaction, current workspace membership | Live-state guard                   |
| Labels, icons, descriptions, hotkeys, schema exposure                          | Command definition                 |
| Observable field writes                                                        | The operation that owns the change |
| Cached availability for bound UI inputs                                        | Native computed field              |

`next/model.ts` validates command input and live ArkType guards. Commands carry an icon and return `{ data, error }`. This wrapper does not establish the canvas data model or its mutation boundaries.

## Action and consumer migration

| Current module                                               | Replacement                                                             | Delete after callers migrate                                    |
| ------------------------------------------------------------ | ----------------------------------------------------------------------- | --------------------------------------------------------------- |
| `store.ts`                                                   | Native model construction, actions, computed nodes, history/sync wiring | `draft$`, full-state commit reconstruction, reducer callbacks   |
| `operations.ts`                                              | Command input schemas and descriptors call model actions                | Whole-state command execution and `reduceInfiniteCanvasState`   |
| `selection.ts`                                               | Native target-record actions; computed selected entities                | Full-state-returning selection operations and selector wrappers |
| `workspace.ts`                                               | Workspace records and linked session views                              | Outgoing/incoming camera and selection copying                  |
| `interaction.ts`                                             | Gesture input state and pure geometry calculations                      | Pointer-step document mutation and snapshot rollback            |
| `group-state.ts`, `stacking.ts`                              | Actions write the affected records/fields                               | Rebuilding every window/group array for local edits             |
| `layout.ts`, `spatial-target.ts`, `movement.ts`              | Pure calculations owned by model computeds/actions                      | Independent consumer-owned recomputation of the same layout     |
| `react/store.tsx`                                            | Context carries the per-canvas observable model                         | Whole-state selector hook and dispatcher hook                   |
| `infinite-canvas.tsx`, `group-layer.tsx`, `window-frame.tsx` | Observable entity props and per-entity computed geometry                | Full-array subscriptions and raw snapshot prop chains           |
| `canvas-overlays.tsx`, HUD, minimap, visibility              | Read named computed nodes through `useValue`/`Memo`                     | Repeated selection/visibility/bounds calculations               |
| `compositor/backend/surface.tsx`, scene passes               | Read the same computed layout at frame time with `peek()`               | Separate geometry/selection projection authority                |
| `tools.ts`, keyboard, menus, palette                         | Invoke the same registered actions                                      | Parallel selection/action execution paths                       |
| Playground, Polkadot, portfolio consumers                    | New model/action/observable contracts                                   | Calls to retired reducer, selector and snapshot APIs            |

No compatibility aliases or permanent adapter layer are part of this target. Geometry math remains pure; state changes use native observable writes.

## Active-item selector candidate

Source: [`@leesf/legend-state-selector` 0.1.1](https://github.com/LeeSF03/legend-state-selector).

```ts
createSelector<T>(source: Observable<T>, getKey?: (value: T) => unknown)
  : (key: T) => Observable<boolean>;
```

Decision: do not add version 0.1.1 to this foundation. Its implementation represents one selected key, discards the `observe()` disposer, and retains every requested key in a map. It also depends on exact beta.47 while this project uses patched beta.48.

Use native record membership for multi-selection:

```tsx
const selected = useValue(() => canvas$.view.selection.targets[targetKey].get() !== undefined);
```

Source: [`src/index.ts`](https://github.com/LeeSF03/legend-state-selector/blob/main/src/index.ts), blob `1479ca1f877a57adf4724a48333022ac9d223210`; upstream tests cover single-value switching and object-key equality. No package installation or adaptation is planned.

## Required implementation evidence

| Boundary           | Evidence still required                                                        |
| ------------------ | ------------------------------------------------------------------------------ |
| Gestures           | Exact move/resize/group/reorder commit and cancellation composition            |
| Sync               | Consumer binding, validated remote ingress, startup and failure behavior       |
| Camera             | Observable/motion ownership and awaitable cancellation                         |
| React              | Record-backed `For`, item identity, Base UI composition, subscription disposal |
| Commands/tools     | One validated action implementation and computed availability                  |
| Downstream removal | Exact module/caller replacement map and verification cases                     |

[observable]: https://legendapp.com/open-source/state/v3/usage/observable/
[performance]: https://legendapp.com/open-source/state/v3/guides/performance/
[sync]: https://legendapp.com/open-source/state/v3/sync/persist-sync/
[helpers]: https://legendapp.com/open-source/state/v3/usage/helper-functions/
