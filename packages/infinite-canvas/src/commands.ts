import {
  isCameraNavigationAvailable,
  navigateCamera,
  navigateCameraToWindow,
} from "./camera-navigation";
import { DEFAULT_INFINITE_CANVAS_ZOOM } from "./constants";
import { calcGridColWidth } from "react-grid-layout/core";
import {
  getInfiniteCanvasContentWorldRect,
  getViewportInsetWorldRect,
  isUsableViewport,
  panCameraByScreenDelta,
  resizeRectFromHandle,
  zoomCameraAtScreenPoint,
} from "./geometry";
import { getInfiniteCanvasGroupGutterWeights, getInfiniteCanvasGroupLayout } from "./group-layout";
import {
  findInfiniteCanvasGroupNode,
  getInfiniteCanvasGroupParent,
  getInfiniteCanvasGroupWindowIds,
  type InfiniteCanvasGroupContainerNode,
  type InfiniteCanvasGroupDockEdge,
} from "./group-tree";
import {
  applyInfiniteCanvasDockPreview,
  closeInfiniteCanvasGroup,
  getInfiniteCanvasRoomAround,
  detachInfiniteCanvasWindowFromGroups,
  equalizeInfiniteCanvasGroupChildrenInState,
  findInfiniteCanvasGroup,
  getInfiniteCanvasWindowGroup,
  getInfiniteCanvasMasonryMembership,
  getInfiniteCanvasMasonryGrid,
  isInfiniteCanvasWindowGrouped,
  reorderInfiniteCanvasGroupChildInState,
  resizeInfiniteCanvasMasonryMember,
  resolveInfiniteCanvasDockPreviewForTarget,
  revealInfiniteCanvasGroupWindow,
  setInfiniteCanvasGroupAxisInState,
  setInfiniteCanvasGroupChildWeightsInState,
  setInfiniteCanvasGroupLayoutModeInState,
  setInfiniteCanvasGroupRect,
  undockInfiniteCanvasWindowFromGroup,
} from "./group-state";
import {
  canRedoInfiniteCanvas,
  canUndoInfiniteCanvas,
  redoInfiniteCanvasHistory,
  undoInfiniteCanvasHistory,
} from "./history";
import {
  addSelection,
  clearSelection,
  getSelectableWindowIds,
  hasInfiniteCanvasSelection,
  getSelectedWindowBounds,
  getVisibleWindowBounds,
  isWindowSelected,
  removeSelection,
  selectAllVisibleWindows,
} from "./selection";
import {
  closeWindow,
  findWindow,
  focusWindow,
  focusWindowPreservingSelection,
  maximizeWindow,
  minimizeWindow,
  restoreWindow,
  toggleWindowPinned,
  updateWindowRect,
} from "./stacking";
import {
  getInfiniteCanvasDirectionalFocusTarget,
  isInfiniteCanvasWindowFullyVisible,
} from "./window-focus";
import {
  getInfiniteCanvasAlignedRects,
  getInfiniteCanvasDistributedRects,
  getInfiniteCanvasSwappedRects,
} from "./window-arrange";
import { getInfiniteCanvasPackedRects } from "./window-packing";
import {
  getInfiniteCanvasVacantRect,
  getInfiniteCanvasWindowPlacementRect,
} from "./window-placement";
import {
  activateInfiniteCanvasWorkspace,
  closeInfiniteCanvasWorkspace,
  createInfiniteCanvasWorkspace,
  detachInfiniteCanvasWindowFromWorkspaces,
  findInfiniteCanvasWorkspace,
  isInfiniteCanvasWindowInActiveWorkspace,
  moveInfiniteCanvasWindowsToWorkspace,
  removeInfiniteCanvasWindowFromWorkspace,
} from "./workspace";
import type {
  InfiniteCanvasCameraNavigationBehavior,
  InfiniteCanvasCommand,
  InfiniteCanvasCommandDescriptor,
  InfiniteCanvasCommandGroup,
  InfiniteCanvasContextualCommand,
  InfiniteCanvasDirection,
  InfiniteCanvasHotkeyBinding,
  InfiniteCanvasRect,
  InfiniteCanvasState,
  InfiniteCanvasWindowCapability,
  InfiniteCanvasWindowMode,
  InfiniteCanvasZoomPolicy,
} from "./types";
import { isInfiniteCanvasWindowCapable } from "./window-capabilities";

/** Nudge moves a docked shell. Arrange commands skip docked panes. */
const NUDGE_GROUP_RULE =
  "A docked window moves its whole group, which moves once however many of its panes are selected.";
