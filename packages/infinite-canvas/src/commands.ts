import {
  isCameraNavigationAvailable,
  navigateCamera,
  navigateCameraToWindow,
} from "./camera-navigation";
import { DEFAULT_INFINITE_CANVAS_ZOOM } from "./constants";
import {
  getViewportInsetWorldRect,
  isUsableViewport,
  resizeRectFromHandle,
  zoomCameraAtScreenPoint,
} from "./geometry";
import {
  findInfiniteCanvasGroup,
  getInfiniteCanvasWindowGroup,
  isInfiniteCanvasWindowGrouped,
  setInfiniteCanvasGroupRect,
} from "./group-state";
import {
  canRedoInfiniteCanvas,
  canUndoInfiniteCanvas,
  redoInfiniteCanvasHistory,
  undoInfiniteCanvasHistory,
} from "./history";
import {
  clearSelection,
  getSelectableWindowIds,
  hasInfiniteCanvasSelection,
  getSelectedWindowBounds,
  getVisibleWindowBounds,
  isWindowSelected,
  selectAllVisibleWindows,
} from "./selection";
import { findWindow, focusWindow, updateWindowRect } from "./stacking";
import {
  getInfiniteCanvasDirectionalFocusTarget,
  isInfiniteCanvasWindowFullyVisible,
} from "./window-focus";
import { getInfiniteCanvasAlignedRects, getInfiniteCanvasDistributedRects } from "./window-arrange";
import { getInfiniteCanvasWindowPlacementRect } from "./window-placement";
import type {
  InfiniteCanvasCameraNavigationBehavior,
  InfiniteCanvasCommand,
  InfiniteCanvasCommandDescriptor,
  InfiniteCanvasCommandGroup,
  InfiniteCanvasContextualCommand,
  InfiniteCanvasDirection,
  InfiniteCanvasHotkeyBinding,
  InfiniteCanvasState,
  InfiniteCanvasZoomPolicy,
} from "./types";

