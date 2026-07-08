import {
  isCameraNavigationAvailable,
  navigateCamera,
  navigateCameraToWindow,
} from "./camera-navigation";
import { DEFAULT_INFINITE_CANVAS_ZOOM } from "./constants";
import { zoomCameraAtScreenPoint } from "./geometry";
import {
  clearSelection,
  getSelectableWindowIds,
  hasInfiniteCanvasSelection,
  getSelectedWindowBounds,
  getVisibleWindowBounds,
  isWindowSelected,
  selectAllVisibleWindows,
} from "./selection";
import { findWindow, focusWindow } from "./stacking";
import {
  getInfiniteCanvasDirectionalFocusTarget,
  isInfiniteCanvasWindowFullyVisible,
} from "./window-focus";
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
      type: "view.resetZoom",
    },
    description: "Reset the canvas zoom around the viewport center.",
    hotkeys: ["Mod+0"],
    id: "view.resetZoom",
    label: "Reset Zoom",
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

  return {
    ...state,
    windows: state.windows.map((window) =>
      isWindowSelected(state, window.id)
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
    case "window.focusDirection":
      return getInfiniteCanvasDirectionalFocusTarget(state, command.direction) !== null;
    case "window.nudge":
      return state.selection.windowIds.length > 0;
  }
}

function getInfiniteCanvasCommandGroup(command: InfiniteCanvasCommand): InfiniteCanvasCommandGroup {
  switch (command.type) {
    case "desktop.cancel":
      return "canvas";
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
    case "window.focusDirection":
      return focusWindowInDirection(state, command.direction, zoomPolicy);
    case "window.nudge":
      return nudgeSelectedWindows(state, command);
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