const ARRANGE_GROUP_RULE = "Docked windows are skipped; only floating ones move.";

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
    description: "Select every window on this desktop that is not minimized.",
    hotkeys: ["Mod+A"],
    id: "selection.selectAllVisible",
    label: "Select All Windows",
  },
  {
    command: {
      type: "view.fitAll",
    },
    description: "Fit every window on this desktop that is not minimized inside the viewport.",
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
    description: `Nudge the current selection left by one screen pixel. ${NUDGE_GROUP_RULE}`,
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
    description: `Nudge the current selection right by one screen pixel. ${NUDGE_GROUP_RULE}`,
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
    description: `Nudge the current selection up by one screen pixel. ${NUDGE_GROUP_RULE}`,
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
    description: `Nudge the current selection down by one screen pixel. ${NUDGE_GROUP_RULE}`,
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
    description: `Nudge the current selection left by ten screen pixels. ${NUDGE_GROUP_RULE}`,
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
    description: `Nudge the current selection right by ten screen pixels. ${NUDGE_GROUP_RULE}`,
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
    description: `Nudge the current selection up by ten screen pixels. ${NUDGE_GROUP_RULE}`,
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
    description: `Nudge the current selection down by ten screen pixels. ${NUDGE_GROUP_RULE}`,
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
    command: { alignment: "left", type: "window.align" },
    description: `Align the selected windows to the left edge of their collective bounds. ${ARRANGE_GROUP_RULE}`,
    hotkeys: [],
    id: "window.align.left",
    label: "Align Left",
  },
  {
    command: { alignment: "right", type: "window.align" },
    description: `Align the selected windows to the right edge of their collective bounds. ${ARRANGE_GROUP_RULE}`,
    hotkeys: [],
    id: "window.align.right",
    label: "Align Right",
  },
  {
    command: { alignment: "top", type: "window.align" },
    description: `Align the selected windows to the top edge of their collective bounds. ${ARRANGE_GROUP_RULE}`,
    hotkeys: [],
    id: "window.align.top",
    label: "Align Top",
  },
  {
    command: { alignment: "bottom", type: "window.align" },
    description: `Align the selected windows to the bottom edge of their collective bounds. ${ARRANGE_GROUP_RULE}`,
    hotkeys: [],
    id: "window.align.bottom",
    label: "Align Bottom",
  },
  {
    command: { alignment: "horizontal-center", type: "window.align" },
    description: `Align the selected windows on a shared vertical centreline. ${ARRANGE_GROUP_RULE}`,
    hotkeys: [],
    id: "window.align.horizontal-center",
    label: "Align Horizontal Centers",
  },
  {
    command: { alignment: "vertical-center", type: "window.align" },
    description: `Align the selected windows on a shared horizontal centreline. ${ARRANGE_GROUP_RULE}`,
    hotkeys: [],
    id: "window.align.vertical-center",
    label: "Align Vertical Centers",
  },
  {
    command: { direction: "left", type: "window.dockDirection" },
    description: "Dock the active window against the nearest window to its left.",
    hotkeys: [],
    id: "window.dock.left",
    label: "Dock Left",
  },
  {
    command: { direction: "right", type: "window.dockDirection" },
    description: "Dock the active window against the nearest window to its right.",
    hotkeys: [],
    id: "window.dock.right",
    label: "Dock Right",
  },
  {
    command: { direction: "up", type: "window.dockDirection" },
    description: "Dock the active window against the nearest window above it.",
    hotkeys: [],
    id: "window.dock.up",
    label: "Dock Up",
  },
  {
    command: { direction: "down", type: "window.dockDirection" },
    description: "Dock the active window against the nearest window below it.",
    hotkeys: [],
    id: "window.dock.down",
    label: "Dock Down",
  },
  {
    command: { type: "window.undock" },
    description:
      "Tear the active window out of its group, back to floating at the size it currently occupies.",
    hotkeys: [],
    id: "window.undock",
    label: "Undock Window",
  },
  {
    command: { direction: "left", type: "selection.extendDirection" },
    description:
      "Add the nearest window to the left of the active one to the selection, and focus it.",
    hotkeys: [],
    id: "selection.extend.left",
    label: "Extend Selection Left",
  },
  {
    command: { direction: "right", type: "selection.extendDirection" },
    description:
      "Add the nearest window to the right of the active one to the selection, and focus it.",
    hotkeys: [],
    id: "selection.extend.right",
    label: "Extend Selection Right",
  },
  {
    command: { direction: "up", type: "selection.extendDirection" },
    description: "Add the nearest window above the active one to the selection, and focus it.",
    hotkeys: [],
    id: "selection.extend.up",
    label: "Extend Selection Up",
  },
  {
    command: { direction: "down", type: "selection.extendDirection" },
    description: "Add the nearest window below the active one to the selection, and focus it.",
    hotkeys: [],
    id: "selection.extend.down",
    label: "Extend Selection Down",
  },
  {
    command: { direction: "next", type: "workspace.cycle" },
    description: "Switch to the next workspace, wrapping at the end.",
    hotkeys: [],
    id: "workspace.cycle.next",
    label: "Next Workspace",
  },
  {
    command: { direction: "previous", type: "workspace.cycle" },
    description: "Switch to the previous workspace, wrapping at the start.",
    hotkeys: [],
    id: "workspace.cycle.previous",
    label: "Previous Workspace",
  },
  {
    command: { type: "workspace.showAll" },
    description: "Leave the current workspace and show every window on the canvas.",
    hotkeys: [],
    id: "workspace.showAll",
    label: "Show All Windows",
  },
  {
    command: { type: "workspace.create", workspaceId: "" },
    description: "Make a new desktop and go to it. Windows stay where they are; none are moved.",
    hotkeys: [],
    id: "workspace.create",
    label: "New Desktop",
  },
  {
    command: { type: "workspace.enter", workspaceId: "" },
    description: "Go to a desktop, restoring the camera and selection it was left with.",
    hotkeys: [],
    id: "workspace.enter",
    label: "Go to Desktop",
  },
  {
    command: { type: "window.reveal", windowId: "" },
    description:
      "Go to a window: switch desktops if it is on another one, restore it if minimized, make it active, and bring the camera to it.",
    hotkeys: [],
    id: "window.reveal",
    label: "Reveal Window",
  },
  {
    command: { type: "workspace.close", workspaceId: "" },
    description: "Remove a desktop. The windows on it stay open; only the grouping goes.",
    hotkeys: [],
    id: "workspace.close",
    label: "Close Desktop",
  },
  {
    command: { type: "workspace.moveActiveWindow", workspaceId: "" },
    description:
      "Send the active window to another desktop, leaving the one it is on. A docked window takes its whole group with it.",
    hotkeys: [],
    id: "workspace.moveActiveWindow",
    label: "Move Window to Desktop",
  },
  {
    command: { type: "workspace.removeActiveWindow" },
    description:
      "Take the active window off this workspace. The window stays open; it is no longer on this desktop. A docked window takes its whole group with it.",
    hotkeys: [],
    id: "workspace.removeActiveWindow",
    label: "Remove Window From Workspace",
  },
  {
    command: { type: "selection.removeActive" },
    description:
      "Drop the active window from the selection and fall back to the one before it — the way out of extending one window too far.",
    hotkeys: [],
    id: "selection.removeActive",
    label: "Remove Window From Selection",
  },
  {
    command: { amountPx: 200, direction: "left", type: "view.pan" },
    description: "Move the viewport left across the canvas.",
    hotkeys: [],
    id: "view.pan.left",
    label: "Pan Left",
  },
  {
    command: { amountPx: 200, direction: "right", type: "view.pan" },
    description: "Move the viewport right across the canvas.",
    hotkeys: [],
    id: "view.pan.right",
    label: "Pan Right",
  },
  {
    command: { amountPx: 200, direction: "up", type: "view.pan" },
    description: "Move the viewport up across the canvas.",
    hotkeys: [],
    id: "view.pan.up",
    label: "Pan Up",
  },
  {
    command: { amountPx: 200, direction: "down", type: "view.pan" },
    description: "Move the viewport down across the canvas.",
    hotkeys: [],
    id: "view.pan.down",
    label: "Pan Down",
  },
  {
    command: { factor: 1.25, type: "view.zoomBy" },
    description: "Zoom in one step, holding the centre of the viewport still.",
    hotkeys: ["="],
    id: "view.zoomIn",
    label: "Zoom In",
  },
  {
    command: { factor: 0.8, type: "view.zoomBy" },
    description: "Zoom out one step, holding the centre of the viewport still.",
    hotkeys: ["-"],
    id: "view.zoomOut",
    label: "Zoom Out",
  },
  {
    command: { type: "activeWindow.close" },
    description: "Close the active window.",
    hotkeys: [],
    id: "activeWindow.close",
    label: "Close Window",
  },
  {
    command: { type: "selection.close" },
    description: "Close every selected window that can be closed, as a single undoable edit.",
    hotkeys: [],
    id: "selection.close",
    label: "Close Selected Windows",
  },
  {
    command: { type: "selection.minimize" },
    description:
      "Collapse every selected window that can be minimized, as a single undoable edit. Docked windows leave their groups on the way, so minimizing a whole group empties its shell.",
    hotkeys: [],
    id: "selection.minimize",
    label: "Minimize Selected Windows",
  },
  {
    command: { type: "selection.togglePinned" },
    description: "Pin every selected window, or unpin them all when every one is already pinned.",
    hotkeys: [],
    id: "selection.togglePinned",
    label: "Pin / Unpin Selected Windows",
  },
  {
    command: { type: "activeWindow.minimize" },
    description:
      "Collapse the active window into the dock. A docked window leaves its group on the way, since a pane in the dock cannot hold a layout slot.",
    hotkeys: [],
    id: "activeWindow.minimize",
    label: "Minimize Window",
  },
  {
    command: { type: "activeWindow.toggleMaximized" },
    description:
      "Maximize the active window to fill the viewport, or restore it to the size it had before. Maximizing takes a docked window out of its group, and restoring does not put it back.",
    hotkeys: [],
    id: "activeWindow.toggleMaximized",
    label: "Maximize / Restore Window",
  },
  {
    command: { type: "activeWindow.togglePinned" },
    description: "Pin the active window so it stacks above every unpinned one, or unpin it.",
    hotkeys: [],
    id: "activeWindow.togglePinned",
    label: "Pin / Unpin Window",
  },
  {
    command: { layout: "split", type: "group.setLayout" },
    description: "Show the active window's panes side by side, sharing the container.",
    hotkeys: [],
    id: "group.setLayout.split",
    label: "Layout: Split",
  },
  {
    command: { layout: "tabs", type: "group.setLayout" },
    description: "Collapse the active window's panes into a tab strip, one visible at a time.",
    hotkeys: [],
    id: "group.setLayout.tabs",
    label: "Layout: Tabs",
  },
  {
    command: { layout: "accordion", type: "group.setLayout" },
    description: "Stack the active window's panes as folds, one expanded at a time.",
    hotkeys: [],
    id: "group.setLayout.accordion",
    label: "Layout: Accordion",
  },
  {
    command: { layout: "masonry", type: "group.setLayout" },
    description:
      "Pack the active window's panes on a lattice of square cells; the shell grows with its rows.",
    hotkeys: [],
    id: "group.setLayout.masonry",
    label: "Layout: Lattice",
  },
  {
    command: { amountPx: 24, type: "group.resizePane" },
    description:
      "Give the active window a larger share of its container, taking it from the next pane along — or from the previous one when the active window is last.",
    hotkeys: [],
    id: "group.growPane",
    label: "Grow Pane",
  },
  {
    command: { amountPx: -24, type: "group.resizePane" },
    description:
      "Give the active window a smaller share of its container, returning it to the next pane along — or to the previous one when the active window is last.",
    hotkeys: [],
    id: "group.shrinkPane",
    label: "Shrink Pane",
  },
  {
    command: { type: "group.dissolve" },
    description:
      "Break up the group holding the active window. A split's panes stay exactly where they were; tabbed or folded ones share one rect, so they are placed clear of each other.",
    hotkeys: [],
    id: "group.dissolve",
    label: "Ungroup Panes",
  },
  {
    command: { toward: "start", type: "group.moveChild" },
    description: "Move the active window one place toward the start of its container's order.",
    hotkeys: [],
    id: "group.moveChild.start",
    label: "Move Pane Toward Start",
  },
  {
    command: { toward: "end", type: "group.moveChild" },
    description: "Move the active window one place toward the end of its container's order.",
    hotkeys: [],
    id: "group.moveChild.end",
    label: "Move Pane Toward End",
  },
  {
    command: { type: "group.flipAxis" },
    description:
      "Turn the active window's panes through ninety degrees — a row becomes a column, and back.",
    hotkeys: [],
    id: "group.flipAxis",
    label: "Flip Pane Orientation",
  },
  {
    command: { type: "group.equalizeChildren" },
    description:
      "Reset the panes sharing a row or column with the active window to equal shares, undoing accumulated seam drags.",
    hotkeys: [],
    id: "group.equalizeChildren",
    label: "Equalize Panes",
  },
  {
    command: { type: "window.swap" },
    description: `Swap the two selected windows, each keeping its own size. Centres are exchanged rather than corners, so windows of different sizes visibly trade places. ${ARRANGE_GROUP_RULE}`,
    hotkeys: [],
    id: "window.swap",
    label: "Swap Windows",
  },
  {
    command: { gapPx: 16, type: "window.pack" },
    description: `Pack the selected windows into rows inside the region they already span, tallest first, so nothing overlaps and the block is as short as it can be. Sizes are kept. ${ARRANGE_GROUP_RULE}`,
    hotkeys: [],
    id: "window.pack",
    label: "Pack Windows",
  },
  {
    command: { distribution: "horizontal", type: "window.distribute" },
    description: `Even out the horizontal gaps between the selected windows. ${ARRANGE_GROUP_RULE}`,
    hotkeys: [],
    id: "window.distribute.horizontal",
    label: "Distribute Horizontally",
  },
  {
    command: { distribution: "vertical", type: "window.distribute" },
    description: `Even out the vertical gaps between the selected windows. ${ARRANGE_GROUP_RULE}`,
    hotkeys: [],
    id: "window.distribute.vertical",
    label: "Distribute Vertically",
  },
  // Default chords must not shadow browser or operating-system shortcuts.
  {
    command: {
      type: "view.resetZoom",
    },
    description: "Reset the canvas zoom around the viewport center.",
    hotkeys: ["Shift+0"],
    id: "view.resetZoom",
    label: "Reset Zoom",
  },
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
    hotkeys: [],
    id: "window.place.center",
    label: "Centre Window",
  },
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
] as const satisfies readonly InfiniteCanvasCommandDescriptor[];