const DEFAULT_INFINITE_CANVAS_COMMAND_DESCRIPTORS = [
  {
    command: {
      type: "desktop.cancel",
    },
    description: "Cancel the active interaction or clear desktop selection.",
    hotkeys: ["Escape"],
    id: "desktop.cancel",
    label: "Cancel",
  },
  {
    command: {
      type: "selection.clear",
    },
    description: "Clear the current desktop selection.",
    hotkeys: [],
    id: "selection.clear",
    label: "Clear Selection",
  },
  {
    command: {
      type: "selection.selectAllVisible",
    },
    description: "Select every visible window on the canvas.",
    hotkeys: ["Mod+A"],
    id: "selection.selectAllVisible",
    label: "Select All Windows",
  },
  {
    command: {
      type: "view.fitAll",
    },
    description: "Fit all visible windows inside the viewport.",
    hotkeys: ["Shift+1"],
    id: "view.fitAll",
    label: "Fit All",
  },
  {
    command: {
      type: "view.fitSelection",
    },
    description: "Fit the current selection inside the viewport.",
    hotkeys: ["Shift+2"],
    id: "view.fitSelection",
    label: "Fit Selection",
  },
  {
    command: {
      amountPx: 1,
      direction: "left",
      type: "window.nudge",
    },
    description: "Nudge the current selection left by one screen pixel.",
    hotkeys: ["ArrowLeft"],
    id: "window.nudge.left",
    label: "Nudge Left",
  },
  {
    command: {
      amountPx: 1,
      direction: "right",
      type: "window.nudge",
    },
    description: "Nudge the current selection right by one screen pixel.",
    hotkeys: ["ArrowRight"],
    id: "window.nudge.right",
    label: "Nudge Right",
  },
  {
    command: {
      amountPx: 1,
      direction: "up",
      type: "window.nudge",
    },
    description: "Nudge the current selection up by one screen pixel.",
    hotkeys: ["ArrowUp"],
    id: "window.nudge.up",
    label: "Nudge Up",
  },
  {
    command: {
      amountPx: 1,
      direction: "down",
      type: "window.nudge",
    },
    description: "Nudge the current selection down by one screen pixel.",
    hotkeys: ["ArrowDown"],
    id: "window.nudge.down",
    label: "Nudge Down",
  },
  {
    command: {
      amountPx: 10,
      direction: "left",
      type: "window.nudge",
    },
    description: "Nudge the current selection left by ten screen pixels.",
    hotkeys: ["Shift+ArrowLeft"],
    id: "window.nudge.left.large",
    label: "Nudge Left Large",
  },
  {
    command: {
      amountPx: 10,
      direction: "right",
      type: "window.nudge",
    },
    description: "Nudge the current selection right by ten screen pixels.",
    hotkeys: ["Shift+ArrowRight"],
    id: "window.nudge.right.large",
    label: "Nudge Right Large",
  },
  {
    command: {
      amountPx: 10,
      direction: "up",
      type: "window.nudge",
    },
    description: "Nudge the current selection up by ten screen pixels.",
    hotkeys: ["Shift+ArrowUp"],
    id: "window.nudge.up.large",
    label: "Nudge Up Large",
  },
  {
    command: {
      amountPx: 10,
      direction: "down",
      type: "window.nudge",
    },
    description: "Nudge the current selection down by ten screen pixels.",
    hotkeys: ["Shift+ArrowDown"],
    id: "window.nudge.down.large",
    label: "Nudge Down Large",
  },
  {
    command: {
      direction: "left",
      type: "window.focusDirection",
    },
    description: "Focus the nearest window to the left of the active one.",
    hotkeys: ["Alt+ArrowLeft"],
    id: "window.focus.left",
    label: "Focus Left",
  },
  {
    command: {
      direction: "right",
      type: "window.focusDirection",
    },
    description: "Focus the nearest window to the right of the active one.",
    hotkeys: ["Alt+ArrowRight"],
    id: "window.focus.right",
    label: "Focus Right",
  },
  {
    command: {
      direction: "up",
      type: "window.focusDirection",
    },
    description: "Focus the nearest window above the active one.",
    hotkeys: ["Alt+ArrowUp"],
    id: "window.focus.up",
    label: "Focus Up",
  },
  {
    command: {
      direction: "down",
      type: "window.focusDirection",
    },
    description: "Focus the nearest window below the active one.",
    hotkeys: ["Alt+ArrowDown"],
    id: "window.focus.down",
    label: "Focus Down",
  },
  {
    command: {
      type: "history.undo",
    },
    description: "Undo the last change to the windows or groups on the canvas.",
    hotkeys: ["Mod+Z"],
    id: "history.undo",
    label: "Undo",
  },
  {
    command: {
      type: "history.redo",
    },
    description: "Redo the change that was last undone.",
    hotkeys: ["Mod+Shift+Z", "Mod+Y"],
    id: "history.redo",
    label: "Redo",
  },
  // Arrange verbs ship with NO default chords, and that is a decision rather than an omission.
  // Eight commands would need eight chords; the unclaimed space is nearly exhausted (see the
  // rule below), and design tools do not agree on bindings for these anyway — they live in a
  // toolbar or a palette, which is where a consumer should put them. `hotkeyBindings` takes
  // them if a consumer disagrees.
  //
  // These act on the SELECTION and are one-shot. They are emphatically not a layout mode: a
  // canvas that keeps things aligned as they move is a tiling manager, and risk R5 has flagged
  // "global tiling semantics forced onto the infinite canvas" as live and standing since the
  // beginning. You align, and then the windows are where you put them.
  {
    command: { alignment: "left", type: "window.align" },
    description: "Align the selected windows to the left edge of their collective bounds.",
    hotkeys: [],
    id: "window.align.left",
    label: "Align Left",
  },
  {
    command: { alignment: "right", type: "window.align" },
    description: "Align the selected windows to the right edge of their collective bounds.",
    hotkeys: [],
    id: "window.align.right",
    label: "Align Right",
  },
  {
    command: { alignment: "top", type: "window.align" },
    description: "Align the selected windows to the top edge of their collective bounds.",
    hotkeys: [],
    id: "window.align.top",
    label: "Align Top",
  },
  {
    command: { alignment: "bottom", type: "window.align" },
    description: "Align the selected windows to the bottom edge of their collective bounds.",
    hotkeys: [],
    id: "window.align.bottom",
    label: "Align Bottom",
  },
  {
    command: { alignment: "horizontal-center", type: "window.align" },
    description: "Align the selected windows on a shared vertical centreline.",
    hotkeys: [],
    id: "window.align.horizontal-center",
    label: "Align Horizontal Centers",
  },
  {
    command: { alignment: "vertical-center", type: "window.align" },
    description: "Align the selected windows on a shared horizontal centreline.",
    hotkeys: [],
    id: "window.align.vertical-center",
    label: "Align Vertical Centers",
  },
  {
    command: { distribution: "horizontal", type: "window.distribute" },
    description: "Even out the horizontal gaps between the selected windows.",
    hotkeys: [],
    id: "window.distribute.horizontal",
    label: "Distribute Horizontally",
  },
  {
    command: { distribution: "vertical", type: "window.distribute" },
    description: "Even out the vertical gaps between the selected windows.",
    hotkeys: [],
    id: "window.distribute.vertical",
    label: "Distribute Vertically",
  },
  // ── The rule that governs every chord below, and one above. ──────────────────────────
  //
  // `registerInfiniteCanvasHotkeys` calls `preventDefault()` on any chord the canvas owns,
  // the moment it lands — that is what stops `Alt+ArrowLeft` at the edge of your windows
  // from navigating Back. It also means a default binding that shadows a browser or OS
  // shortcut is not a nuisance, it is theft. And the shortcuts the browser reserves for
  // itself are not always cancellable: on macOS `Cmd+Alt+Left/Right` switches tabs in
  // Chrome, Safari, and Firefox, so binding it would have switched the tab *and* placed the
  // window. `Cmd+Alt+C` opens DevTools; `Cmd+Shift+C` opens the inspector.
  //
  // Reset-zoom was `Mod+0` until 2026-07-08, which is the clearest violation of the rule
  // this file states. The browser's zoom accelerators — `Mod` with `0`, `+`, and `-` — are
  // handled above the page in Chrome, Firefox, and Safari alike: the keydown is delivered,
  // `preventDefault()` returns without error, and the page zoom resets anyway. So `Mod+0`
  // reset the canvas *and* the browser, two surprises for one keypress, and the canvas's
  // reset was the one the user could not see happen.
  //
  // `Shift+0` joins the view family it belongs to — `Shift+1` fits all, `Shift+2` fits the
  // selection — and is unclaimed. It also survives keyboard layout: `@tanstack/hotkeys`
  // matches a single-character hotkey against `event.key` first, and when `Shift+0` yields
  // `)` on a US layout it falls through to `event.code === "Digit0"`. The same path the two
  // chords beside it have always taken.
  {
    command: {
      type: "view.resetZoom",
    },
    description: "Reset the canvas zoom around the viewport center.",
    hotkeys: ["Shift+0"],
    id: "view.resetZoom",
    label: "Reset Zoom",
  },
  // `Mod+Shift+Arrow` is unclaimed in the browsers' page context, and reads as "the bigger
  // modifier moves the window further" beside `Shift+Arrow`'s ten-pixel nudge.
  {
    command: {
      region: "left",
      type: "window.place",
    },
    description: "Place the active window in the left half of the visible canvas.",
    hotkeys: ["Mod+Shift+ArrowLeft"],
    id: "window.place.left",
    label: "Place Left Half",
  },
  {
    command: {
      region: "right",
      type: "window.place",
    },
    description: "Place the active window in the right half of the visible canvas.",
    hotkeys: ["Mod+Shift+ArrowRight"],
    id: "window.place.right",
    label: "Place Right Half",
  },
  {
    command: {
      region: "top",
      type: "window.place",
    },
    description: "Place the active window in the top half of the visible canvas.",
    hotkeys: ["Mod+Shift+ArrowUp"],
    id: "window.place.top",
    label: "Place Top Half",
  },
  {
    command: {
      region: "bottom",
      type: "window.place",
    },
    description: "Place the active window in the bottom half of the visible canvas.",
    hotkeys: ["Mod+Shift+ArrowDown"],
    id: "window.place.bottom",
    label: "Place Bottom Half",
  },
  {
    command: {
      region: "fill",
      type: "window.place",
    },
    description: "Place the active window across the whole visible canvas.",
    hotkeys: ["Mod+Shift+Enter"],
    id: "window.place.fill",
    label: "Place Filling View",
  },
  {
    command: {
      region: "center",
      type: "window.place",
    },
    description: "Centre the active window at its current size.",
    // No default chord. Every obvious candidate is taken: `Mod+Alt+C` and `Mod+Shift+C`
    // both open browser devtools, and a canvas that swallows the inspector is a canvas
    // nobody can debug. Bind it through `hotkeyBindings` if you want one.
    hotkeys: [],
    id: "window.place.center",
    label: "Centre Window",
  },
  // The quarters have no default chord either — four more bindings would crowd the
  // vocabulary for a placement most users reach for through a menu. They stay dispatchable
  // as `{ region: "top-left", type: "window.place" }` and bindable through `hotkeyBindings`.
  //
  // Resize is `Alt+Shift+Arrow`, one modifier away from `Alt+Arrow`'s directional focus and
  // unowned by any browser. `Shift+Arrow` is already the ten-pixel nudge, so the vocabulary
  // reads: bare arrow moves a little, Shift moves a lot, Alt moves *focus*, Alt+Shift changes
  // the shape. Ten pixels, not one — a one-pixel resize is a keystroke nobody wants twice.
  {
    command: {
      amountPx: 10,
      direction: "right",
      type: "window.resize",
    },
    description: "Widen the active window by ten screen pixels.",
    hotkeys: ["Alt+Shift+ArrowRight"],
    id: "window.resize.right",
    label: "Widen Window",
  },
  {
    command: {
      amountPx: 10,
      direction: "left",
      type: "window.resize",
    },
    description: "Narrow the active window by ten screen pixels.",
    hotkeys: ["Alt+Shift+ArrowLeft"],
    id: "window.resize.left",
    label: "Narrow Window",
  },
  {
    command: {
      amountPx: 10,
      direction: "down",
      type: "window.resize",
    },
    description: "Make the active window ten screen pixels taller.",
    hotkeys: ["Alt+Shift+ArrowDown"],
    id: "window.resize.down",
    label: "Heighten Window",
  },
  {
    command: {
      amountPx: 10,
      direction: "up",
      type: "window.resize",
    },
    description: "Make the active window ten screen pixels shorter.",
    hotkeys: ["Alt+Shift+ArrowUp"],
    id: "window.resize.up",
    label: "Shorten Window",
  },
] satisfies readonly InfiniteCanvasCommandDescriptor[];

