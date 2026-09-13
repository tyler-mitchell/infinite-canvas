# Infinite Canvas architecture

Scope: the current framework package, public documentation, and canonical consumers.
Evidence: source inspection of the working tree on 2026-09-13, including uncommitted changes.
Base commit: `8b723934c22e869addb02a942dba18dad15be360`.
Runtime behavior is unverified. No test, compiler, or browser validation is part of this review.

## Questions

1. Which responsibilities belong to the framework, its consumers, and optional render layers?
2. How do state, commands, history, persistence, and React rendering connect?
3. How do layout, interaction, selection, workspaces, and spatial targeting cooperate?
4. Which existing public affordances support schema-driven authoring?
5. Which proposed authoring responsibilities require further evidence before framework changes?

## Coverage

The full `packages/infinite-canvas` file inventory has been read.

| Area | Status | Primary entry points |
| --- | --- | --- |
| Public contracts | Partial | Package README, root API and architecture docs |
| State and command path | Partial | factory, state, store, reducer, commands, canvas-handle |
| Persistence and history | Partial | persistence, validation, history |
| Groups and layout | Partial | group-tree, group-layout, group-state, recipes |
| Interaction and targeting | Pending | interaction, keyboard, spatial-target, snap-resolver |
| React and frame composition | Partial | infinite-canvas, window-frame, frame-slots, store |
| Selection and workspaces | Pending | selection, workspace, stacking, window-focus |
| Optional rendering | Pending | scene, compositor, rasterization, window-proxy |
| Canonical consumers and contracts | Partial | playground, polkadot, consumer and boundary tests |

Coverage requires source relationships and invariants, not only file discovery.
The review does not authorize implementation, deployment, release, or broad cleanup.

## Established entry points

`defineInfiniteCanvasWindowRegistry` accepts per-kind data types and returns a runtime registry.
Persisted window data remains `unknown`; `getInfiniteCanvasWindowData` applies a consumer guard.
`setGroupChildLayouts` edits masonry layout fields. `setWindowRect` sizes floating windows.
These facts are source-backed; the full surrounding lifecycle remains under review.

Sources: `factory.ts:210`, `factory.ts:235`, `types.ts:813`, `types.ts:1272`, `types.ts:1290`.

## Package and consumer boundary

The main entry owns the reducer, React DOM window plane, state adapter, and public helpers.
The `./scene` entry owns the optional TypeGPU compositor. GPU peers remain optional.
The current manifest includes Legend State, hotkeys, snapdom, Motion, react-grid-layout,
and use-resize-observer. It does not declare ArkType as a runtime dependency.

```tsx
const definitions = defineInfiniteCanvasWindowRegistry<Kind, DataByKind>({
  note: { kind: "note", renderBody: ({ window }) => <Note data={window.data} /> },
});
```

The second generic describes consumer data; it does not install a runtime schema.
Hydrated payloads require the consumer guard. A new schema-aware authoring surface must
integrate with this distinction rather than assume definitions already enforce payload validity.

The package README states that render callbacks are memoized by window identity.
It directs reactive child components to `useInfiniteCanvasSelector` for current state.
The current Board measurement integration needs this lifecycle traced before relying on its context.

Sources: package `README.md:13`, `README.md:101`, `README.md:178`, `package.json:36`, `package.json:64`.

## Documentation authority

`docs/README.md` ranks current code/tests above implementation documents and historical plans.
`ARCHITECTURE_PLAN.md` is the pre-port plan, not the current architecture specification.
Its older dependency and renderer choices must be checked against current source.
The package README omits masonry from its group-layout list, while current source implements it.
Treat feature summaries as entry points, not exhaustive inventories.

## Store handle and document lifetime

```ts
const handle = createInfiniteCanvasHandle(store);
const state = handle.getState();
const snapshot = handle.snapshot();
const dispose = handle.subscribeDocument(onDocument);
```

`getState()` returns the shared store value through `peek`; callers must not mutate it.
`snapshot()` uses the framework serializer.
`subscribeDocument()` observes exactly the persisted field set and coalesces notifications
in a microtask. It is separate from arbitrary value subscriptions.
The returned disposer removes field observers; already queued notifications have no disposal guard.
Persistence consumers must account for late callbacks when their document lifetime ends.

`cloneInfiniteCanvasState` copies geometry and collection shells. It shares immutable
group trees, connection records, and consumer window data.
Reset clears history and active interaction while preserving the measured viewport.
Consumer payloads must remain immutable after insertion into the canvas state.

Sources: `canvas-handle.ts:45`, `canvas-handle.ts:57`, `canvas-handle.ts:84`,
`state.ts:58`, `state.ts:72`, `state.ts:103`.

The API documents window capabilities as reducer-enforced rules, not only disabled chrome.
Workspaces have their own camera and selection and can share window membership.
The detailed reducer/workspace trace is still pending.

## Canonical mutation and persistence

```ts
const next = reduceInfiniteCanvasState(current, action, reducerOptions);
// The store batches only fields whose identities changed.
commitInfiniteCanvasState(state$, next);
```

Every store command enters `dispatch`; the reducer applies the action, reconciles workspace
membership after group/workspace changes, and then records a document checkpoint when required.
Hydrate/reset clear session history. Hydrate preserves a usable measured viewport.
Masonry member moves operate on the lattice; other grouped-window moves operate on the group shell.
The reducer checks capabilities before starting floating-window movement and resizing.

The persistence document includes camera, selection, windows, groups, connections, and workspaces.
It excludes viewport measurements, insets, occluders, interaction, snap preview, history, and GPU signals.
Serialization uses format version 4 and returns existing immutable field references.
Parsing accepts versions 1–4, drops malformed members independently, normalizes selection,
then reconciles groups before workspaces. Consumer payload validation remains separate.

Sources: `store.tsx:104`, `store.tsx:121`, `reducer.ts:105`, `reducer.ts:173`,
`reducer.ts:184`, `persistence.ts:58`, `persistence.ts:95`, `persistence.ts:137`.

The public commands include `setGroupRect` and `setGroupLayoutMode`; responsive consumers do not
need to hydrate an entire document merely to resize its group shell or change its layout mode.
`window.setRect` deliberately leaves grouped members unchanged because the group owns their rects.
Window close also removes group/workspace membership and attached connections.
Window open resolves placement against live state and joins the active workspace.

The undo document differs from the persistence document: it contains windows, groups,
connections, workspaces, and active workspace, but not the top-level camera or selection.
Mutating drags record at their start; step/finish do not add checkpoints.
Undo/redo restore document fields, clear interactions, normalize selection, and reveal the changed region.
The changed region is derived from old/new geometry; payload-only changes have no geometry reveal.
Existing session undo must be considered when adding authored-content edits; a second independent
history would need a defined relationship to it.

Sources: `store.tsx:291`, `store.tsx:297`, `reducer.ts:344`, `reducer.ts:354`,
`reducer.ts:379`, `reducer.ts:398`, `history.ts:22`, `history.ts:63`, `history.ts:269`.

## Authoring vocabulary

The generic authored unit is a component instance. A window hosts a component composition.
Cards, charts, editors, and controls are consumers of that capability, not distinct integration classes.
Spatial grouping and authored component containment have separate existing owners to account for.