export type CommandId = (typeof DEFAULT_INFINITE_CANVAS_COMMAND_DESCRIPTORS)[number]["id"];

const FIT_CAMERA_NAVIGATION_BEHAVIOR = {
  type: "fit",
} satisfies InfiniteCanvasCameraNavigationBehavior;

/** Keyboard focus changes the center and preserves zoom. */
const FOCUS_CAMERA_NAVIGATION_BEHAVIOR = {
  type: "center",
} satisfies InfiniteCanvasCameraNavigationBehavior;

/** Returns a screen direction for window nudging and camera panning. */
const getViewportCentre = (viewport: InfiniteCanvasState<string>["viewport"]) => ({
  x: viewport.width / 2,
  y: viewport.height / 2,
});

function getDirectionalScreenDelta(direction: InfiniteCanvasDirection, amountPx: number) {
  switch (direction) {
    case "down":
      return {
        x: 0,
        y: amountPx,
      };
    case "left":
      return {
        x: -amountPx,
        y: 0,
      };
    case "right":
      return {
        x: amountPx,
        y: 0,
      };
    case "up":
      return {
        x: 0,
        y: -amountPx,
      };
  }
}

/** Focuses the next window and recenters only when the target is outside the viewport. */
function focusWindowInDirection<Kind extends string>(
  state: InfiniteCanvasState<Kind>,
  direction: InfiniteCanvasDirection,
  zoomPolicy: InfiniteCanvasZoomPolicy,
  selection: "extend" | "replace",
): InfiniteCanvasState<Kind> {
  const targetWindowId = getInfiniteCanvasDirectionalFocusTarget(state, direction);

  if (targetWindowId === null) {
    return state;
  }

  // Extend the selection before focus so the new target becomes the anchor.
  const focused =
    selection === "extend"
      ? focusWindowPreservingSelection(addSelection(state, [targetWindowId]), targetWindowId)
      : focusWindow(state, targetWindowId);
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

/** Reveals a window by switching, restoring, focusing, and framing in that order. */
function revealWindow<Kind extends string>(
  state: InfiniteCanvasState<Kind>,
  windowId: string,
  zoomPolicy: InfiniteCanvasZoomPolicy,
): InfiniteCanvasState<Kind> {
  if (findWindow(state, windowId) === null) {
    return state;
  }

  const host = isInfiniteCanvasWindowInActiveWorkspace(state, windowId)
    ? state
    : activateInfiniteCanvasWorkspace(
        state,
        state.workspaces.find((workspace) => workspace.windowIds.includes(windowId))?.id ?? null,
      );
  const restored =
    findWindow(host, windowId)?.mode === "minimized" ? restoreWindow(host, windowId) : host;
  // Reveal all ancestor containers before focus.
  const shown = revealInfiniteCanvasGroupWindow(restored, windowId);
  const focused = focusWindow(shown, windowId);
  const target = findWindow(focused, windowId);

  // A window already in full view needs no camera move, the way directional focus treats it.
  if (target !== null && isInfiniteCanvasWindowFullyVisible(focused, target.rect)) {
    return focused;
  }

  return navigateCameraToWindow(
    focused,
    { behavior: FOCUS_CAMERA_NAVIGATION_BEHAVIOR, windowId },
    zoomPolicy,
  );
}

/** Nudges floating windows and moves each selected group shell once. */
function nudgeSelectedWindows<Kind extends string>(
  state: InfiniteCanvasState<Kind>,
  command: Extract<InfiniteCanvasCommand, { type: "window.nudge" }>,
) {
  if (state.selection.windowIds.length === 0) {
    return state;
  }

  const screenDelta = getDirectionalScreenDelta(command.direction, command.amountPx);
  const worldDelta = {
    x: screenDelta.x / state.camera.zoom,
    y: screenDelta.y / state.camera.zoom,
  };
  const selectedGroupIds = new Set(
    state.selection.windowIds
      .map((windowId) => getInfiniteCanvasWindowGroup(state, windowId)?.id)
      .filter((groupId) => groupId !== undefined),
  );
  // Move group shells first to prevent duplicate translation.
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
      !isInfiniteCanvasWindowGrouped(movedState, window.id) &&
      isInfiniteCanvasWindowCapable(window, "movable")
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

/** Returns selected floating windows that an arrange command can move. */
function getArrangeableWindows<Kind extends string>(state: InfiniteCanvasState<Kind>) {
  return state.windows.filter(
    (window) =>
      window.mode !== "minimized" &&
      isWindowSelected(state, window.id) &&
      !isInfiniteCanvasWindowGrouped(state, window.id) &&
      isInfiniteCanvasWindowCapable(window, "movable"),
  );
}

/** Applies an arrange operation without resizing selected floating windows. */
const INFINITE_CANVAS_ARRIVAL_EDGE = {
  down: "north",
  left: "east",
  right: "west",
  up: "south",
} as const satisfies Readonly<Record<InfiniteCanvasDirection, InfiniteCanvasGroupDockEdge>>;

/** Resolves a keyboard dock with the same target rules as directional focus. */
function resolveInfiniteCanvasDirectionalDock<Kind extends string>(
  state: InfiniteCanvasState<Kind>,
  direction: InfiniteCanvasDirection,
) {
  const windowId = state.activeWindowId;

  if (windowId === null) {
    return null;
  }

  const targetId = getInfiniteCanvasDirectionalFocusTarget(state, direction);

  return targetId === null
    ? null
    : resolveInfiniteCanvasDockPreviewForTarget(state, {
        edge: INFINITE_CANVAS_ARRIVAL_EDGE[direction],
        targetId,
        windowId,
      });
}

/** Required capability for each lifecycle command. `null` disables the capability gate. */
const INFINITE_CANVAS_LIFECYCLE_CAPABILITY = {
  "activeWindow.close": "closable",
  "activeWindow.minimize": "minimizable",
  "activeWindow.toggleMaximized": "maximizable",
  "activeWindow.togglePinned": null,
} as const satisfies Readonly<
  Record<
    | "activeWindow.close"
    | "activeWindow.minimize"
    | "activeWindow.toggleMaximized"
    | "activeWindow.togglePinned",
    InfiniteCanvasWindowCapability | null
  >
>;

/** Returns selected windows that satisfy a bulk command capability. */
function getInfiniteCanvasCapableSelection<Kind extends string>(
  state: InfiniteCanvasState<Kind>,
  capability: InfiniteCanvasWindowCapability | null,
): readonly string[] {
  return state.selection.windowIds.filter((windowId) => {
    const window = findWindow(state, windowId);

    return (
      window !== null && (capability === null || isInfiniteCanvasWindowCapable(window, capability))
    );
  });
}

/** Applies a lifecycle command after it detaches the window from its group. */
function applyInfiniteCanvasWindowLifecycle<Kind extends string>(
  state: InfiniteCanvasState<Kind>,
  type:
    | "activeWindow.close"
    | "activeWindow.minimize"
    | "activeWindow.toggleMaximized"
    | "activeWindow.togglePinned",
  windowId: string,
  mode: InfiniteCanvasWindowMode,
): InfiniteCanvasState<Kind> {
  switch (type) {
    // Closing also removes the window from each workspace.
    case "activeWindow.close":
      return detachInfiniteCanvasWindowFromWorkspaces(
        detachInfiniteCanvasWindowFromGroups(closeWindow(state, windowId), windowId),
        windowId,
      );
    case "activeWindow.minimize":
      return detachInfiniteCanvasWindowFromGroups(minimizeWindow(state, windowId), windowId);
    case "activeWindow.toggleMaximized":
      return mode === "maximized"
        ? restoreWindow(state, windowId)
        : maximizeWindow(detachInfiniteCanvasWindowFromGroups(state, windowId), windowId);
    case "activeWindow.togglePinned":
      return toggleWindowPinned(state, windowId);
  }
}

/** Selects the adjacent gutter and direction that grows the active pane. */
function resolveInfiniteCanvasPaneSeam<Kind extends string>(state: InfiniteCanvasState<Kind>) {
  const active = getActiveInfiniteCanvasGroupContainer(state);
  const windowId = state.activeWindowId;

  if (active === null || windowId === null) {
    return null;
  }

  const group = findInfiniteCanvasGroup(state, active.groupId);

  if (group === null) {
    return null;
  }

  const { gutters } = getInfiniteCanvasGroupLayout(group.tree, group.rect);
  const after = gutters.find((gutter) => gutter.afterChildId === windowId);
  const before = gutters.find((gutter) => gutter.beforeChildId === windowId);
  const gutter = after ?? before;

  return gutter === undefined
    ? null
    : {
        container: active.container,
        groupId: active.groupId,
        grows: after === undefined ? -1 : 1,
        gutter,
      };
}

/** Returns the next workspace with wrapping. The unfiltered view is outside the ring. */
function getNextInfiniteCanvasWorkspaceId<Kind extends string>(
  state: InfiniteCanvasState<Kind>,
  direction: "next" | "previous",
): string | null {
  const ids = state.workspaces.map((workspace) => workspace.id);

  if (ids.length === 0) {
    return state.activeWorkspaceId;
  }

  const at = state.activeWorkspaceId === null ? -1 : ids.indexOf(state.activeWorkspaceId);

  if (at === -1) {
    return (direction === "next" ? ids.at(0) : ids.at(-1)) ?? null;
  }

  return ids[(at + (direction === "next" ? 1 : ids.length - 1)) % ids.length] ?? null;
}

function getActiveInfiniteCanvasGroupChildIndex<Kind extends string>(
  state: InfiniteCanvasState<Kind>,
): Readonly<{ at: number; childId: string; count: number; groupId: string }> | null {
  const active = getActiveInfiniteCanvasGroupContainer(state);
  const childId = state.activeWindowId;

  if (active === null || childId === null) {
    return null;
  }

  const at = active.container.children.findIndex((child) => child.id === childId);

  return at === -1
    ? null
    : { at, childId, count: active.container.children.length, groupId: active.groupId };
}

function equalizeActiveInfiniteCanvasGroupContainer<Kind extends string>(
  state: InfiniteCanvasState<Kind>,
): InfiniteCanvasState<Kind> {
  const active = getActiveInfiniteCanvasGroupContainer(state);

  return active === null
    ? state
    : equalizeInfiniteCanvasGroupChildrenInState(state, {
        containerId: active.container.id,
        groupId: active.groupId,
      });
}

type InfiniteCanvasArrangeCommand = Extract<
  InfiniteCanvasCommand,
  { type: "window.align" | "window.distribute" | "window.pack" | "window.swap" }
>;

/**
 * The one place a command becomes an arrangement.
 *
 * Availability and execution both ask this, so a command can never be offered and then do nothing,
 * or be hidden while it would have worked.
 */
function getArrangedRects<Kind extends string>(
  state: InfiniteCanvasState<Kind>,
  rects: readonly InfiniteCanvasRect[],
  command: InfiniteCanvasArrangeCommand,
): readonly InfiniteCanvasRect[] {
  switch (command.type) {
    case "window.align":
      return getInfiniteCanvasAlignedRects(rects, command.alignment);
    case "window.distribute":
      return getInfiniteCanvasDistributedRects(rects, command.distribution);
    case "window.pack":
      return getInfiniteCanvasPackedRects(rects, {
        gapPx: command.gapPx,
        stripWidth: getPackingStripWidth(state),
      });
    case "window.swap":
      return getInfiniteCanvasSwappedRects(rects);
  }
}

/**
 * Packing fills the visible region, the same bound that placing a new window uses.
 *
 * Defaulting to the width the windows already span cannot widen anything, so packing a tall
 * column would only tighten the column. An unusable viewport leaves the packer its own default.
 */
function getPackingStripWidth<Kind extends string>(
  state: InfiniteCanvasState<Kind>,
): number | undefined {
  return isUsableViewport(state.viewport)
    ? getInfiniteCanvasContentWorldRect(state.camera, state.viewport, state.viewportInsets).width
    : undefined;
}

function arrangeSelectedWindows<Kind extends string>(
  state: InfiniteCanvasState<Kind>,
  command: InfiniteCanvasArrangeCommand,
) {
  const targets = getArrangeableWindows(state);
  const arranged = getArrangedRects(
    state,
    targets.map((window) => window.rect),
    command,
  );
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

/** Tests command availability with the same zoom policy that execution uses. */
function isInfiniteCanvasCommandEnabled<Kind extends string>(
  state: InfiniteCanvasState<Kind>,
  command: InfiniteCanvasCommand,
  zoomPolicy: InfiniteCanvasZoomPolicy = DEFAULT_INFINITE_CANVAS_ZOOM,
  selectionBounds?: InfiniteCanvasRect | null,
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
        (selectionBounds ?? getSelectedWindowBounds(state)) !== null
      );
    case "view.navigate":
      return isCameraNavigationAvailable(state, command.request, selectionBounds);
    case "view.resetZoom":
      return state.viewport.width > 0 && state.viewport.height > 0;
    case "history.redo":
      return canRedoInfiniteCanvas(state);
    case "history.undo":
      return canUndoInfiniteCanvas(state);
    case "window.focusDirection":
      return getInfiniteCanvasDirectionalFocusTarget(state, command.direction) !== null;
    // A grouped selection nudges its shell, so only floating members need the capability.
    case "window.nudge":
      return state.selection.windowIds.some((windowId) => {
        const window = findWindow(state, windowId);

        return (
          window !== null &&
          (isInfiniteCanvasWindowGrouped(state, windowId) ||
            isInfiniteCanvasWindowCapable(window, "movable"))
        );
      });
    case "window.place":
      return getActiveGeometryWindowId(state, "movable") !== null;
    case "window.resize":
      return getActiveGeometryWindowId(state, "resizable") !== null;
    case "window.dockDirection":
      return resolveInfiniteCanvasDirectionalDock(state, command.direction) !== null;
    case "window.undock":
      return (
        state.activeWindowId !== null && isInfiniteCanvasWindowGrouped(state, state.activeWindowId)
      );
    case "selection.extendDirection":
      return getInfiniteCanvasDirectionalFocusTarget(state, command.direction) !== null;
    case "selection.removeActive":
      return state.activeWindowId !== null && isWindowSelected(state, state.activeWindowId);
    case "workspace.cycle":
      return getNextInfiniteCanvasWorkspaceId(state, command.direction) !== state.activeWorkspaceId;
    case "workspace.showAll":
      return state.activeWorkspaceId !== null;
    case "workspace.moveActiveWindow":
      return (
        state.activeWindowId !== null &&
        findInfiniteCanvasWorkspace(state, command.workspaceId) !== null
      );
    case "workspace.removeActiveWindow":
      return (
        state.activeWorkspaceId !== null &&
        state.activeWindowId !== null &&
        isInfiniteCanvasWindowInActiveWorkspace(state, state.activeWindowId)
      );
    case "view.pan":
      return isUsableViewport(state.viewport);
    case "view.zoomBy":
      return (
        isUsableViewport(state.viewport) &&
        zoomCameraAtScreenPoint(
          state.camera,
          state.viewport,
          getViewportCentre(state.viewport),
          state.camera.zoom * command.factor,
          zoomPolicy,
        ).zoom !== state.camera.zoom
      );
    case "selection.close":
      return getInfiniteCanvasCapableSelection(state, "closable").length > 0;
    case "selection.minimize":
      return getInfiniteCanvasCapableSelection(state, "minimizable").some(
        (windowId) => findWindow(state, windowId)?.mode !== "minimized",
      );
    case "selection.togglePinned":
      return getInfiniteCanvasCapableSelection(state, null).length > 0;
    case "activeWindow.close":
    case "activeWindow.minimize":
    case "activeWindow.toggleMaximized":
    case "activeWindow.togglePinned": {
      const active = state.activeWindowId === null ? null : findWindow(state, state.activeWindowId);

      if (active === null) {
        return false;
      }

      const required = INFINITE_CANVAS_LIFECYCLE_CAPABILITY[command.type];

      return required === null || isInfiniteCanvasWindowCapable(active, required);
    }
    case "group.resizePane":
      return resolveInfiniteCanvasPaneSeam(state) !== null;
    case "group.dissolve":
      return (
        state.activeWindowId !== null && isInfiniteCanvasWindowGrouped(state, state.activeWindowId)
      );
    case "group.moveChild": {
      const index = getActiveInfiniteCanvasGroupChildIndex(state);

      if (index === null) {
        return false;
      }

      return command.toward === "start" ? index.at > 0 : index.at < index.count - 1;
    }
    case "group.setLayout": {
      const active = getActiveInfiniteCanvasGroupContainer(state);

      return active !== null && active.container.layout !== command.layout;
    }
    case "group.flipAxis": {
      const active = getActiveInfiniteCanvasGroupContainer(state);

      // Tabs and a lattice have no axis to flip.
      return (
        active !== null &&
        active.container.children.length > 1 &&
        active.container.layout !== "tabs" &&
        active.container.layout !== "masonry"
      );
    }
    case "group.equalizeChildren": {
      const active = getActiveInfiniteCanvasGroupContainer(state);

      if (active === null || active.container.children.length < 2) {
        return false;
      }

      const [first, ...rest] = active.container.children;

      return rest.some((child) => child.weight !== first?.weight);
    }
    case "window.align":
    case "window.distribute":
    case "window.pack":
    case "window.swap": {
      const rects = getArrangeableWindows(state).map((window) => window.rect);

      // Every arrangement returns the same array when it would change nothing.
      return getArrangedRects(state, rects, command) !== rects;
    }
    case "workspace.create":
      return (
        command.workspaceId !== "" &&
        findInfiniteCanvasWorkspace(state, command.workspaceId) === null
      );
    case "workspace.enter":
      return (
        command.workspaceId !== state.activeWorkspaceId &&
        findInfiniteCanvasWorkspace(state, command.workspaceId) !== null
      );
    case "workspace.close":
      return findInfiniteCanvasWorkspace(state, command.workspaceId) !== null;
    case "window.reveal":
      return findWindow(state, command.windowId) !== null;
  }
}

/** Returns the immediate group container of the active window. */
function getActiveInfiniteCanvasGroupContainer<Kind extends string>(
  state: InfiniteCanvasState<Kind>,
): Readonly<{ container: InfiniteCanvasGroupContainerNode; groupId: string }> | null {
  const windowId = state.activeWindowId;

  if (windowId === null) {
    return null;
  }

  const group = getInfiniteCanvasWindowGroup(state, windowId);

  if (group === null) {
    return null;
  }

  const container = getInfiniteCanvasGroupParent(group.tree, windowId);

  return container === null ? null : { container, groupId: group.id };
}

/** Placement requires a floating window. Masonry members also permit resizing. */
function getActiveGeometryWindowId<Kind extends string>(
  state: InfiniteCanvasState<Kind>,
  capability: InfiniteCanvasWindowCapability,
): string | null {
  const windowId = state.activeWindowId;

  if (windowId === null || !isUsableViewport(state.viewport)) {
    return null;
  }

  const window = findWindow(state, windowId);

  return window === null ||
    window.mode === "minimized" ||
    (isInfiniteCanvasWindowGrouped(state, windowId) &&
      (capability !== "resizable" ||
        getInfiniteCanvasMasonryMembership(state, windowId) === null)) ||
    !isInfiniteCanvasWindowCapable(window, capability)
    ? null
    : windowId;
}

function placeActiveWindow<Kind extends string>(
  state: InfiniteCanvasState<Kind>,
  command: Extract<InfiniteCanvasCommand, { type: "window.place" }>,
): InfiniteCanvasState<Kind> {
  const windowId = getActiveGeometryWindowId(state, "movable");
  const window = windowId === null ? null : findWindow(state, windowId);

  if (windowId === null || window === null) {
    return state;
  }

  // Placement requires a usable viewport.
  const bounds = getViewportInsetWorldRect(state.camera, state.viewport, 0);

  return updateWindowRect(
    state,
    windowId,
    getInfiniteCanvasWindowPlacementRect(bounds, command.region, window.rect, window.minSize),
  );
}

/** Resizes floating windows by pixels and masonry members by at least one cell. */
function resizeActiveWindow<Kind extends string>(
  state: InfiniteCanvasState<Kind>,
  command: Extract<InfiniteCanvasCommand, { type: "window.resize" }>,
): InfiniteCanvasState<Kind> {
  const windowId = getActiveGeometryWindowId(state, "resizable");
  const window = windowId === null ? null : findWindow(state, windowId);

  if (windowId === null || window === null) {
    return state;
  }

  const isHorizontal = command.direction === "left" || command.direction === "right";
  const isGrowing = command.direction === "right" || command.direction === "down";
  const grid = getInfiniteCanvasMasonryGrid(state, windowId);
  const cellStep =
    grid &&
    (isHorizontal
      ? calcGridColWidth(grid.params) + grid.params.margin[0]
      : grid.params.rowHeight + grid.params.margin[1]);
  const worldDelta = Math.max(command.amountPx / state.camera.zoom, cellStep ?? 0);
  const signedDelta = isGrowing ? worldDelta : -worldDelta;
  const rect = resizeRectFromHandle(
    window.rect,
    isHorizontal ? "east" : "south",
    { x: isHorizontal ? signedDelta : 0, y: isHorizontal ? 0 : signedDelta },
    grid === null ? window.minSize : { width: 0, height: 0 },
  );
  const resized =
    grid === null
      ? updateWindowRect(state, windowId, rect)
      : resizeInfiniteCanvasMasonryMember(state, windowId, rect, isHorizontal ? "e" : "s");
  return {
    ...resized,
    windows: resized.windows.map((item) =>
      item.id === windowId ? { ...item, heightMode: "manual" as const } : item,
    ),
  };
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
    case "view.pan":
    case "view.zoomBy":
    case "view.resetZoom":
      return "view";
    case "workspace.close":
    case "workspace.create":
    case "workspace.cycle":
    case "workspace.enter":
    case "workspace.showAll":
    case "workspace.moveActiveWindow":
    case "workspace.removeActiveWindow":
      return "canvas";
    case "view.fitSelection":
    case "selection.close":
    case "selection.minimize":
    case "selection.togglePinned":
    case "selection.extendDirection":
    case "selection.removeActive":
      return "selection";
    case "activeWindow.close":
    case "activeWindow.minimize":
    case "activeWindow.toggleMaximized":
    case "activeWindow.togglePinned":
    case "group.dissolve":
    case "group.equalizeChildren":
    case "group.resizePane":
    case "group.flipAxis":
    case "group.moveChild":
    case "group.setLayout":
    case "window.dockDirection":
    case "window.undock":
    case "window.align":
    case "window.distribute":
    case "window.pack":
    case "window.swap":
    case "window.focusDirection":
    case "window.reveal":
    case "window.nudge":
    case "window.place":
    case "window.resize":
      return "window";
  }
}