const FIT_CAMERA_NAVIGATION_BEHAVIOR = {
  type: "fit",
} satisfies InfiniteCanvasCameraNavigationBehavior;

/** Keyboard focus keeps the user's zoom; it only recentres. */
const FOCUS_CAMERA_NAVIGATION_BEHAVIOR = {
  type: "center",
} satisfies InfiniteCanvasCameraNavigationBehavior;

function getNudgeDelta(command: Extract<InfiniteCanvasCommand, { type: "window.nudge" }>) {
  switch (command.direction) {
    case "down":
      return {
        x: 0,
        y: command.amountPx,
      };
    case "left":
      return {
        x: -command.amountPx,
        y: 0,
      };
    case "right":
      return {
        x: command.amountPx,
        y: 0,
      };
    case "up":
      return {
        x: 0,
        y: -command.amountPx,
      };
  }
}

/**
 * Move focus to the neighbouring window, and bring the camera along only if the
 * target is not already fully on screen. Recentring on every arrow press would
 * be nauseating; never recentring would let focus escape offscreen, where the
 * user cannot see what they just selected.
 *
 * Focus reuses `focusWindow`, so a keyboard move raises and selects exactly as a
 * pointer click does — one canonical mutation, two input devices.
 */
function focusWindowInDirection<Kind extends string>(
  state: InfiniteCanvasState<Kind>,
  direction: InfiniteCanvasDirection,
  zoomPolicy: InfiniteCanvasZoomPolicy,
): InfiniteCanvasState<Kind> {
  const targetWindowId = getInfiniteCanvasDirectionalFocusTarget(state, direction);

  if (targetWindowId === null) {
    return state;
  }

  const focused = focusWindow(state, targetWindowId);
  const target = findWindow(focused, targetWindowId);

  if (target === null || isInfiniteCanvasWindowFullyVisible(focused, target.rect)) {
    return focused;
  }

  return navigateCameraToWindow(
    focused,
    {
      behavior: FOCUS_CAMERA_NAVIGATION_BEHAVIOR,
      windowId: targetWindowId,
    },
    zoomPolicy,
  );
}

