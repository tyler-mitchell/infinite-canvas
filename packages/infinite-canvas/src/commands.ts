import {
  isCameraNavigationAvailable,
  navigateCamera,
  navigateCameraToWindow,
} from "./camera-navigation";
import { DEFAULT_INFINITE_CANVAS_ZOOM } from "./constants";
import { getViewportInsetWorldRect, isUsableViewport, zoomCameraAtScreenPoint } from "./geometry";
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
  {
    command: {
      type: "view.resetZoom",
    },
    description: "Reset the canvas zoom around the viewport center.",
    hotkeys: ["Mod+0"],
    id: "view.resetZoom",
    label: "Reset Zoom",
  },
  // Placement chords are `Mod+Shift+…`, and the reason is worth keeping.
  //
  // `registerInfiniteCanvasHotkeys` calls `preventDefault()` on any chord the canvas owns,
  // the moment it lands — that is what stops `Alt+ArrowLeft` at the edge of your windows
  // from navigating Back. It also means a default binding that shadows a browser or OS
  // shortcut is not a nuisance, it is theft. And the shortcuts the browser reserves for
  // itself are not always cancellable: on macOS `Cmd+Alt+Left/Right` switches tabs in
  // Chrome, Safari, and Firefox, so binding it would have switched the tab *and* placed the
  // window. `Cmd+Alt+C` opens DevTools; `Cmd+Shift+C` opens the inspector.
  //
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
      return getPlaceableWindowId(state) !== null;
  }
}

/**
 * The window a placement command acts on, or `null` when there is nothing to place.
 *
 * The **active** window, not the selection: "left half" applied to three selected windows
 * would stack all three in the same rect, and a tiling shortcut that silently buries two of
 * your windows is worse than one that does nothing.
 *
 * A grouped window is refused, for the same reason `interaction.startResize` refuses it — a
 * member's rect is its group's projection, and a pane placed in the left half of the screen
 * would be snapped back the moment the tree re-solved. Place the shell, or undock first.
 *
 * An unmeasured viewport has no halves.
 */
function getPlaceableWindowId<Kind extends string>(
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
  const windowId = getPlaceableWindowId(state);
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
    case "window.focusDirection":
    case "window.nudge":
    case "window.place":
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
    case "window.nudge":
      return nudgeSelectedWindows(state, command);
    case "window.place":
      return placeActiveWindow(state, command);
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