function getInfiniteCanvasContextualCommands<Kind extends string>(
  state: InfiniteCanvasState<Kind>,
  commandDescriptors: readonly InfiniteCanvasCommandDescriptor[] = DEFAULT_INFINITE_CANVAS_COMMAND_DESCRIPTORS,
  zoomPolicy: InfiniteCanvasZoomPolicy = DEFAULT_INFINITE_CANVAS_ZOOM,
  selectionBounds?: InfiniteCanvasRect | null,
): readonly InfiniteCanvasContextualCommand[] {
  return commandDescriptors.map((descriptor) => ({
    ...descriptor,
    enabled: isInfiniteCanvasCommandEnabled(state, descriptor.command, zoomPolicy, selectionBounds),
    group: getInfiniteCanvasCommandGroup(descriptor.command),
  }));
}

function getAvailableInfiniteCanvasContextualCommands<Kind extends string>(
  state: InfiniteCanvasState<Kind>,
  commandDescriptors: readonly InfiniteCanvasCommandDescriptor[] = DEFAULT_INFINITE_CANVAS_COMMAND_DESCRIPTORS,
  zoomPolicy: InfiniteCanvasZoomPolicy = DEFAULT_INFINITE_CANVAS_ZOOM,
  selectionBounds?: InfiniteCanvasRect | null,
) {
  return getInfiniteCanvasContextualCommands(
    state,
    commandDescriptors,
    zoomPolicy,
    selectionBounds,
  ).filter((command) => command.enabled);
}