/**
 * Nudge the selection by one screen step.
 *
 * **A grouped window has no rect of its own to nudge.** Its `rect` is the projection of its
 * group's tree, and `command.execute` is not re-projected the way `interaction.step` is, so
 * writing to it directly detached the pane from its shell until some later mutation
 * re-solved the tree and silently snapped it back. Arrow-nudging a group member therefore
 * translates the **shell**, exactly as dragging that member's header does (DOCK-003), and
 * each group moves once however many of its members are selected.
 */
function nudgeSelectedWindows<Kind extends string>(
  state: InfiniteCanvasState<Kind>,
  command: Extract<InfiniteCanvasCommand, { type: "window.nudge" }>,
) {
  if (state.selection.windowIds.length === 0) {
    return state;
  }

  const screenDelta = getNudgeDelta(command);
  const worldDelta = {
    x: screenDelta.x / state.camera.zoom,
    y: screenDelta.y / state.camera.zoom,
  };
  const selectedGroupIds = new Set(
    state.selection.windowIds
      .map((windowId) => getInfiniteCanvasWindowGroup(state, windowId)?.id)
      .filter((groupId) => groupId !== undefined),
  );
  // Shells first: `setInfiniteCanvasGroupRect` re-projects every member, so the window map
  // below must leave those members alone or it would translate them a second time.
  const movedState = [...selectedGroupIds].reduce<InfiniteCanvasState<Kind>>(
    (currentState, groupId) => {
      const group = findInfiniteCanvasGroup(currentState, groupId);

      return group === null
        ? currentState
        : setInfiniteCanvasGroupRect(currentState, {
            groupId,
            rect: {
              ...group.rect,
              x: group.rect.x + worldDelta.x,
              y: group.rect.y + worldDelta.y,
            },
          });
    },
    state,
  );

  return {
    ...movedState,
    windows: movedState.windows.map((window) =>
      isWindowSelected(movedState, window.id) &&
      !isInfiniteCanvasWindowGrouped(movedState, window.id)
        ? {
            ...window,
            rect: {
              ...window.rect,
              x: window.rect.x + worldDelta.x,
              y: window.rect.y + worldDelta.y,
            },
          }
        : window,
    ),
  };
}

