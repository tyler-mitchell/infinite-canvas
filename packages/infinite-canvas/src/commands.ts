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
  getInfiniteCanvasGroupParent,
  type InfiniteCanvasGroupContainerNode,
  type InfiniteCanvasGroupDockEdge,
} from "./group-tree";
import {
  applyInfiniteCanvasDockPreview,
  closeInfiniteCanvasGroup,
  detachInfiniteCanvasWindowFromGroups,
  equalizeInfiniteCanvasGroupChildrenInState,
  findInfiniteCanvasGroup,
  getInfiniteCanvasWindowGroup,
  isInfiniteCanvasWindowGrouped,
  reorderInfiniteCanvasGroupChildInState,
  resolveInfiniteCanvasDockPreviewForTarget,
  setInfiniteCanvasGroupAxisInState,
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
  clearSelection,
  getSelectableWindowIds,
  hasInfiniteCanvasSelection,
  getSelectedWindowBounds,
  getVisibleWindowBounds,
  isWindowSelected,
  selectAllVisibleWindows,
} from "./selection";
import {
  closeWindow,
  findWindow,
  focusWindow,
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
  InfiniteCanvasWindowMode,
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
  // Docking without a pointer. Every group gesture was drag-only until 2026-08-12, which made
  // the library's largest feature unreachable by keyboard — an accessibility failure, not just
  // a missing convenience. These carry no default chords for the same reason the arrange verbs
  // do not: the unclaimed chord space is nearly exhausted, and a consumer knows better than we
  // do whether docking deserves four of it.
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
  // Window lifecycle. Until 2026-08-12 these lived only as four `onClick` handlers on the
  // chrome buttons in `frame-slots.tsx`, so they were absent from the one registry that is
  // supposed to be the whole vocabulary. The buttons are real `<button>`s with labels, so this
  // was never a keyboard-reachability failure — it was an authority failure, with three
  // consequences: `getInfiniteCanvasHotkeyBindings` derives strictly from descriptors, so a
  // consumer could not bind a chord to "close" even if they wanted one; no palette could list
  // them; and a consumer who replaces the header slot — the entire point of the slot API — lost
  // the capability unless they reached past the commands to the raw actions facade.
  //
  // `activeWindow.*` rather than `window.*` for two reasons. `window.close` and
  // `window.togglePinned` are already *action* types, and actions and commands are otherwise
  // disjoint sets; two switches over identical strings meaning different things is the kind of
  // trap that costs a later reader an hour. And the namespace states the target, which the
  // existing `window.*` family leaves ambiguous — `window.align` acts on the selection while
  // `window.focusDirection` acts on the active window, and nothing in either name says so.
  //
  // These act on the ACTIVE window, not the selection, because the actions beneath them take a
  // single id: closing a selection of five would be five dispatches and five undo entries.
  //
  // No default chords. `Mod+W` is the browser's tab-close and is not page-cancellable, which is
  // the exact family the `Mod+0` post-mortem below is about.
  {
    command: { type: "activeWindow.close" },
    description: "Close the active window.",
    hotkeys: [],
    id: "activeWindow.close",
    label: "Close Window",
  },
  {
    command: { type: "activeWindow.minimize" },
    description: "Collapse the active window into the dock.",
    hotkeys: [],
    id: "activeWindow.minimize",
    label: "Minimize Window",
  },
  {
    command: { type: "activeWindow.toggleMaximized" },
    description:
      "Maximize the active window to fill the viewport, or restore it to the size it had before.",
    hotkeys: [],
    id: "activeWindow.toggleMaximized",
    label: "Maximize / Restore Window",
  },
  {
    command: { type: "activeWindow.togglePinned" },
    description: "Pin the active window so panning and fit-all leave it in place, or unpin it.",
    hotkeys: [],
    id: "activeWindow.togglePinned",
    label: "Pin / Unpin Window",
  },
  // Shape verbs. `setInfiniteCanvasGroupLayoutMode` was reachable only through the actions
  // facade and `setInfiniteCanvasGroupAxis` was reachable by nothing at all — dead code since
  // it was written. A user could dock windows into a split and then never change what that
  // split was, which is half of what a tiling layout is for.
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
    command: { type: "group.dissolve" },
    description:
      "Break up the group holding the active window, leaving every member floating where it was drawn.",
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
    description:
      "Swap the two selected windows, each keeping its own size. Centres are exchanged rather than corners, so windows of different sizes visibly trade places.",
    hotkeys: [],
    id: "window.swap",
    label: "Swap Windows",
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
/**
 * The edge a keyboard dock lands on: the side the window arrives from, which is the
 * *opposite* of the direction it travels. Sending a window right, into the neighbour on its
 * right, puts it on that neighbour's west edge — the same result as dragging it onto that
 * neighbour's left half, so the two gestures agree about what "dock right" means.
 */
const INFINITE_CANVAS_ARRIVAL_EDGE = {
  down: "north",
  left: "east",
  right: "west",
  up: "south",
} as const satisfies Readonly<Record<InfiniteCanvasDirection, InfiniteCanvasGroupDockEdge>>;

/**
 * Resolve a keyboard dock to the same preview a drop would produce.
 *
 * Target selection reuses directional focus, so "dock left" reaches exactly the window
 * "focus left" would — one notion of which window is to your left, rather than a second one
 * that could disagree with the first.
 */
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

/**
 * The lifecycle verbs, in one place.
 *
 * `toggleMaximized` is the reason this exists rather than four inline cases: the rule that a
 * maximized window restores and any other window maximizes was written inside the chrome
 * button in `frame-slots.tsx`, so every consumer replacing the header had to rediscover it.
 * It lives here now, and the button can read it back out.
 */
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
    case "activeWindow.close":
      return detachInfiniteCanvasWindowFromGroups(closeWindow(state, windowId), windowId);
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

/** Where the active window sits in its container's order, and how many siblings it has. */
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

function arrangeSelectedWindows<Kind extends string>(
  state: InfiniteCanvasState<Kind>,
  command: Extract<
    InfiniteCanvasCommand,
    { type: "window.align" | "window.distribute" | "window.swap" }
  >,
) {
  const targets = getArrangeableWindows(state);
  const rects = targets.map((window) => window.rect);
  const arranged =
    command.type === "window.align"
      ? getInfiniteCanvasAlignedRects(rects, command.alignment)
      : command.type === "window.swap"
        ? getInfiniteCanvasSwappedRects(rects)
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
    // Enabled only where it can change something: a container with at least two panes
    // that are not already equal. Offering it on an untouched split would present a verb
    // that appears to do nothing.
    // Asking the resolver is how the enabled state and the result stay in agreement: the
    // command is offered exactly when a dock would actually land somewhere.
    case "window.dockDirection":
      return resolveInfiniteCanvasDirectionalDock(state, command.direction) !== null;
    case "window.undock":
      return (
        state.activeWindowId !== null && isInfiniteCanvasWindowGrouped(state, state.activeWindowId)
      );
    // A lifecycle verb needs something to act on and nothing more: every one of them is
    // meaningful in any mode the active window can actually be in. `restore` is deliberately
    // absent from this family — minimizing hands `activeWindowId` to the next visible window,
    // so a restore keyed to the active window could never be enabled. Bringing a minimized
    // window back is a "which one?" choice, and belongs to the presence surface.
    case "activeWindow.close":
    case "activeWindow.minimize":
    case "activeWindow.toggleMaximized":
    case "activeWindow.togglePinned":
      return state.activeWindowId !== null && findWindow(state, state.activeWindowId) !== null;
    case "group.dissolve":
      return (
        state.activeWindowId !== null && isInfiniteCanvasWindowGrouped(state, state.activeWindowId)
      );
    // Clamped rather than wrapping: a pane at the end that jumped to the front would read as
    // a bug, and the drag this mirrors cannot wrap either. So the ends are simply not offered.
    case "group.moveChild": {
      const index = getActiveInfiniteCanvasGroupChildIndex(state);

      if (index === null) {
        return false;
      }

      return command.toward === "start" ? index.at > 0 : index.at < index.count - 1;
    }
    // Offered only where it would change something, the same rule equalize follows.
    case "group.setLayout": {
      const active = getActiveInfiniteCanvasGroupContainer(state);

      return active !== null && active.container.layout !== command.layout;
    }
    // Axis partitions a split and stacks an accordion; a tab strip always lays out
    // horizontally whatever its container's axis says, so flipping one is invisible.
    case "group.flipAxis": {
      const active = getActiveInfiniteCanvasGroupContainer(state);

      return (
        active !== null &&
        active.container.children.length > 1 &&
        active.container.layout !== "tabs"
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
    case "window.swap": {
      const rects = getArrangeableWindows(state).map((window) => window.rect);
      const arranged =
        command.type === "window.align"
          ? getInfiniteCanvasAlignedRects(rects, command.alignment)
          : command.type === "window.swap"
            ? getInfiniteCanvasSwappedRects(rects)
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
/**
 * The container whose panes the active window shares — its immediate parent in the tree,
 * not the root. Equalizing the row you are looking at is the predictable reading of the
 * verb; balancing every container in the group at once is a different, coarser gesture and
 * would belong to its own command.
 */
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
    case "activeWindow.close":
    case "activeWindow.minimize":
    case "activeWindow.toggleMaximized":
    case "activeWindow.togglePinned":
    case "group.dissolve":
    case "group.equalizeChildren":
    case "group.flipAxis":
    case "group.moveChild":
    case "group.setLayout":
    case "window.dockDirection":
    case "window.undock":
    case "window.align":
    case "window.distribute":
    case "window.swap":
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
    // The reducer's lifecycle cases detach the window from its group before acting — a pane
    // that closes or maximizes cannot keep occupying a layout slot. Calling the same helpers
    // in the same order is what keeps that true here rather than only there.
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
    case "group.dissolve": {
      const group =
        state.activeWindowId === null
          ? null
          : getInfiniteCanvasWindowGroup(state, state.activeWindowId);

      // Members keep the rect the solver last gave them, so a split comes apart exactly where
      // it was drawn. Tab and accordion members all carry the shell's content rect — the rect
      // they would occupy if revealed — so those land stacked. That is `closeInfiniteCanvasGroup`
      // as it has always behaved, exposed rather than changed.
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
    case "window.undock":
      return state.activeWindowId === null
        ? state
        : undockInfiniteCanvasWindowFromGroup(state, { windowId: state.activeWindowId });
    case "window.align":
    case "window.distribute":
    case "window.swap":
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
