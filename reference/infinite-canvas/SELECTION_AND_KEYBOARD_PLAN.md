# Selection And Keyboard Plan

This document tracks the implementation plan for the selection model and
keyboard command layer in `apps/web/src/experiments/infinite-canvas`.

The feature tracker stays high-level. This file holds detailed design choices,
phase acceptance criteria, and hardening notes.

## Design Goal

Split three concepts that are currently too close together:

- **Focus**: where keyboard/body input is currently directed.
- **Active window**: the primary window for chrome emphasis and default commands.
- **Selection**: the set of windows targeted by arrange, move, duplicate,
  distribute, group, and future agent operations.

The framework can keep `activeWindowId` for compatibility at first, but it
should gain explicit selection state instead of treating focus as selection.

## State Shape

Add to `InfiniteCanvasState`:

```ts
selection: {
  anchorWindowId: string | null;
  windowIds: readonly string[];
}
```

Rules:

- `selection.windowIds` contains visible, existing window ids only.
- `selection.anchorWindowId` is the last primary selection target and should be
  present in `windowIds` when non-null.
- `activeWindowId` may be `null` while selection is non-empty only if the
  desktop itself has focus. Prefer keeping them aligned in early slices.
- Closing or minimizing a selected window removes it from selection.
- Opening a window selects and focuses it unless the command explicitly asks to
  preserve selection.
- Background press clears focus and selection.

## Selection Actions

Start with pure reducer actions:

```ts
selection.replace(windowIds);
selection.add(windowIds);
selection.remove(windowIds);
selection.toggle(windowIds);
selection.clear();
selection.selectAllVisible();
```

Use arrays at the public boundary, but normalize internally:

- preserve explicit input order consistently
- dedupe ids
- drop unknown/minimized ids
- set `anchorWindowId` to the last valid id for replace/add/toggle-on

## Pointer Selection Behavior

Initial behavior should be boring and trustworthy:

- Click body/header: replace selection with that window and focus it.
- Shift-click: add to selection.
- Meta/Ctrl-click: toggle selection.
- Background press: clear selection and focus, then start pan if dragged.
- Drag selected window: move the selected set if the dragged window is selected;
  otherwise replace selection with dragged window and move it alone.

Avoid resize-selected-group in the first slice. Group resize needs a clear
selection-bounds contract and can easily become a distraction.

## Runtime Library Decision

Use `@tanstack/hotkeys` core for the framework keyboard boundary.

Why core fits this framework better than `@tanstack/react-hotkeys`:

- The canonical state is Legend signal state, so hotkey callbacks can read the
  latest state through the framework store without React state subscriptions.
- The command layer should stay reusable outside React hooks. React should only
  provide the DOM target/ref for the current R3F/DOM adapter.
- Core still gives the parts we want: `Mod` normalization, typed hotkeys,
  target scoping, conflict behavior, metadata, formatting helpers, input
  filtering, key-state tracking, and sequence support.
- Using core avoids coupling command registration to React render timing and
  keeps room for non-React shells or worker-driven command surfaces later.
- `@tanstack/react-hotkeys` remains a reasonable future adapter if consumers want
  hook-level integration, but it should not be the framework's internal command
  model.

Important boundary:

- TanStack Hotkeys owns **keyboard event registration, normalization, target
  scoping, and display formatting**.
- Infinite Canvas owns **command identity, command availability, command
  execution, selection semantics, and layout mutations**.

Do not let hotkey strings become the command model. Hotkeys map to commands;
commands map to reducer actions or future transactions.

## Command Principle

Every keyboard action should resolve through a named command that can also be
called by menus, tests, UI buttons, command palettes, and future agents.

Avoid direct shortcut handlers that mutate state ad hoc.

## Initial Command Shape

```ts
type InfiniteCanvasCommand =
  | { type: "desktop.cancel" }
  | { type: "selection.clear" }
  | { type: "selection.selectAllVisible" }
  | { type: "view.fitAll" }
  | { type: "view.fitSelection" }
  | { type: "window.nudge"; direction: "left" | "right" | "up" | "down"; amountPx: number }
  | { type: "view.resetZoom" };
```

The command executor can compile commands into existing reducer behavior at
first. When commands need multi-window atomicity, introduce transaction actions
instead of dispatching many independent mutations from React.

## Shortcut Guard

Keyboard commands should only run when the event belongs to the desktop command
surface.

Do not run desktop commands when the target is:

- `input`, `textarea`, `select`
- contenteditable
- a window body that has captured editing focus
- a button/control handling its own shortcut
- an IME composition event

This guard is part of the framework, not app-specific glue. TanStack Hotkeys can
filter common input targets, but the framework still owns the final desktop
surface guard before it executes commands.

## Initial Bindings