/**
 * The selected windows an arrange verb may move: floating, not minimized.
 *
 * A **grouped** window is skipped rather than aligned, for the reason `window.place` refuses
 * one — a member's rect is its group's projection, so writing it would be overwritten by the
 * next solve. Aligning the group *shell* instead is coherent and is deliberately not done here:
 * it would mean a single command that sometimes moves one window and sometimes moves five, and
 * that ambiguity belongs in its own command rather than smuggled into this one.
 */
function getArrangeableWindows<Kind extends string>(state: InfiniteCanvasState<Kind>) {
  return state.windows.filter(
    (window) =>
      window.mode !== "minimized" &&
      isWindowSelected(state, window.id) &&
      !isInfiniteCanvasWindowGrouped(state, window.id),
  );
}

/**
 * Apply an arrange verb to the selection.
 *
 * The arranged rects come back in the order the windows went in — `window-arrange.ts`
 * guarantees that — so pairing them by index is sound. Nothing is resized, so no `minSize`
 * clamping is needed: the constraint cannot be violated by a translation.
 */
function arrangeSelectedWindows<Kind extends string>(
  state: InfiniteCanvasState<Kind>,
  command: Extract<InfiniteCanvasCommand, { type: "window.align" | "window.distribute" }>,
) {
  const targets = getArrangeableWindows(state);
  const rects = targets.map((window) => window.rect);
  const arranged =
    command.type === "window.align"
      ? getInfiniteCanvasAlignedRects(rects, command.alignment)
      : getInfiniteCanvasDistributedRects(rects, command.distribution);
  const rectByWindowId = new Map(
    targets.map((window, index) => [window.id, arranged[index] ?? window.rect]),
  );

  return {
    ...state,
    windows: state.windows.map((window) => {
      const rect = rectByWindowId.get(window.id);

      return rect === undefined ? window : { ...window, rect };
    }),
  };
}