function executeInfiniteCanvasCommand<Kind extends string>(
  state: InfiniteCanvasState<Kind>,
  command: InfiniteCanvasCommand,
  zoomPolicy: InfiniteCanvasZoomPolicy = DEFAULT_INFINITE_CANVAS_ZOOM,
  selectionBounds?: InfiniteCanvasRect | null,
): InfiniteCanvasState<Kind> {
  switch (command.type) {
    // One action keeps the bulk close in one undo entry.
    case "selection.minimize":
      return getInfiniteCanvasCapableSelection(state, "minimizable").reduce<
        InfiniteCanvasState<Kind>
      >(
        (current, windowId) =>
          detachInfiniteCanvasWindowFromGroups(minimizeWindow(current, windowId), windowId),
        state,
      );
    // Set one target state for the complete selection.
    case "selection.togglePinned": {
      const selected = getInfiniteCanvasCapableSelection(state, null);
      const shouldPin = selected.some((windowId) => findWindow(state, windowId)?.isPinned !== true);

      return selected.reduce<InfiniteCanvasState<Kind>>(
        (current, windowId) =>
          findWindow(current, windowId)?.isPinned === shouldPin
            ? current
            : toggleWindowPinned(current, windowId),
        state,
      );
    }
    case "selection.close":
      return clearSelection(
        getInfiniteCanvasCapableSelection(state, "closable").reduce<InfiniteCanvasState<Kind>>(
          (current, windowId) =>
            detachInfiniteCanvasWindowFromWorkspaces(
              detachInfiniteCanvasWindowFromGroups(closeWindow(current, windowId), windowId),
              windowId,
            ),
          state,
        ),
      );
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
        selectionBounds,
      );
    case "view.navigate":
      return navigateCamera(state, command.request, zoomPolicy, selectionBounds);
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
      return focusWindowInDirection(state, command.direction, zoomPolicy, "replace");
    case "selection.extendDirection":
      return focusWindowInDirection(state, command.direction, zoomPolicy, "extend");
    case "workspace.cycle":
      return activateInfiniteCanvasWorkspace(
        state,
        getNextInfiniteCanvasWorkspaceId(state, command.direction),
      );
    case "workspace.showAll":
      return activateInfiniteCanvasWorkspace(state, null);
    // Create and activate the workspace in one command.
    case "workspace.create":
      return activateInfiniteCanvasWorkspace(
        createInfiniteCanvasWorkspace(state, {
          title: command.title,
          workspaceId: command.workspaceId,
        }),
        command.workspaceId,
      );
    case "workspace.enter":
      return activateInfiniteCanvasWorkspace(state, command.workspaceId);
    case "workspace.close":
      return closeInfiniteCanvasWorkspace(state, command.workspaceId);
    case "window.reveal":
      return revealWindow(state, command.windowId, zoomPolicy);
    // Apply a membership delta to preserve concurrent additions.
    case "workspace.removeActiveWindow":
      return state.activeWorkspaceId === null || state.activeWindowId === null
        ? state
        : removeInfiniteCanvasWindowFromWorkspace(state, {
            windowId: state.activeWindowId,
            workspaceId: state.activeWorkspaceId,
          });
    case "workspace.moveActiveWindow":
      return state.activeWindowId === null
        ? state
        : moveInfiniteCanvasWindowsToWorkspace(state, {
            windowIds: [state.activeWindowId],
            workspaceId: command.workspaceId,
          });
    // Removing the active window also selects the prior anchor.
    case "selection.removeActive":
      return state.activeWindowId === null ? state : removeSelection(state, [state.activeWindowId]);
    case "activeWindow.close":
    case "activeWindow.minimize":
    case "activeWindow.toggleMaximized":
    case "activeWindow.togglePinned": {
      const windowId = state.activeWindowId;
      const active = windowId === null ? null : findWindow(state, windowId);

      if (windowId === null || active === null) {
        return state;
      }

      return applyInfiniteCanvasWindowLifecycle(state, command.type, windowId, active.mode);
    }
    case "view.pan":
      return {
        ...state,
        camera: panCameraByScreenDelta(
          state.camera,
          getDirectionalScreenDelta(command.direction, command.amountPx),
        ),
      };
    // Convert the zoom factor to an absolute center-anchored zoom.
    case "view.zoomBy":
      return {
        ...state,
        camera: zoomCameraAtScreenPoint(
          state.camera,
          state.viewport,
          getViewportCentre(state.viewport),
          state.camera.zoom * command.factor,
          zoomPolicy,
        ),
      };
    case "group.resizePane": {
      const seam = resolveInfiniteCanvasPaneSeam(state);

      if (seam === null) {
        return state;
      }

      // Convert screen travel to the world units used by group layout.
      const weights = getInfiniteCanvasGroupGutterWeights(seam.container, seam.gutter, {
        availableExtent: seam.gutter.availableExtent,
        delta: (command.amountPx * seam.grows) / state.camera.zoom,
      });

      return Object.keys(weights).length === 0
        ? state
        : setInfiniteCanvasGroupChildWeightsInState(state, {
            containerId: seam.gutter.containerId,
            groupId: seam.groupId,
            weights,
          });
    }
    case "group.dissolve": {
      const group =
        state.activeWindowId === null
          ? null
          : getInfiniteCanvasWindowGroup(state, state.activeWindowId);

      return group === null ? state : closeInfiniteCanvasGroup(state, group.id);
    }
    case "group.moveChild": {
      const index = getActiveInfiniteCanvasGroupChildIndex(state);

      return index === null
        ? state
        : reorderInfiniteCanvasGroupChildInState(state, {
            childId: index.childId,
            groupId: index.groupId,
            toIndex: command.toward === "start" ? index.at - 1 : index.at + 1,
          });
    }
    case "group.equalizeChildren":
      return equalizeActiveInfiniteCanvasGroupContainer(state);
    case "group.setLayout": {
      const active = getActiveInfiniteCanvasGroupContainer(state);

      return active === null
        ? state
        : setInfiniteCanvasGroupLayoutModeInState(state, {
            containerId: active.container.id,
            groupId: active.groupId,
            layout: command.layout,
          });
    }
    case "group.flipAxis": {
      const active = getActiveInfiniteCanvasGroupContainer(state);

      return active === null
        ? state
        : setInfiniteCanvasGroupAxisInState(state, {
            axis: active.container.axis === "horizontal" ? "vertical" : "horizontal",
            containerId: active.container.id,
            groupId: active.groupId,
          });
    }
    case "window.dockDirection": {
      const preview = resolveInfiniteCanvasDirectionalDock(state, command.direction);

      return preview === null ? state : applyInfiniteCanvasDockPreview(state, preview);
    }
    // Place command tear-outs. Pointer drags already supply their rect.
    case "window.undock": {
      if (state.activeWindowId === null) {
        return state;
      }

      const freed = findWindow(state, state.activeWindowId);

      if (freed === null || freed === undefined) {
        return state;
      }

      const shell = getInfiniteCanvasWindowGroup(state, freed.id);
      // Exclude an empty shell from placement obstacles.
      const emptiedShellId =
        shell !== null && getInfiniteCanvasGroupWindowIds(shell.tree).length === 1
          ? shell.id
          : null;

      return undockInfiniteCanvasWindowFromGroup(state, {
        rect: getInfiniteCanvasVacantRect({
          bounds: getInfiniteCanvasRoomAround(shell?.rect ?? freed.rect),
          occupied: [
            ...state.groups
              .filter((group) => group.id !== emptiedShellId)
              .map((group) => group.rect),
            ...state.windows
              .filter((window) => window.mode !== "minimized" && window.id !== freed.id)
              .map((window) => window.rect),
          ],
          preferred: freed.rect,
        }),
        windowId: state.activeWindowId,
      });
    }
    case "window.align":
    case "window.distribute":
    case "window.pack":
    case "window.swap":
      return arrangeSelectedWindows(state, command);
    case "window.nudge":
      return nudgeSelectedWindows(state, command);
    case "window.place":
      return placeActiveWindow(state, command);
    case "window.resize":
      return resizeActiveWindow(state, command);
    default:
      return assertUnknownInfiniteCanvasCommand(command);
  }
}

/** Throws an error that names an unknown command type. */
function assertUnknownInfiniteCanvasCommand(command: never): never {
  throw new Error(
    `Unknown infinite canvas command type: ${String((command as { type?: unknown }).type)}`,
  );
}

function getInfiniteCanvasHotkeyBindings(
  commandDescriptors: readonly InfiniteCanvasCommandDescriptor[] = DEFAULT_INFINITE_CANVAS_COMMAND_DESCRIPTORS,
) {
  return commandDescriptors.flatMap((descriptor) =>
    descriptor.hotkeys.map((hotkey): InfiniteCanvasHotkeyBinding => ({
      command: descriptor.command,
      description: descriptor.description,
      hotkey,
      id: descriptor.id,
      label: descriptor.label,
    })),
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