| Binding       | Command                    | Notes                                          |
| ------------- | -------------------------- | ---------------------------------------------- |
| `Escape`      | `desktop.cancel`           | Clear interaction first, else selection/focus. |
| `Mod+A`       | select all visible windows | Desktop only; never inside body/editing focus. |
| `Shift+1`     | fit all visible windows    | Centers and scales around visible bounds.      |
| `Shift+2`     | fit selection              | Centers and scales around selected bounds.     |
| `Arrow`       | nudge selection by 1 px    | Convert screen pixels through current zoom.    |
| `Shift+Arrow` | nudge selection by 10 px   | Same command, larger amount.                   |
| `Mod+0`       | reset zoom                 | Command-backed replacement for inline handler. |

Defer destructive bindings such as `Delete` until undo/redo or an explicit close
policy exists.

## Marquee Selection

Marquee should be a first-class interaction kind, not a one-off overlay state.

Proposed interaction snapshot:

```ts
{
  kind: "marquee";
  originPointer: InfiniteCanvasPoint;
  pointerId: number;
  mode: "replace" | "add" | "toggle";
  originSelectionIds: readonly string[];
  zoom: number;
}
```

Derived behavior:

- Convert pointer rect from screen space to world space through the camera.
- Select windows whose world rect intersects the marquee rect.
- Use intersection by default; containment can be added as a policy later.
- Keep marquee result transient during drag, then commit selection on finish.
- Do not include minimized windows.
- Do not select through modal/overlay controls.

## Marquee Rendering

Start with a DOM overlay because it is simple, accessible, and easy to verify.
Define the render contract so a later shader version can drop in:

```ts
type MarqueeOverlayModel = {
  rect: InfiniteCanvasRect;
  mode: "replace" | "add" | "toggle";
  selectedWindowIds: readonly string[];
};
```

Future shader direction:

- render a subtle glassy fill, luminous edge, and corner accents in the WebGPU
  overlay plane
- keep the overlay pointer-events-none
- obey reduced-motion preferences
- expose theme tokens for glow color, opacity, and edge softness
- keep the geometric rect authoritative in the reducer; the shader is only a
  presentation adapter

This gives the app sheen without letting visual polish leak into selection math.

## Implementation Phases

### Phase 1: Selection Core

Status: implemented.

Acceptance criteria:

- selection actions are pure and covered by reducer tests
- close/minimize/open/focus keep selection valid
- persistence hydrates missing selection safely
- background press clears selection and active focus
- existing single-window move/resize behavior still works

### Phase 2: Selection UI Semantics

Status: implemented.

Acceptance criteria:

- selected-but-not-active windows have a distinct, restrained visual treatment
- header/body click selects and focuses
- Shift-click and Meta/Ctrl-click update selection without accidental pan
- focused body interactions still work normally

### Phase 3: Command Registry And Keyboard Boundary

Status: implemented with `@tanstack/hotkeys` core and a hidden command surface
so keyboard focus does not style the visible canvas shell.

Acceptance criteria:

- command descriptors are typed, testable, and independent of React
- hotkey registration uses `@tanstack/hotkeys` core against the viewport target
- shortcut guard protects editable/body/control contexts before command
  execution
- React only supplies the viewport ref and dispatches resolved framework
  commands
- hotkey metadata is available for a future cheatsheet or command palette

### Phase 4: Group Move

Status: implemented for move. Group resize remains deferred.

Acceptance criteria:

- dragging a selected window moves the whole selected set
- snapping excludes the selected set while preserving relative positions
- dragging an unselected window replaces selection and moves only that window
- one reducer test covers each behavior at non-default zoom

### Phase 5: Marquee Selection

Status: implemented with a DOM overlay. Shader-backed visuals remain a future
renderer option because the core reducer geometry should stay authoritative and
the current WebGPU plane renders behind DOM windows.

Acceptance criteria:

- marquee interaction derives world rect through the existing camera helpers
- replace/add/toggle modes work
- overlay draws from derived state and is pointer-events-none
- pan remains available through an explicit pan chord rather than competing with
  plain empty-canvas marquee drag
- future shader renderer can replace the DOM overlay without changing reducer
  semantics

## Hardening Checklist

- [x] Selection survives close/minimize/open/restore without dangling ids.
- [x] Keyboard shortcuts never fire inside editable window body content.
- [x] Pointer and keyboard commands share command/reducer paths.
- [x] Multi-window move is one logical mutation, ready for undo coalescing.
- [ ] Selection bounds are computed from canonical world rects only.
- [x] Marquee selection uses screen-to-world projection, not DOM pixel guesses.
- [x] Visual overlays never become the source of selection truth.
- [ ] Tests cover zoomed and panned camera states.
- [ ] Tests cover pinned and unpinned stack bands.
- [ ] Tests cover minimized windows being excluded from selection.

## Open Questions

- Should focus always follow selection in the first implementation, or should
  desktop focus be allowed with a non-empty selection from day one?
- Should marquee intersection be configurable per tool mode, or is intersection
  enough until users ask for containment?
- Should selected pinned and unpinned windows move as one set, or should command
  operations respect stack-band boundaries?
- Should command placement operate on each selected window independently, or on
  the selection bounds as a group?
- Should keyboard bindings be framework defaults, consumer-provided, or merged
  from both with conflict detection?