function isInfiniteCanvasCommandEnabled<Kind extends string>(
  state: InfiniteCanvasState<Kind>,
  command: InfiniteCanvasCommand,
) {
  switch (command.type) {
    case "desktop.cancel":
      return state.interaction !== null || hasInfiniteCanvasSelection(state.selection);
    case "selection.clear":
      return hasInfiniteCanvasSelection(state.selection);
    case "selection.selectAllVisible":
      return getSelectableWindowIds(state).length > 0;
    case "view.fitAll":
      return (
        state.viewport.width > 0 &&
        state.viewport.height > 0 &&
        getVisibleWindowBounds(state) !== null
      );
    case "view.fitSelection":
      return (
        state.viewport.width > 0 &&
        state.viewport.height > 0 &&
        getSelectedWindowBounds(state) !== null
      );
    case "view.navigate":
      return isCameraNavigationAvailable(state, command.request);
    case "view.resetZoom":
      return state.viewport.width > 0 && state.viewport.height > 0;
    case "history.redo":
      return canRedoInfiniteCanvas(state);
    case "history.undo":
      return canUndoInfiniteCanvas(state);
    case "window.focusDirection":
      return getInfiniteCanvasDirectionalFocusTarget(state, command.direction) !== null;
    case "window.nudge":
      return state.selection.windowIds.length > 0;
    case "window.place":
    case "window.resize":
      return getActiveFloatingWindowId(state) !== null;
    // Two windows is the floor for an alignment and three for a distribution, and the pure
    // module is the one that knows which — asking it is how the enabled state and the result
    // stay in agreement rather than drifting into two definitions of "enough windows".
    case "window.align":
    case "window.distribute": {
      const rects = getArrangeableWindows(state).map((window) => window.rect);
      const arranged =
        command.type === "window.align"
          ? getInfiniteCanvasAlignedRects(rects, command.alignment)
          : getInfiniteCanvasDistributedRects(rects, command.distribution);

      return arranged !== rects;
    }
  }
}

/**
 * The window a placement or resize command acts on, or `null` when there is none.
 *
 * The **active** window, not the selection: "left half" applied to three selected windows
 * would stack all three in the same rect, and a tiling shortcut that silently buries two of
 * your windows is worse than one that does nothing. Resize follows placement here rather than
 * following `nudge`, because growing three windows by the same delta about their own origins
 * is a mess nobody asked for.
 *
 * A grouped window is refused, for the same reason `interaction.startResize` refuses it — a
 * member's rect is its group's projection, and a pane placed in the left half of the screen
 * would be snapped back the moment the tree re-solved. Place the shell, or undock first.
 *
 * An unmeasured viewport has no halves, and no pixels to convert a resize through.
 */
function getActiveFloatingWindowId<Kind extends string>(
  state: InfiniteCanvasState<Kind>,
): string | null {
  const windowId = state.activeWindowId;

  if (windowId === null || !isUsableViewport(state.viewport)) {
    return null;
  }

  const window = findWindow(state, windowId);

  return window === null ||
    window.mode === "minimized" ||
    isInfiniteCanvasWindowGrouped(state, windowId)
    ? null
    : windowId;
}

function placeActiveWindow<Kind extends string>(
  state: InfiniteCanvasState<Kind>,
  command: Extract<InfiniteCanvasCommand, { type: "window.place" }>,
): InfiniteCanvasState<Kind> {
  const windowId = getActiveFloatingWindowId(state);
  const window = windowId === null ? null : findWindow(state, windowId);

  if (windowId === null || window === null) {
    return state;
  }

  // The visible region, in world units. "Left half" means the left half of what you can
  // see: an unbounded world has no halves.
  const bounds = getViewportInsetWorldRect(state.camera, state.viewport, 0);

  return updateWindowRect(
    state,
    windowId,
    getInfiniteCanvasWindowPlacementRect(bounds, command.region, window.rect, window.minSize),
  );
}

/**
 * Grow or shrink the active window's east and south edges, leaving its origin where it is.
 *
 * `resizeRectFromHandle` already does exactly this for the `east` and `south` handles, clamps
 * against `minSize`, and is exercised by every pointer resize. Reimplementing the arithmetic
 * here would be a second definition of what a resize means, and the two would eventually
 * disagree about the floor.
 *
 * The delta converts through the camera, as a nudge does: ten screen pixels stays ten screen
 * pixels at any zoom, which is what a keyboard user is asking for. Ten *world* units would
 * shrink to nothing zoomed out and fly off the screen zoomed in.
 */
function resizeActiveWindow<Kind extends string>(
  state: InfiniteCanvasState<Kind>,
  command: Extract<InfiniteCanvasCommand, { type: "window.resize" }>,
): InfiniteCanvasState<Kind> {
  const windowId = getActiveFloatingWindowId(state);
  const window = windowId === null ? null : findWindow(state, windowId);

  if (windowId === null || window === null) {
    return state;
  }

  const worldDelta = command.amountPx / state.camera.zoom;
  const isHorizontal = command.direction === "left" || command.direction === "right";
  const isGrowing = command.direction === "right" || command.direction === "down";
  const signedDelta = isGrowing ? worldDelta : -worldDelta;

  return updateWindowRect(
    state,
    windowId,
    resizeRectFromHandle(
      window.rect,
      isHorizontal ? "east" : "south",
      { x: isHorizontal ? signedDelta : 0, y: isHorizontal ? 0 : signedDelta },
      window.minSize,
    ),
  );
}

function getInfiniteCanvasCommandGroup(command: InfiniteCanvasCommand): InfiniteCanvasCommandGroup {
  switch (command.type) {
    case "desktop.cancel":
      return "canvas";
    case "history.redo":
    case "history.undo":
      return "edit";
    case "selection.clear":
    case "selection.selectAllVisible":
      return "selection";
    case "view.fitAll":
    case "view.navigate":
    case "view.resetZoom":
      return "view";
    case "view.fitSelection":
      return "selection";
    case "window.align":
    case "window.distribute":
    case "window.focusDirection":
    case "window.nudge":
    case "window.place":
    case "window.resize":
      return "window";
  }
}

function getInfiniteCanvasContextualCommands<Kind extends string>(
  state: InfiniteCanvasState<Kind>,
  commandDescriptors: readonly InfiniteCanvasCommandDescriptor[] = DEFAULT_INFINITE_CANVAS_COMMAND_DESCRIPTORS,
): readonly InfiniteCanvasContextualCommand[] {
  return commandDescriptors.map((descriptor) => ({
    ...descriptor,
    enabled: isInfiniteCanvasCommandEnabled(state, descriptor.command),
    group: getInfiniteCanvasCommandGroup(descriptor.command),
  }));
}

function getAvailableInfiniteCanvasContextualCommands<Kind extends string>(
  state: InfiniteCanvasState<Kind>,
  commandDescriptors: readonly InfiniteCanvasCommandDescriptor[] = DEFAULT_INFINITE_CANVAS_COMMAND_DESCRIPTORS,
) {
  return getInfiniteCanvasContextualCommands(state, commandDescriptors).filter(
    (command) => command.enabled,
  );
}

function executeInfiniteCanvasCommand<Kind extends string>(
  state: InfiniteCanvasState<Kind>,
  command: InfiniteCanvasCommand,
  zoomPolicy: InfiniteCanvasZoomPolicy = DEFAULT_INFINITE_CANVAS_ZOOM,
): InfiniteCanvasState<Kind> {
  switch (command.type) {
    case "desktop.cancel":
      return state.interaction === null
        ? clearSelection(state)
        : {
            ...state,
            interaction: null,
            snapPreview: null,
          };
    case "selection.clear":
      return clearSelection(state);
    case "selection.selectAllVisible":
      return selectAllVisibleWindows(state);
    case "view.fitAll":
      return navigateCamera(
        state,
        {
          behavior: FIT_CAMERA_NAVIGATION_BEHAVIOR,
          target: {
            type: "visibleWindows",
          },
        },
        zoomPolicy,
      );
    case "view.fitSelection":
      return navigateCamera(
        state,
        {
          behavior: FIT_CAMERA_NAVIGATION_BEHAVIOR,
          target: {
            type: "selection",
          },
        },
        zoomPolicy,
      );
    case "view.navigate":
      return navigateCamera(state, command.request, zoomPolicy);
    case "view.resetZoom":
      return {
        ...state,
        camera: zoomCameraAtScreenPoint(
          state.camera,
          state.viewport,
          {
            x: state.viewport.width / 2,
            y: state.viewport.height / 2,
          },
          zoomPolicy.defaultZoom,
          zoomPolicy,
        ),
      };
    case "history.redo":
      return redoInfiniteCanvasHistory(state);
    case "history.undo":
      return undoInfiniteCanvasHistory(state);
    case "window.focusDirection":
      return focusWindowInDirection(state, command.direction, zoomPolicy);
    case "window.align":
    case "window.distribute":
      return arrangeSelectedWindows(state, command);
    case "window.nudge":
      return nudgeSelectedWindows(state, command);
    case "window.place":
      return placeActiveWindow(state, command);
    case "window.resize":
      return resizeActiveWindow(state, command);
  }
}

function getInfiniteCanvasHotkeyBindings(
  commandDescriptors: readonly InfiniteCanvasCommandDescriptor[] = DEFAULT_INFINITE_CANVAS_COMMAND_DESCRIPTORS,
) {
  return commandDescriptors.flatMap((descriptor) =>
    descriptor.hotkeys.map(
      (hotkey): InfiniteCanvasHotkeyBinding => ({
        command: descriptor.command,
        description: descriptor.description,
        hotkey,
        id: descriptor.id,
        label: descriptor.label,
      }),
    ),
  );
}

export {
  DEFAULT_INFINITE_CANVAS_COMMAND_DESCRIPTORS,
  executeInfiniteCanvasCommand,
  getAvailableInfiniteCanvasContextualCommands,
  getInfiniteCanvasCommandGroup,
  getInfiniteCanvasContextualCommands,
  getInfiniteCanvasHotkeyBindings,
  isInfiniteCanvasCommandEnabled,
};

export type { InfiniteCanvasCommandDescriptor, InfiniteCanvasHotkeyBinding };
