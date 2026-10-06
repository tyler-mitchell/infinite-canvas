import {
  isCameraNavigationAvailable,
  navigateCamera,
  navigateCameraToWindow,
  revealDocumentChange,
} from "./camera-navigation";
import { DEFAULT_INFINITE_CANVAS_ZOOM, resolveInfiniteCanvasViewportInsets } from "./constants";
import type { undoRedo } from "@legendapp/state/helpers/undoRedo";
import { createInfiniteCanvasState, reconcileInfiniteCanvasState } from "./factory";
import {
  closeInfiniteCanvasConnection,
  openInfiniteCanvasConnection,
  updateInfiniteCanvasConnection,
} from "./connection";
import { applyInfiniteCanvasRecipe } from "./recipes";
import {
  beginCanvasPan,
  beginInfiniteCanvasGroupGutterDrag,
  beginInfiniteCanvasGroupResize,
  beginMarqueeSelection,
  beginMove,
  beginWindowResize,
  finishCanvasInteraction,
  reconcileInfiniteCanvasInteraction,
  stepCanvasInteraction,
} from "./interaction";
import { getInfiniteCanvasMovableSelection, moveInfiniteCanvasTargets } from "./movement";
import {
  getInfiniteCanvasContentWorldRect,
  getViewportInsetWorldRect,
  isUsableViewport,
  panCameraByScreenDelta,
  resizeRectFromHandle,
  zoomCameraAtScreenPoint,
} from "./geometry";
import {
  getInfiniteCanvasGroupGutterWeights,
  getInfiniteCanvasGroupLayout,
  resolveInfiniteCanvasGroupMetrics,
} from "./layout";
import {
  getCanvasLayout,
  getTargetBounds,
  layoutDefinitions,
  getVisibleWindowBounds,
} from "./layout";
import {
  getInfiniteCanvasGroupParent,
  findInfiniteCanvasGroupNode,
  getInfiniteCanvasGroupWindowIds,
  type InfiniteCanvasGroupContainerNode,
  type InfiniteCanvasGroupDockEdge,
} from "./group-tree";
import {
  applyInfiniteCanvasDockPreview,
  closeInfiniteCanvasGroup,
  createInfiniteCanvasGroup,
  dockInfiniteCanvasWindowIntoGroup,
  renameInfiniteCanvasGroup,
  setInfiniteCanvasGroupActiveChildInState,
  setInfiniteCanvasGroupWindowNodeLayoutsInState,
  setInfiniteCanvasWindowContentHeight,
  setInfiniteCanvasGroupRect,
  getInfiniteCanvasRoomAround,
  findInfiniteCanvasGroup,
  getInfiniteCanvasWindowGroup,
  getInfiniteCanvasGroupableWindowIds,
  getWindowLayoutMembership,
  getWindowLayoutContext,
  isInfiniteCanvasWindowGrouped,
  reorderInfiniteCanvasGroupChildInState,
  resizeLayoutMember,
  resolveInfiniteCanvasDockPreviewForTarget,
  revealInfiniteCanvasGroupWindow,
  setInfiniteCanvasGroupAxisInState,
  setInfiniteCanvasGroupChildWeightsInState,
  setInfiniteCanvasGroupLayoutModeInState,
  setInfiniteCanvasGroupBounds,
  undockInfiniteCanvasWindowFromGroup,
} from "./group-state";
import {
  getSelectableWindowIds,
  getSelectedWindowIds,
  updateSelection,
  isSelectionTargetSelected,
} from "./selection";
import {
  findWindow,
  openWindow,
  renameWindow,
  focusWindow,
  focusWindowPreservingSelection,
  toggleWindowPinned,
  updateWindowRect,
} from "./stacking";
import { commandInputs } from "./schema";
import { getComponentActionDescriptors, resolveComponentAction } from "./component-actions";
import type { InfiniteCanvasWindowDefinition } from "./types";
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
  getInfiniteCanvasPlacedWindowRect,
} from "./window-placement";
import {
  activateInfiniteCanvasWorkspace,
  addInfiniteCanvasWindowToWorkspace,
  renameInfiniteCanvasWorkspace,
  reorderInfiniteCanvasWorkspace,
  setInfiniteCanvasWorkspaceWindows,
  closeInfiniteCanvasWorkspace,
  createInfiniteCanvasWorkspace,
  findInfiniteCanvasWorkspace,
  isInfiniteCanvasWindowInActiveWorkspace,
  moveInfiniteCanvasWindowsToWorkspace,
  removeInfiniteCanvasWindowFromWorkspace,
} from "./workspace";
import type {
  InfiniteCanvasAction,
  InfiniteCanvasActionInput,
  DocumentContent,
  InfiniteCanvasSnapPolicy,
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
  InfiniteCanvasZoomPolicy,
} from "./types";
import { isInfiniteCanvasWindowCapable } from "./window-capabilities";
import { getInfiniteCanvasSelectionBounds } from "./spatial-target";
type InfiniteCanvasReducerOptions<Kind extends string = string> = Readonly<{
  windowDefinitions?: Readonly<
    Record<string, Pick<InfiniteCanvasWindowDefinition, "schema" | "actions">>
  >;
  history?: ReturnType<typeof undoRedo<DocumentContent<Kind>>>;
  content?: DocumentContent<Kind>;
  getState?: () => InfiniteCanvasState<Kind>;
  initialState?: InfiniteCanvasState<Kind>;
  snapPolicy?: InfiniteCanvasSnapPolicy;
  selectionBounds?: InfiniteCanvasRect | null;
  zoomPolicy?: InfiniteCanvasZoomPolicy;
}>;

/** Nudge moves a docked shell. Arrange commands skip docked panes. */
const NUDGE_GROUP_RULE =
  "A docked window moves its whole group, which moves once however many of its panes are selected.";
const ARRANGE_GROUP_RULE = "Docked windows are skipped; only floating ones move.";

const directions = [
  { direction: "left", key: "ArrowLeft", label: "Left", position: "to the left of" },
  { direction: "right", key: "ArrowRight", label: "Right", position: "to the right of" },
  { direction: "up", key: "ArrowUp", label: "Up", position: "above" },
  { direction: "down", key: "ArrowDown", label: "Down", position: "below" },
] as const;

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
      ? focusWindowPreservingSelection(
          updateSelection(state, {
            mode: "add",
            targets: [{ type: "window", id: targetWindowId }],
          }),
          targetWindowId,
        )
      : focusWindow(state, targetWindowId);
  const target = findWindow(focused, targetWindowId);
  const targetRect = getTargetBounds({
    state: focused,
    target: { id: targetWindowId, type: "window" },
  });

  if (
    target === null ||
    targetRect === null ||
    isInfiniteCanvasWindowFullyVisible(focused, targetRect)
  ) {
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
    findWindow(host, windowId)?.mode === "minimized"
      ? applyAction({
          currentState: host,
          type: "window.restore",
          windowId,
          options: { zoomPolicy },
        })
      : host;
  // Reveal all ancestor containers before focus.
  const shown = revealInfiniteCanvasGroupWindow(restored, windowId);
  const focused = focusWindow(shown, windowId);
  const target = findWindow(focused, windowId);
  const targetRect = getTargetBounds({ state: focused, target: { id: windowId, type: "window" } });

  // A window already in full view needs no camera move, the way directional focus treats it.
  if (
    target !== null &&
    targetRect !== null &&
    isInfiniteCanvasWindowFullyVisible(focused, targetRect)
  ) {
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
  const targets = getInfiniteCanvasMovableSelection(state);
  if (targets.length === 0) return state;

  const screenDelta = getDirectionalScreenDelta(command.direction, command.amountPx);
  const worldDelta = {
    x: screenDelta.x / state.camera.zoom,
    y: screenDelta.y / state.camera.zoom,
  };
  return targets.reduce((currentState, origin) => {
    const layoutContext =
      origin.target.type === "window"
        ? getWindowLayoutContext(currentState, origin.target.id)
        : null;
    const step = layoutContext?.operations.step?.(layoutContext);
    const delta =
      step === undefined
        ? worldDelta
        : getDirectionalScreenDelta(
            command.direction,
            step[
              command.direction === "left" || command.direction === "right" ? "width" : "height"
            ],
          );
    return moveInfiniteCanvasTargets({ state: currentState, origins: [origin], delta });
  }, state);
}

/** Returns selected floating windows that an arrange command can move. */
function getArrangeableWindows<Kind extends string>(state: InfiniteCanvasState<Kind>) {
  return state.windows.filter(
    (window) =>
      window.mode !== "minimized" &&
      isSelectionTargetSelected(state.selection, { type: "window", id: window.id }) &&
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
  const windowId = getCommandWindowId(state);

  if (windowId === null) {
    return null;
  }

  const targetId = getInfiniteCanvasDirectionalFocusTarget(
    { ...state, activeWindowId: windowId },
    direction,
  );

  return targetId === null
    ? null
    : resolveInfiniteCanvasDockPreviewForTarget(state, {
        edge: INFINITE_CANVAS_ARRIVAL_EDGE[direction],
        targetId,
        windowId,
      });
}

/** Returns selected windows that satisfy a bulk command capability. */
function getInfiniteCanvasCapableSelection<Kind extends string>(
  state: InfiniteCanvasState<Kind>,
  capability: InfiniteCanvasWindowCapability | null,
): readonly string[] {
  return getSelectedWindowIds(state.selection).filter((windowId) => {
    const window = findWindow(state, windowId);

    return (
      window !== null && (capability === null || isInfiniteCanvasWindowCapable(window, capability))
    );
  });
}

/** Selects the adjacent gutter and direction that grows the active pane. */
function resolveInfiniteCanvasPaneSeam<Kind extends string>(state: InfiniteCanvasState<Kind>) {
  const active = getActiveInfiniteCanvasGroupContainer(state);
  const windowId = getCommandWindowId(state);

  if (active === null || windowId === null) {
    return null;
  }

  const group = findInfiniteCanvasGroup(state, active.groupId);

  if (group === null) {
    return null;
  }

  const { gutters } = getInfiniteCanvasGroupLayout(
    group.tree,
    group.rect,
    state.groupMetrics,
    state.viewport,
  );
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
  const childId = getCommandWindowId(state);

  if (active === null || childId === null) {
    return null;
  }

  const at = active.container.children.findIndex((child) => child.id === childId);

  return at === -1
    ? null
    : { at, childId, count: active.container.children.length, groupId: active.groupId };
}

function resolveGroupEqualization({
  currentState,
  groupId,
  containerId,
}: InfiniteCanvasCommandHandlerInput<"group.equalizeChildren">) {
  if (groupId === undefined) return getActiveInfiniteCanvasGroupContainer(currentState);
  const group = findInfiniteCanvasGroup(currentState, groupId);
  if (group === null) return null;
  const container = findInfiniteCanvasGroupNode(group.tree, containerId ?? group.tree.id);
  return container?.kind === "container" ? { container, groupId } : null;
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
  const canvasLayout = getCanvasLayout(state);
  const targetRects = targets.map((window) => canvasLayout.windowRects.get(window.id)!);
  const arranged = getArrangedRects(state, targetRects, command);
  const rectByWindowId = new Map(
    targets.map((window, index) => [window.id, arranged[index] ?? targetRects[index]!]),
  );

  return {
    ...state,
    windows: state.windows.map((window) => {
      const rect = rectByWindowId.get(window.id);

      return rect === undefined ? window : { ...window, rect };
    }),
  };
}

function isWindowArrangementAvailable({
  currentState,
  ...command
}: InfiniteCanvasCommandHandlerInput<InfiniteCanvasArrangeCommand["type"]>) {
  const rects = getArrangeableWindows(currentState).map((window) => window.rect);
  return getArrangedRects(currentState, rects, command) !== rects;
}

/** Tests command availability with the same zoom policy that execution uses. */
function isInfiniteCanvasCommandEnabled<
  Kind extends string,
  Type extends InfiniteCanvasCommand["type"],
>(
  state: InfiniteCanvasState<Kind>,
  command: CommandInput<Type>,
  zoomPolicy: InfiniteCanvasZoomPolicy = DEFAULT_INFINITE_CANVAS_ZOOM,
  selectionBounds?: InfiniteCanvasRect | null,
  history?: InfiniteCanvasReducerOptions<Kind>["history"],
  windowDefinitions?: InfiniteCanvasReducerOptions<Kind>["windowDefinitions"],
) {
  if (!Object.hasOwn(commandDefinitions, command.type)) return false;
  const definition = (commandDefinitions as CommandDefinitions)[command.type];
  return (
    definition.schema?.allows(command) !== false &&
    definition.available?.({
      ...command,
      currentState: state,
      options: { zoomPolicy, selectionBounds, history, windowDefinitions },
    }) !== false
  );
}

function getCommandWindowId<Kind extends string>(state: InfiniteCanvasState<Kind>): string | null {
  if (state.selection.targets.some((target) => target.type !== "window")) return null;
  const ids = getSelectedWindowIds(state.selection);
  if (ids.length === 1) return ids[0]!;
  return ids.length === 0 || (state.activeWindowId !== null && ids.includes(state.activeWindowId))
    ? state.activeWindowId
    : null;
}

function getSelectedGroup<Kind extends string>(state: InfiniteCanvasState<Kind>) {
  const targets = state.selection.targets.filter((target) => target.type !== "window");
  const [target] = targets;
  if (
    targets.length === 1 &&
    target?.type === "group" &&
    getSelectedWindowIds(state.selection).length === 0
  ) {
    return findInfiniteCanvasGroup(state, target.id);
  }
  if (targets.length > 0) return null;
  const windowId = getSelectedWindowIds(state.selection)[0] ?? state.activeWindowId;
  if (windowId === null) return null;
  const group = getInfiniteCanvasWindowGroup(state, windowId);
  return group !== null &&
    getSelectedWindowIds(state.selection).every(
      (id) => getInfiniteCanvasWindowGroup(state, id)?.id === group.id,
    )
    ? group
    : null;
}

/** Returns the immediate container shared by the selected windows or group. */
function getActiveInfiniteCanvasGroupContainer<Kind extends string>(
  state: InfiniteCanvasState<Kind>,
): Readonly<{ container: InfiniteCanvasGroupContainerNode; groupId: string }> | null {
  const group = getSelectedGroup(state);
  if (group === null) return null;
  if (state.selection.targets.some((target) => target.type === "group")) {
    return group?.tree.kind === "container" ? { container: group.tree, groupId: group.id } : null;
  }
  const [selectedWindowId] = getSelectedWindowIds(state.selection);
  const windowId = selectedWindowId ?? state.activeWindowId;

  if (windowId === null) {
    return null;
  }

  const container = getInfiniteCanvasGroupParent(group.tree, windowId);
  if (
    getSelectedWindowIds(state.selection).some(
      (id) => getInfiniteCanvasGroupParent(group.tree, id)?.id !== container?.id,
    )
  )
    return null;
  return container === null ? null : { container, groupId: group.id };
}

/** Placement requires a floating window. Masonry members also permit resizing. */
function getActiveGeometryWindowId<Kind extends string>(
  state: InfiniteCanvasState<Kind>,
  capability: InfiniteCanvasWindowCapability,
): string | null {
  const windowId = getCommandWindowId(state);

  if (windowId === null || !isUsableViewport(state.viewport)) {
    return null;
  }

  const window = findWindow(state, windowId);

  return window === null ||
    window.mode === "minimized" ||
    (isInfiniteCanvasWindowGrouped(state, windowId) &&
      (capability !== "resizable" ||
        getWindowLayoutMembership(state, windowId)?.operations?.resize === undefined)) ||
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

  if (windowId === null) {
    return state;
  }

  const window = findWindow(state, windowId);
  const bounds = getTargetBounds({ state, target: { id: windowId, type: "window" } });

  if (window === null || bounds === null) {
    return state;
  }

  const isHorizontal = command.direction === "left" || command.direction === "right";
  const isGrowing = command.direction === "right" || command.direction === "down";
  const layoutContext = getWindowLayoutContext(state, windowId);
  const step = layoutContext?.operations.step?.(layoutContext);
  const cellStep = step?.[isHorizontal ? "width" : "height"] ?? 0;
  const worldDelta = Math.max(command.amountPx / state.camera.zoom, cellStep ?? 0);
  const signedDelta = isGrowing ? worldDelta : -worldDelta;
  const rect = resizeRectFromHandle(
    bounds,
    isHorizontal ? "east" : "south",
    { x: isHorizontal ? signedDelta : 0, y: isHorizontal ? 0 : signedDelta },
    layoutContext === null ? window.minSize : { width: 0, height: 0 },
    window.aspectRatio,
  );
  const resized =
    layoutContext === null
      ? updateWindowRect(state, windowId, rect)
      : resizeLayoutMember(state, windowId, rect, isHorizontal ? "east" : "south");
  return {
    ...resized,
    windows: resized.windows.map((item) =>
      item.id === windowId ? { ...item, heightMode: "manual" as const } : item,
    ),
  };
}

function getInfiniteCanvasCommandGroup(command: InfiniteCanvasCommand): InfiniteCanvasCommandGroup {
  return commandDefinitions[command.type].group ?? "canvas";
}

function getInfiniteCanvasContextualCommands<Kind extends string>(
  state: InfiniteCanvasState<Kind>,
  commandDescriptors: readonly InfiniteCanvasCommandDescriptor[] = DEFAULT_INFINITE_CANVAS_COMMAND_DESCRIPTORS,
  zoomPolicy: InfiniteCanvasZoomPolicy = DEFAULT_INFINITE_CANVAS_ZOOM,
  selectionBounds?: InfiniteCanvasRect | null,
  history?: InfiniteCanvasReducerOptions<Kind>["history"],
  windowDefinitions?: InfiniteCanvasReducerOptions<Kind>["windowDefinitions"],
): readonly InfiniteCanvasContextualCommand[] {
  return [
    ...commandDescriptors,
    ...getComponentActionDescriptors({ state, windowDefinitions: windowDefinitions ?? {} }),
  ].map((descriptor) => ({
    ...descriptor,
    enabled: isInfiniteCanvasCommandEnabled(
      state,
      descriptor.command,
      zoomPolicy,
      selectionBounds,
      history,
      windowDefinitions,
    ),
    group: commandDefinitions[descriptor.command.type].group ?? "canvas",
  }));
}

type CommandInput<Type extends InfiniteCanvasCommand["type"]> = {
  [CommandType in Type]: Omit<Extract<InfiniteCanvasCommand, { type: CommandType }>, "type"> &
    Readonly<{
      type: CommandType;
    }>;
}[Type];

type InfiniteCanvasCommandHandlerInput<
  Type extends InfiniteCanvasAction["type"],
  Kind extends string = string,
> = {
  [CommandType in Type]: InfiniteCanvasActionInput<CommandType, Kind> &
    Readonly<{
      options: InfiniteCanvasReducerOptions<Kind>;
    }>;
}[Type];

type CommandDefinitions = {
  readonly [Type in InfiniteCanvasAction["type"]]: Readonly<{
    schema?: import("arktype").Type;
    variants?: readonly Readonly<{
      id: string;
      label: string;
      description: string;
      hotkeys: readonly InfiniteCanvasHotkeyBinding["hotkey"][];
      input: Omit<Extract<InfiniteCanvasAction, { type: Type }>, "type">;
    }>[];
    group?: InfiniteCanvasCommandGroup;
    available?: (input: InfiniteCanvasCommandHandlerInput<Type>) => boolean;
    execute: (input: InfiniteCanvasCommandHandlerInput<Type>) => InfiniteCanvasState;
  }>;
};

const commandDefinitions = {
  "selection.set": {
    schema: commandInputs["selection.set"],
    group: "selection",
    execute: ({ currentState, selection }) =>
      updateSelection(currentState, { mode: "replace", ...selection }),
  },
  "component.action": {
    schema: commandInputs["component.action"],
    group: "component",
    available: ({ currentState: state, options, actionId, windowIds }) =>
      !(
        resolveComponentAction({
          state,
          windowDefinitions: options.windowDefinitions,
          actionId,
          windowIds,
        }) instanceof Error
      ),
    execute: ({ currentState: state, options, actionId, windowIds }) => {
      const next = resolveComponentAction({
        state,
        windowDefinitions: options.windowDefinitions,
        actionId,
        windowIds,
      });
      return next instanceof Error ? state : next;
    },
  },
  "selection.group": {
    schema: commandInputs["selection.group"],
    group: "selection",
    variants: [
      {
        id: "selection.group",
        label: "Group Selection",
        description: "Create a group from the selected windows.",
        hotkeys: [],
        input: {},
      },
    ],
    available: ({ currentState: state, groupId }) =>
      state.selection.targets.every((target) => target.type === "window") &&
      getInfiniteCanvasGroupableWindowIds(state, getSelectedWindowIds(state.selection)).length >
        0 &&
      (groupId === undefined || findInfiniteCanvasGroup(state, groupId) === null),
    execute: ({ currentState: state, groupId, layout, masonry }) => {
      const windowIds = getInfiniteCanvasGroupableWindowIds(
        state,
        getSelectedWindowIds(state.selection),
      );
      const rect = getInfiniteCanvasSelectionBounds({ state: state });
      if (windowIds.length === 0 || rect === null) return state;
      const id =
        groupId ??
        Array.from({ length: state.groups.length + 1 }, (_, index) => `group:${index}`).find(
          (candidate) => findInfiniteCanvasGroup(state, candidate) === null,
        )!;
      const grouped = createInfiniteCanvasGroup(state, {
        groupId: id,
        rect,
        windowIds,
        layout,
        masonry,
      });
      return grouped === state
        ? state
        : updateSelection(grouped, {
            mode: "replace",
            targets: [{ id, type: "group", kind: "group" }],
          });
    },
  },
  "desktop.cancel": {
    schema: commandInputs["desktop.cancel"],
    variants: [
      {
        input: {},
        description: "Cancel the active interaction or clear desktop selection.",
        hotkeys: ["Escape"],
        id: "desktop.cancel",
        label: "Cancel",
      },
    ],
    group: "canvas",
    available: ({ currentState: state }) =>
      state.interaction !== null || state.selection.targets.length > 0,
    execute: ({ currentState: state, options }) =>
      state.interaction === null
        ? updateSelection(state, { mode: "replace", targets: [] })
        : { ...state, ...options.content, interaction: null, snapPreview: null },
  },
  "selection.clear": {
    schema: commandInputs["selection.clear"],
    variants: [
      {
        input: {},
        description: "Clear the current desktop selection.",
        hotkeys: [],
        id: "selection.clear",
        label: "Clear Selection",
      },
    ],
    group: "selection",
    available: ({ currentState: state }) => state.selection.targets.length > 0,
    execute: ({ currentState: state }) => updateSelection(state, { mode: "replace", targets: [] }),
  },
  "selection.selectAllVisible": {
    schema: commandInputs["selection.selectAllVisible"],
    variants: [
      {
        input: {},
        description: "Select every window on this desktop that is not minimized.",
        hotkeys: ["Mod+A"],
        id: "selection.selectAllVisible",
        label: "Select All Windows",
      },
    ],
    group: "selection",
    available: ({ currentState: state }) => getSelectableWindowIds(state).length > 0,
    execute: ({ currentState: state }) =>
      updateSelection(state, {
        mode: "replace",
        targets: [...getCanvasLayout(state).visibleWindowIds].map((id) => ({ type: "window", id })),
      }),
  },
  "view.fitAll": {
    schema: commandInputs["view.fitAll"],
    variants: [
      {
        input: {},
        description: "Fit every window on this desktop that is not minimized inside the viewport.",
        hotkeys: ["Shift+1"],
        id: "view.fitAll",
        label: "Fit All",
      },
    ],
    group: "view",
    available: ({ currentState: state }) =>
      state.viewport.width > 0 &&
      state.viewport.height > 0 &&
      getVisibleWindowBounds(state) !== null,
    execute: ({ currentState: state, options }) =>
      navigateCamera(
        state,
        {
          behavior: FIT_CAMERA_NAVIGATION_BEHAVIOR,
          target: { type: "visibleWindows" },
        },
        options.zoomPolicy ?? DEFAULT_INFINITE_CANVAS_ZOOM,
      ),
  },
  "view.fitSelection": {
    schema: commandInputs["view.fitSelection"],
    variants: [
      {
        input: {},
        description: "Fit the current selection inside the viewport.",
        hotkeys: ["Shift+2"],
        id: "view.fitSelection",
        label: "Fit Selection",
      },
    ],
    group: "selection",
    available: ({ currentState: state, options }) =>
      state.viewport.width > 0 &&
      state.viewport.height > 0 &&
      (options.selectionBounds ?? getInfiniteCanvasSelectionBounds({ state })) !== null,
    execute: ({ currentState: state, options }) =>
      navigateCamera(
        state,
        {
          behavior: FIT_CAMERA_NAVIGATION_BEHAVIOR,
          target: { type: "selection" },
        },
        options.zoomPolicy ?? DEFAULT_INFINITE_CANVAS_ZOOM,
        options.selectionBounds,
      ),
  },
  "window.nudge": {
    schema: commandInputs["window.nudge"],
    variants: [
      ...directions.map(
        ({ direction, key, label }) =>
          ({
            input: { amountPx: 1, direction },
            description: `Nudge the current selection ${direction} by one screen pixel. ${NUDGE_GROUP_RULE}`,
            hotkeys: [key],
            id: `window.nudge.${direction}`,
            label: `Nudge ${label}`,
          }) as const,
      ),
      ...directions.map(
        ({ direction, key, label }) =>
          ({
            input: { amountPx: 10, direction },
            description: `Nudge the current selection ${direction} by ten screen pixels. ${NUDGE_GROUP_RULE}`,
            hotkeys: [`Shift+${key}`],
            id: `window.nudge.${direction}.large`,
            label: `Nudge ${label} Large`,
          }) as const,
      ),
    ],
    group: "window",
    available: ({ currentState }) => getInfiniteCanvasMovableSelection(currentState).length > 0,
    execute: ({ currentState: state, options: _options, ...command }) =>
      nudgeSelectedWindows(state, command),
  },
  "window.focusDirection": {
    schema: commandInputs["window.focusDirection"],
    variants: directions.map(
      ({ direction, key, label, position }) =>
        ({
          input: { direction },
          description: `Focus the nearest window ${position} the active one.`,
          hotkeys: [`Alt+${key}`],
          id: `window.focus.${direction}`,
          label: `Focus ${label}`,
        }) as const,
    ),
    group: "window",
    available: ({ currentState, direction }) =>
      getInfiniteCanvasDirectionalFocusTarget(currentState, direction) !== null,
    execute: ({ currentState: state, direction, options }) =>
      focusWindowInDirection(
        state,
        direction,
        options.zoomPolicy ?? DEFAULT_INFINITE_CANVAS_ZOOM,
        "replace",
      ),
  },
  "history.undo": {
    schema: commandInputs["history.undo"],
    variants: [
      {
        input: {},
        description: "Undo the last change to the windows or groups on the canvas.",
        hotkeys: ["Mod+Z"],
        id: "history.undo",
        label: "Undo",
      },
    ],
    group: "edit",
    available: ({ currentState, options }) =>
      currentState.interaction !== null || (options.history?.undos$.get() ?? 0) > 0,
    execute: ({ currentState, options }): InfiniteCanvasState => {
      if (currentState.interaction !== null)
        return applyAction({ type: "desktop.cancel", currentState, options });
      options.history?.undo();
      const restored = options.getState?.() ?? currentState;
      return revealDocumentChange({ state: restored, before: currentState, after: restored });
    },
  },
  "history.redo": {
    schema: commandInputs["history.redo"],
    variants: [
      {
        input: {},
        description: "Redo the change that was last undone.",
        hotkeys: ["Mod+Shift+Z", "Mod+Y"],
        id: "history.redo",
        label: "Redo",
      },
    ],
    group: "edit",
    available: ({ currentState, options }) =>
      currentState.interaction === null && (options.history?.redos$.get() ?? 0) > 0,
    execute: ({ currentState, options }): InfiniteCanvasState => {
      options.history?.redo();
      const restored = options.getState?.() ?? currentState;
      return revealDocumentChange({ state: restored, before: currentState, after: restored });
    },
  },
  "window.align": {
    schema: commandInputs["window.align"],
    variants: (
      [
        ["left", "Left", "to the left edge of their collective bounds"],
        ["right", "Right", "to the right edge of their collective bounds"],
        ["top", "Top", "to the top edge of their collective bounds"],
        ["bottom", "Bottom", "to the bottom edge of their collective bounds"],
        ["horizontal-center", "Horizontal Centers", "on a shared vertical centreline"],
        ["vertical-center", "Vertical Centers", "on a shared horizontal centreline"],
      ] as const
    ).map(
      ([alignment, label, position]) =>
        ({
          input: { alignment },
          description: `Align the selected windows ${position}. ${ARRANGE_GROUP_RULE}`,
          hotkeys: [],
          id: `window.align.${alignment}`,
          label: `Align ${label}`,
        }) as const,
    ),
    group: "window",
    available: isWindowArrangementAvailable,
    execute: ({ currentState: state, options: _options, ...command }) =>
      arrangeSelectedWindows(state, command),
  },
  "window.dockDirection": {
    schema: commandInputs["window.dockDirection"],
    variants: directions.map(
      ({ direction, label, position }) =>
        ({
          input: { direction },
          description: `Dock the active window against the nearest window ${position} it.`,
          hotkeys: [],
          id: `window.dock.${direction}`,
          label: `Dock ${label}`,
        }) as const,
    ),
    group: "window",
    available: ({ currentState, direction }) =>
      resolveInfiniteCanvasDirectionalDock(currentState, direction) !== null,
    execute: ({ currentState: state, direction }) => {
      const preview = resolveInfiniteCanvasDirectionalDock(state, direction);
      return preview === null ? state : applyInfiniteCanvasDockPreview(state, preview);
    },
  },
  // Place command tear-outs. Pointer drags already supply their rect.
  "window.undock": {
    schema: commandInputs["window.undock"],
    variants: [
      {
        input: {},
        description:
          "Tear the active window out of its group, back to floating at the size it currently occupies.",
        hotkeys: [],
        id: "window.undock",
        label: "Undock Window",
      },
    ],
    group: "window",
    available: ({ currentState: state }) => {
      const windowId = getCommandWindowId(state);
      return windowId !== null && isInfiniteCanvasWindowGrouped(state, windowId);
    },
    execute: ({ currentState: state }) => {
      const windowId = getCommandWindowId(state);
      if (windowId === null) return state;
      const freed = findWindow(state, windowId);
      if (freed === null) return state;
      const shell = getInfiniteCanvasWindowGroup(state, freed.id);
      // Exclude an empty shell from placement obstacles.
      const emptiedShellId =
        shell !== null && getInfiniteCanvasGroupWindowIds(shell.tree).length === 1
          ? shell.id
          : null;
      const canvasLayout = getCanvasLayout(state);
      const freedRect = canvasLayout.windowRects.get(freed.id)!;
      const shellRect = shell === null ? undefined : canvasLayout.groupRects.get(shell.id);
      return undockInfiniteCanvasWindowFromGroup(state, {
        rect: getInfiniteCanvasVacantRect({
          bounds: getInfiniteCanvasRoomAround(shellRect ?? freedRect),
          occupied: [
            ...[...canvasLayout.groupRects]
              .filter(
                ([groupId]) =>
                  groupId !== emptiedShellId && canvasLayout.visibleGroupIds.has(groupId),
              )
              .map(([, rect]) => rect),
            ...state.windows
              .filter(
                (window) => canvasLayout.visibleWindowIds.has(window.id) && window.id !== freed.id,
              )
              .map((window) => canvasLayout.windowRects.get(window.id)!),
          ],
          preferred: freedRect,
        }),
        windowId,
      });
    },
  },
  "selection.extendDirection": {
    schema: commandInputs["selection.extendDirection"],
    variants: directions.map(
      ({ direction, label, position }) =>
        ({
          input: { direction },
          description: `Add the nearest window ${position} the active one to the selection, and focus it.`,
          hotkeys: [],
          id: `selection.extend.${direction}`,
          label: `Extend Selection ${label}`,
        }) as const,
    ),
    group: "selection",
    available: ({ currentState, direction }) =>
      getInfiniteCanvasDirectionalFocusTarget(currentState, direction) !== null,
    execute: ({ currentState: state, direction, options }) =>
      focusWindowInDirection(
        state,
        direction,
        options.zoomPolicy ?? DEFAULT_INFINITE_CANVAS_ZOOM,
        "extend",
      ),
  },
  "workspace.cycle": {
    schema: commandInputs["workspace.cycle"],
    variants: [
      {
        input: { direction: "next" },
        description: "Switch to the next workspace, wrapping at the end.",
        hotkeys: [],
        id: "workspace.cycle.next",
        label: "Next Workspace",
      },
      {
        input: { direction: "previous" },
        description: "Switch to the previous workspace, wrapping at the start.",
        hotkeys: [],
        id: "workspace.cycle.previous",
        label: "Previous Workspace",
      },
    ],
    group: "canvas",
    available: ({ currentState: state, direction }) =>
      getNextInfiniteCanvasWorkspaceId(state, direction) !== state.activeWorkspaceId,
    execute: ({ currentState: state, direction }) =>
      activateInfiniteCanvasWorkspace(state, getNextInfiniteCanvasWorkspaceId(state, direction)),
  },
  "workspace.showAll": {
    schema: commandInputs["workspace.showAll"],
    variants: [
      {
        input: {},
        description: "Leave the current workspace and show every window on the canvas.",
        hotkeys: [],
        id: "workspace.showAll",
        label: "Show All Windows",
      },
    ],
    group: "canvas",
    available: ({ currentState }) => currentState.activeWorkspaceId !== null,
    execute: ({ currentState: state }) => activateInfiniteCanvasWorkspace(state, null),
  },
  "workspace.create": {
    schema: commandInputs["workspace.create"],
    variants: [
      {
        input: { workspaceId: "" },
        description:
          "Make a new desktop and go to it. Windows stay where they are; none are moved.",
        hotkeys: [],
        id: "workspace.create",
        label: "New Desktop",
      },
    ],
    group: "canvas",
    available: ({ currentState, workspaceId }) =>
      workspaceId !== "" && findInfiniteCanvasWorkspace(currentState, workspaceId) === null,
    execute: ({ currentState: state, options: _options, ...command }) =>
      createInfiniteCanvasWorkspace(state, command),
  },
  "workspace.enter": {
    schema: commandInputs["workspace.enter"],
    variants: [
      {
        input: { workspaceId: "" },
        description: "Go to a desktop, restoring the camera and selection it was left with.",
        hotkeys: [],
        id: "workspace.enter",
        label: "Go to Desktop",
      },
    ],
    group: "canvas",
    available: ({ currentState, workspaceId }) =>
      workspaceId !== currentState.activeWorkspaceId &&
      findInfiniteCanvasWorkspace(currentState, workspaceId) !== null,
    execute: ({ currentState: state, workspaceId }) =>
      activateInfiniteCanvasWorkspace(state, workspaceId),
  },
  "window.reveal": {
    schema: commandInputs["window.reveal"],
    variants: [
      {
        input: { windowId: "" },
        description:
          "Go to a window: switch desktops if it is on another one, restore it if minimized, make it active, and bring the camera to it.",
        hotkeys: [],
        id: "window.reveal",
        label: "Reveal Window",
      },
    ],
    group: "window",
    available: ({ currentState, windowId }) => findWindow(currentState, windowId) !== null,
    execute: ({ currentState: state, options, windowId }) =>
      revealWindow(state, windowId, options.zoomPolicy ?? DEFAULT_INFINITE_CANVAS_ZOOM),
  },
  "workspace.close": {
    schema: commandInputs["workspace.close"],
    variants: [
      {
        input: { workspaceId: "" },
        description: "Remove a desktop. The windows on it stay open; only the grouping goes.",
        hotkeys: [],
        id: "workspace.close",
        label: "Close Desktop",
      },
    ],
    group: "canvas",
    available: ({ currentState, workspaceId }) =>
      findInfiniteCanvasWorkspace(currentState, workspaceId) !== null,
    execute: ({ currentState: state, workspaceId }) =>
      closeInfiniteCanvasWorkspace(state, workspaceId),
  },
  "workspace.moveActiveWindow": {
    schema: commandInputs["workspace.moveActiveWindow"],
    variants: [
      {
        input: { workspaceId: "" },
        description:
          "Send the active window to another desktop, leaving the one it is on. A docked window takes its whole group with it.",
        hotkeys: [],
        id: "workspace.moveActiveWindow",
        label: "Move Window to Desktop",
      },
    ],
    group: "canvas",
    available: ({ currentState, workspaceId }) =>
      getCommandWindowId(currentState) !== null &&
      findInfiniteCanvasWorkspace(currentState, workspaceId) !== null,
    execute: ({ currentState: state, workspaceId }) => {
      const windowId = getCommandWindowId(state);
      return windowId === null
        ? state
        : moveInfiniteCanvasWindowsToWorkspace(state, {
            windowIds: [windowId],
            workspaceId,
          });
    },
  },
  // Apply a membership delta to preserve concurrent additions.
  "workspace.removeActiveWindow": {
    schema: commandInputs["workspace.removeActiveWindow"],
    variants: [
      {
        input: {},
        description:
          "Take the active window off this workspace. The window stays open; it is no longer on this desktop. A docked window takes its whole group with it.",
        hotkeys: [],
        id: "workspace.removeActiveWindow",
        label: "Remove Window From Workspace",
      },
    ],
    group: "canvas",
    available: ({ currentState: state }) => {
      const windowId = getCommandWindowId(state);
      return (
        state.activeWorkspaceId !== null &&
        windowId !== null &&
        isInfiniteCanvasWindowInActiveWorkspace(state, windowId)
      );
    },
    execute: ({ currentState: state }) => {
      const windowId = getCommandWindowId(state);
      return state.activeWorkspaceId === null || windowId === null
        ? state
        : removeInfiniteCanvasWindowFromWorkspace(state, {
            windowId,
            workspaceId: state.activeWorkspaceId,
          });
    },
  },
  // Removing the active window also selects the prior anchor.
  "selection.removeActive": {
    schema: commandInputs["selection.removeActive"],
    variants: [
      {
        input: {},
        description:
          "Drop the active window from the selection and fall back to the one before it — the way out of extending one window too far.",
        hotkeys: [],
        id: "selection.removeActive",
        label: "Remove Window From Selection",
      },
    ],
    group: "selection",
    available: ({ currentState }) =>
      currentState.activeWindowId !== null &&
      isSelectionTargetSelected(currentState.selection, {
        type: "window",
        id: currentState.activeWindowId,
      }),
    execute: ({ currentState: state }) =>
      state.activeWindowId === null
        ? state
        : updateSelection(state, {
            mode: "remove",
            targets: [{ type: "window", id: state.activeWindowId }],
          }),
  },
  "view.pan": {
    schema: commandInputs["view.pan"],
    variants: directions.map(
      ({ direction, label }) =>
        ({
          input: { amountPx: 200, direction },
          description: `Move the viewport ${direction} across the canvas.`,
          hotkeys: [],
          id: `view.pan.${direction}`,
          label: `Pan ${label}`,
        }) as const,
    ),
    group: "view",
    available: ({ currentState }) => isUsableViewport(currentState.viewport),
    execute: ({ amountPx, currentState: state, direction }) => ({
      ...state,
      camera: panCameraByScreenDelta(state.camera, getDirectionalScreenDelta(direction, amountPx)),
    }),
  },
  // Convert the zoom factor to an absolute center-anchored zoom.
  "view.zoomBy": {
    schema: commandInputs["view.zoomBy"],
    variants: [
      {
        input: { factor: 1.25 },
        description: "Zoom in one step, holding the centre of the viewport still.",
        hotkeys: ["="],
        id: "view.zoomIn",
        label: "Zoom In",
      },
      {
        input: { factor: 0.8 },
        description: "Zoom out one step, holding the centre of the viewport still.",
        hotkeys: ["-"],
        id: "view.zoomOut",
        label: "Zoom Out",
      },
    ],
    group: "view",
    available: ({ currentState: state, factor, options }) =>
      isUsableViewport(state.viewport) &&
      zoomCameraAtScreenPoint(
        state.camera,
        state.viewport,
        getViewportCentre(state.viewport),
        state.camera.zoom * factor,
        options.zoomPolicy ?? DEFAULT_INFINITE_CANVAS_ZOOM,
      ).zoom !== state.camera.zoom,
    execute: ({ currentState: state, factor, options }) => {
      const zoomPolicy = options.zoomPolicy ?? DEFAULT_INFINITE_CANVAS_ZOOM;
      return {
        ...state,
        camera: zoomCameraAtScreenPoint(
          state.camera,
          state.viewport,
          getViewportCentre(state.viewport),
          state.camera.zoom * factor,
          zoomPolicy,
        ),
      };
    },
  },
  "activeWindow.close": {
    schema: commandInputs["activeWindow.close"],
    variants: [
      {
        input: {},
        description: "Close the active window.",
        hotkeys: [],
        id: "activeWindow.close",
        label: "Close Window",
      },
    ],
    group: "window",
    available: ({ currentState: state, options }): boolean => {
      const windowId = getCommandWindowId(state);
      return (
        windowId !== null &&
        commandDefinitions["window.close"].available?.({
          currentState: state,
          type: "window.close",
          windowId,
          options,
        }) !== false
      );
    },
    execute: ({ currentState: state, options }) => {
      const windowId = getCommandWindowId(state);
      if (windowId === null) return state;
      return applyAction({ currentState: state, type: "window.close", windowId, options });
    },
  },
  "selection.close": {
    schema: commandInputs["selection.close"],
    variants: [
      {
        input: {},
        description: "Close every selected window that can be closed, as a single undoable edit.",
        hotkeys: [],
        id: "selection.close",
        label: "Close Selected Windows",
      },
    ],
    group: "selection",
    available: ({ currentState: state }) =>
      getInfiniteCanvasCapableSelection(state, "closable").length > 0,
    execute: ({ currentState: state, options }) =>
      getInfiniteCanvasCapableSelection(state, "closable").reduce<InfiniteCanvasState>(
        (current, windowId) =>
          applyAction({ currentState: current, type: "window.close", windowId, options }),
        state,
      ),
  },
  // One action keeps the bulk close in one undo entry.
  "selection.minimize": {
    schema: commandInputs["selection.minimize"],
    variants: [
      {
        input: {},
        description:
          "Collapse every selected window that can be minimized, as a single undoable edit. Docked windows leave their groups on the way, so minimizing a whole group empties its shell.",
        hotkeys: [],
        id: "selection.minimize",
        label: "Minimize Selected Windows",
      },
    ],
    group: "selection",
    available: ({ currentState: state }) =>
      getInfiniteCanvasCapableSelection(state, "minimizable").some(
        (id) => findWindow(state, id)?.mode !== "minimized",
      ),
    execute: ({ currentState: state, options }) =>
      getInfiniteCanvasCapableSelection(state, "minimizable").reduce<InfiniteCanvasState>(
        (current, windowId) =>
          applyAction({
            currentState: current,
            type: "window.minimize",
            windowId,
            options,
          }),
        state,
      ),
  },
  // Set one target state for the complete selection.
  "selection.togglePinned": {
    schema: commandInputs["selection.togglePinned"],
    variants: [
      {
        input: {},
        description:
          "Pin every selected window, or unpin them all when every one is already pinned.",
        hotkeys: [],
        id: "selection.togglePinned",
        label: "Pin / Unpin Selected Windows",
      },
    ],
    group: "selection",
    available: ({ currentState: state }) =>
      getInfiniteCanvasCapableSelection(state, null).length > 0,
    execute: ({ currentState: state }) => {
      const selected = getInfiniteCanvasCapableSelection(state, null);
      const shouldPin = selected.some((windowId) => findWindow(state, windowId)?.isPinned !== true);
      return selected.reduce<InfiniteCanvasState>(
        (current, windowId) =>
          findWindow(current, windowId)?.isPinned === shouldPin
            ? current
            : toggleWindowPinned(current, windowId),
        state,
      );
    },
  },
  "activeWindow.minimize": {
    schema: commandInputs["activeWindow.minimize"],
    variants: [
      {
        input: {},
        description:
          "Collapse the active window into the dock. A docked window leaves its group on the way, since a pane in the dock cannot hold a layout slot.",
        hotkeys: [],
        id: "activeWindow.minimize",
        label: "Minimize Window",
      },
    ],
    group: "window",
    available: ({ currentState: state, options }): boolean => {
      const windowId = getCommandWindowId(state);
      return (
        windowId !== null &&
        commandDefinitions["window.minimize"].available?.({
          currentState: state,
          type: "window.minimize",
          windowId,
          options,
        }) !== false
      );
    },
    execute: ({ currentState: state, options }) => {
      const windowId = getCommandWindowId(state);
      if (windowId === null) return state;
      return applyAction({ currentState: state, type: "window.minimize", windowId, options });
    },
  },
  "activeWindow.toggleMaximized": {
    schema: commandInputs["activeWindow.toggleMaximized"],
    variants: [
      {
        input: {},
        description:
          "Maximize the active window to fill the viewport, or restore it to the size it had before. Maximizing takes a docked window out of its group, and restoring does not put it back.",
        hotkeys: [],
        id: "activeWindow.toggleMaximized",
        label: "Maximize / Restore Window",
      },
    ],
    group: "window",
    available: ({ currentState: state, options }): boolean => {
      const windowId = getCommandWindowId(state);
      const window = windowId === null ? null : findWindow(state, windowId);
      return (
        window !== null &&
        (window.mode === "maximized" ||
          commandDefinitions["window.maximize"].available?.({
            currentState: state,
            type: "window.maximize",
            windowId: window.id,
            options,
          }) !== false)
      );
    },
    execute: ({ currentState: state, options }) => {
      const windowId = getCommandWindowId(state);
      if (windowId === null) return state;
      const active = findWindow(state, windowId);
      if (active === null) return state;
      if (active.mode === "maximized")
        return applyAction({ currentState: state, type: "window.restore", windowId, options });
      return applyAction({ currentState: state, type: "window.maximize", windowId, options });
    },
  },
  "activeWindow.togglePinned": {
    schema: commandInputs["activeWindow.togglePinned"],
    variants: [
      {
        input: {},
        description: "Pin the active window so it stacks above every unpinned one, or unpin it.",
        hotkeys: [],
        id: "activeWindow.togglePinned",
        label: "Pin / Unpin Window",
      },
    ],
    group: "window",
    available: ({ currentState: state }) => {
      const windowId = getCommandWindowId(state);
      return windowId !== null && findWindow(state, windowId) !== null;
    },
    execute: ({ currentState: state }) => {
      const windowId = getCommandWindowId(state);
      if (windowId === null) return state;
      return toggleWindowPinned(state, windowId);
    },
  },
  "group.setLayout": {
    schema: commandInputs["group.setLayout"],
    variants: [
      {
        input: { layout: "split" },
        description: "Show the active window's panes side by side, sharing the container.",
        hotkeys: [],
        id: "group.setLayout.split",
        label: "Layout: Split",
      },
      {
        input: { layout: "tabs" },
        description: "Collapse the active window's panes into a tab strip, one visible at a time.",
        hotkeys: [],
        id: "group.setLayout.tabs",
        label: "Layout: Tabs",
      },
      {
        input: { layout: "accordion" },
        description: "Stack the active window's panes as folds, one expanded at a time.",
        hotkeys: [],
        id: "group.setLayout.accordion",
        label: "Layout: Accordion",
      },
      {
        input: { layout: "masonry" },
        description:
          "Pack the active window's panes on a lattice of square cells; the shell grows with its rows.",
        hotkeys: [],
        id: "group.setLayout.masonry",
        label: "Layout: Lattice",
      },
    ],
    group: "window",
    available: ({ currentState: state, layout }) => {
      const active = getActiveInfiniteCanvasGroupContainer(state);
      if (active !== null) return active.container.layout !== layout;
      return getSelectedGroup(state)?.tree.kind === "window" && layout !== "split";
    },
    execute: ({ currentState: state, layout }) => {
      const active = getActiveInfiniteCanvasGroupContainer(state);
      const groupId = active?.groupId ?? getSelectedGroup(state)?.id;
      return groupId === undefined
        ? state
        : setInfiniteCanvasGroupLayoutModeInState(state, {
            containerId: active?.container.id ?? groupId,
            groupId,
            layout,
          });
    },
  },
  "group.resizePane": {
    schema: commandInputs["group.resizePane"],
    variants: [
      {
        input: { amountPx: 24 },
        description:
          "Give the active window a larger share of its container, taking it from the next pane along — or from the previous one when the active window is last.",
        hotkeys: [],
        id: "group.growPane",
        label: "Grow Pane",
      },
      {
        input: { amountPx: -24 },
        description:
          "Give the active window a smaller share of its container, returning it to the next pane along — or to the previous one when the active window is last.",
        hotkeys: [],
        id: "group.shrinkPane",
        label: "Shrink Pane",
      },
    ],
    group: "window",
    available: ({ currentState }) => resolveInfiniteCanvasPaneSeam(currentState) !== null,
    execute: ({ amountPx, currentState: state }) => {
      const seam = resolveInfiniteCanvasPaneSeam(state);
      if (seam === null) return state;
      // Convert screen travel to the world units used by group layout.
      const weights = getInfiniteCanvasGroupGutterWeights(seam.container, seam.gutter, {
        availableExtent: seam.gutter.availableExtent,
        delta: (amountPx * seam.grows) / state.camera.zoom,
      });
      return Object.keys(weights).length === 0
        ? state
        : setInfiniteCanvasGroupChildWeightsInState(state, {
            containerId: seam.gutter.containerId,
            groupId: seam.groupId,
            weights,
          });
    },
  },
  "group.fitContents": {
    schema: commandInputs["group.fitContents"],
    variants: [
      {
        input: {},
        description: "Fit the group frame to its children without moving or resizing them.",
        hotkeys: [],
        id: "group.fitContents",
        label: "Fit Group to Contents",
      },
    ],
    group: "window",
    available: ({ currentState: state, groupId }) => {
      const id = groupId ?? getSelectedGroup(state)?.id;
      const group = id === undefined ? null : findInfiniteCanvasGroup(state, id);
      return group !== null && group.bounds !== "content";
    },
    execute: ({ currentState: state, groupId }) => {
      const id = groupId ?? getSelectedGroup(state)?.id;
      return id === undefined
        ? state
        : setInfiniteCanvasGroupBounds(state, {
            groupId: id,
            bounds: "content",
          });
    },
  },
  "group.setBounds": {
    schema: commandInputs["group.setBounds"],
    group: "window",
    available: ({ currentState, groupId }) =>
      findInfiniteCanvasGroup(currentState, groupId) !== null,
    execute: ({ currentState, groupId, bounds }) =>
      setInfiniteCanvasGroupBounds(currentState, { groupId, bounds }),
  },
  "group.dissolve": {
    schema: commandInputs["group.dissolve"],
    variants: [
      {
        input: {},
        description:
          "Break up the group holding the active window. A split's panes stay exactly where they were; tabbed or folded ones share one rect, so they are placed clear of each other.",
        hotkeys: [],
        id: "group.dissolve",
        label: "Ungroup Panes",
      },
    ],
    group: "window",
    available: ({ currentState: state }) => getSelectedGroup(state) !== null,
    execute: ({ currentState: state }) => {
      const group = getSelectedGroup(state);
      return group === null ? state : closeInfiniteCanvasGroup(state, group.id);
    },
  },
  "group.moveChild": {
    schema: commandInputs["group.moveChild"],
    variants: [
      {
        input: { toward: "start" },
        description: "Move the active window one place toward the start of its container's order.",
        hotkeys: [],
        id: "group.moveChild.start",
        label: "Move Pane Toward Start",
      },
      {
        input: { toward: "end" },
        description: "Move the active window one place toward the end of its container's order.",
        hotkeys: [],
        id: "group.moveChild.end",
        label: "Move Pane Toward End",
      },
    ],
    group: "window",
    available: ({ currentState: state, toward }) => {
      const index = getActiveInfiniteCanvasGroupChildIndex(state);
      return index !== null && (toward === "start" ? index.at > 0 : index.at < index.count - 1);
    },
    execute: ({ currentState: state, toward }) => {
      const index = getActiveInfiniteCanvasGroupChildIndex(state);
      return index === null
        ? state
        : reorderInfiniteCanvasGroupChildInState(state, {
            childId: index.childId,
            groupId: index.groupId,
            toIndex: toward === "start" ? index.at - 1 : index.at + 1,
          });
    },
  },
  "group.flipAxis": {
    schema: commandInputs["group.flipAxis"],
    variants: [
      {
        input: {},
        description:
          "Turn the active window's panes through ninety degrees — a row becomes a column, and back.",
        hotkeys: [],
        id: "group.flipAxis",
        label: "Flip Pane Orientation",
      },
    ],
    group: "window",
    available: ({ currentState: state }) => {
      const active = getActiveInfiniteCanvasGroupContainer(state);
      return (
        active !== null &&
        active.container.children.length > 1 &&
        active.container.layout !== "tabs" &&
        active.container.layout !== "masonry"
      );
    },
    execute: ({ currentState: state }) => {
      const active = getActiveInfiniteCanvasGroupContainer(state);
      return active === null
        ? state
        : setInfiniteCanvasGroupAxisInState(state, {
            axis: active.container.axis === "horizontal" ? "vertical" : "horizontal",
            containerId: active.container.id,
            groupId: active.groupId,
          });
    },
  },
  "group.equalizeChildren": {
    schema: commandInputs["group.equalizeChildren"],
    variants: [
      {
        input: {},
        description:
          "Reset the panes sharing a row or column with the active window to equal shares, undoing accumulated seam drags.",
        hotkeys: [],
        id: "group.equalizeChildren",
        label: "Equalize Panes",
      },
    ],
    group: "window",
    available: (input) => {
      const active = resolveGroupEqualization(input);
      if (active === null || active.container.children.length < 2) return false;
      const [first, ...rest] = active.container.children;
      return rest.some((child) => child.weight !== first?.weight);
    },
    execute: (input) => {
      const target = resolveGroupEqualization(input);
      if (target === null) return input.currentState;
      return setInfiniteCanvasGroupChildWeightsInState(input.currentState, {
        groupId: target.groupId,
        containerId: target.container.id,
        weights: Object.fromEntries(target.container.children.map((child) => [child.id, 1])),
      });
    },
  },
  "window.swap": {
    schema: commandInputs["window.swap"],
    variants: [
      {
        input: {},
        description: `Swap the two selected windows, each keeping its own size. Centres are exchanged rather than corners, so windows of different sizes visibly trade places. ${ARRANGE_GROUP_RULE}`,
        hotkeys: [],
        id: "window.swap",
        label: "Swap Windows",
      },
    ],
    group: "window",
    available: isWindowArrangementAvailable,
    execute: ({ currentState: state, options: _options, ...command }) =>
      arrangeSelectedWindows(state, command),
  },
  "window.pack": {
    schema: commandInputs["window.pack"],
    variants: [
      {
        input: { gapPx: 16 },
        description: `Pack the selected windows into rows inside the region they already span, tallest first, so nothing overlaps and the block is as short as it can be. Sizes are kept. ${ARRANGE_GROUP_RULE}`,
        hotkeys: [],
        id: "window.pack",
        label: "Pack Windows",
      },
    ],
    group: "window",
    available: isWindowArrangementAvailable,
    execute: ({ currentState: state, options: _options, ...command }) =>
      arrangeSelectedWindows(state, command),
  },
  "window.distribute": {
    schema: commandInputs["window.distribute"],
    variants: [
      {
        input: { distribution: "horizontal" },
        description: `Even out the horizontal gaps between the selected windows. ${ARRANGE_GROUP_RULE}`,
        hotkeys: [],
        id: "window.distribute.horizontal",
        label: "Distribute Horizontally",
      },
      {
        input: { distribution: "vertical" },
        description: `Even out the vertical gaps between the selected windows. ${ARRANGE_GROUP_RULE}`,
        hotkeys: [],
        id: "window.distribute.vertical",
        label: "Distribute Vertically",
      },
    ],
    group: "window",
    available: isWindowArrangementAvailable,
    execute: ({ currentState: state, options: _options, ...command }) =>
      arrangeSelectedWindows(state, command),
  },
  "view.resetZoom": {
    schema: commandInputs["view.resetZoom"],
    variants: [
      // Default chords must not shadow browser or operating-system shortcuts.
      {
        input: {},
        description: "Reset the canvas zoom around the viewport center.",
        hotkeys: ["Shift+0"],
        id: "view.resetZoom",
        label: "Reset Zoom",
      },
    ],
    group: "view",
    available: ({ currentState: state }) => state.viewport.width > 0 && state.viewport.height > 0,
    execute: ({ currentState: state, options }) => {
      const zoomPolicy = options.zoomPolicy ?? DEFAULT_INFINITE_CANVAS_ZOOM;
      return {
        ...state,
        camera: zoomCameraAtScreenPoint(
          state.camera,
          state.viewport,
          { x: state.viewport.width / 2, y: state.viewport.height / 2 },
          zoomPolicy.defaultZoom,
          zoomPolicy,
        ),
      };
    },
  },
  "window.place": {
    schema: commandInputs["window.place"],
    variants: [
      {
        input: {
          region: "left",
        },
        description: "Place the active window in the left half of the visible canvas.",
        hotkeys: ["Mod+Shift+ArrowLeft"],
        id: "window.place.left",
        label: "Place Left Half",
      },
      {
        input: {
          region: "right",
        },
        description: "Place the active window in the right half of the visible canvas.",
        hotkeys: ["Mod+Shift+ArrowRight"],
        id: "window.place.right",
        label: "Place Right Half",
      },
      {
        input: {
          region: "top",
        },
        description: "Place the active window in the top half of the visible canvas.",
        hotkeys: ["Mod+Shift+ArrowUp"],
        id: "window.place.top",
        label: "Place Top Half",
      },
      {
        input: {
          region: "bottom",
        },
        description: "Place the active window in the bottom half of the visible canvas.",
        hotkeys: ["Mod+Shift+ArrowDown"],
        id: "window.place.bottom",
        label: "Place Bottom Half",
      },
      {
        input: {
          region: "fill",
        },
        description: "Place the active window across the whole visible canvas.",
        hotkeys: ["Mod+Shift+Enter"],
        id: "window.place.fill",
        label: "Place Filling View",
      },
      {
        input: {
          region: "center",
        },
        description: "Centre the active window at its current size.",
        hotkeys: [],
        id: "window.place.center",
        label: "Centre Window",
      },
    ],
    group: "window",
    available: ({ currentState }) => getActiveGeometryWindowId(currentState, "movable") !== null,
    execute: ({ currentState: state, options: _options, ...command }) =>
      placeActiveWindow(state, command),
  },
  "window.resize": {
    schema: commandInputs["window.resize"],
    variants: [
      {
        input: {
          amountPx: 10,
          direction: "right",
        },
        description: "Widen the active window by ten screen pixels.",
        hotkeys: ["Alt+Shift+ArrowRight"],
        id: "window.resize.right",
        label: "Widen Window",
      },
      {
        input: {
          amountPx: 10,
          direction: "left",
        },
        description: "Narrow the active window by ten screen pixels.",
        hotkeys: ["Alt+Shift+ArrowLeft"],
        id: "window.resize.left",
        label: "Narrow Window",
      },
      {
        input: {
          amountPx: 10,
          direction: "down",
        },
        description: "Make the active window ten screen pixels taller.",
        hotkeys: ["Alt+Shift+ArrowDown"],
        id: "window.resize.down",
        label: "Heighten Window",
      },
      {
        input: {
          amountPx: 10,
          direction: "up",
        },
        description: "Make the active window ten screen pixels shorter.",
        hotkeys: ["Alt+Shift+ArrowUp"],
        id: "window.resize.up",
        label: "Shorten Window",
      },
    ],
    group: "window",
    available: ({ currentState }) => getActiveGeometryWindowId(currentState, "resizable") !== null,
    execute: ({ currentState: state, options: _options, ...command }) =>
      resizeActiveWindow(state, command),
  },
  "camera.panBy": {
    execute: ({ currentState, delta }) => ({
      ...currentState,
      camera: panCameraByScreenDelta(currentState.camera, delta),
    }),
  },
  "camera.zoomAt": {
    execute: ({ currentState, anchor, zoom, options }) => ({
      ...currentState,
      camera: zoomCameraAtScreenPoint(
        currentState.camera,
        currentState.viewport,
        anchor,
        zoom,
        options.zoomPolicy,
      ),
    }),
  },
  "connection.open": {
    execute: ({ currentState, connection }) =>
      openInfiniteCanvasConnection(currentState, connection),
  },
  "connection.close": {
    execute: ({ currentState, connectionId }) =>
      closeInfiniteCanvasConnection(currentState, connectionId),
  },
  "connection.update": {
    execute: (input) => updateInfiniteCanvasConnection(input.currentState, input),
  },
  "desktop.hydrate": {
    execute: ({ currentState, state }) =>
      createInfiniteCanvasState({
        ...state,
        viewport: isUsableViewport(currentState.viewport) ? currentState.viewport : state.viewport,
      }),
  },
  "desktop.reset": {
    schema: commandInputs["desktop.reset"],
    group: "canvas",
    variants: [
      {
        id: "desktop.reset",
        label: "Reset Canvas",
        description: "Restore the starting document.",
        hotkeys: [],
        input: {},
      },
    ],
    execute: ({ currentState, options }) =>
      createInfiniteCanvasState({
        ...structuredClone(options.initialState ?? { windows: [] }),
        viewport: currentState.viewport,
      }),
  },
  "interaction.finish": {
    execute: ({ currentState, pointerId }) => finishCanvasInteraction(currentState, pointerId),
  },
  "interaction.startMarquee": { execute: beginMarqueeSelection },
  "interaction.startMove": { execute: beginMove },
  "interaction.startGroupGutter": { execute: beginInfiniteCanvasGroupGutterDrag },
  "interaction.startGroupReorder": {
    execute: ({ currentState, groupId, childId, pointerId }) => {
      const group = findInfiniteCanvasGroup(currentState, groupId);
      if (group === null || getInfiniteCanvasGroupParent(group.tree, childId) === null)
        return currentState;
      return {
        ...currentState,
        interaction: { kind: "groupReorder", groupId, childId, pointerId },
        snapPreview: null,
      };
    },
  },
  "interaction.startGroupResize": { execute: beginInfiniteCanvasGroupResize },
  "interaction.startPan": { execute: beginCanvasPan },
  "interaction.startResize": { execute: beginWindowResize },
  "interaction.step": {
    execute: ({ currentState, pointerId, point, snapPolicy, dockIntent, options }) =>
      stepCanvasInteraction(currentState, pointerId, point, snapPolicy ?? options.snapPolicy, {
        dockIntent: dockIntent === true,
      }),
  },
  "selection.add": {
    execute: ({ currentState, targets }) =>
      updateSelection(currentState, { mode: "add", targets: targets }),
  },
  "selection.remove": {
    execute: ({ currentState, targets }) =>
      updateSelection(currentState, { mode: "remove", targets: targets }),
  },
  "selection.replace": {
    execute: ({ currentState, targets }) =>
      updateSelection(currentState, { mode: "replace", targets: targets }),
  },
  "selection.toggle": {
    execute: ({ currentState, targets }) =>
      updateSelection(currentState, { mode: "toggle", targets: targets }),
  },
  "viewport.set": { execute: ({ currentState, viewport }) => ({ ...currentState, viewport }) },
  "viewportInsets.set": {
    execute: ({ currentState, insets }) => ({
      ...currentState,
      viewportInsets: resolveInfiniteCanvasViewportInsets(insets),
    }),
  },
  "viewportOccluders.set": {
    execute: ({ currentState, occluders }) => ({ ...currentState, viewportOccluders: occluders }),
  },
  "groupMetrics.set": {
    execute: ({ currentState, metrics }) => ({
      ...currentState,
      groupMetrics: resolveInfiniteCanvasGroupMetrics(metrics),
    }),
  },
  "workspace.setTitle": {
    execute: (input) => renameInfiniteCanvasWorkspace(input.currentState, input),
  },
  "workspace.activate": {
    execute: ({ currentState, workspaceId }) =>
      activateInfiniteCanvasWorkspace(currentState, workspaceId),
  },
  "workspace.addWindow": {
    execute: (input) => addInfiniteCanvasWindowToWorkspace(input.currentState, input),
  },
  "workspace.moveWindows": {
    execute: (input) => moveInfiniteCanvasWindowsToWorkspace(input.currentState, input),
  },
  "workspace.removeWindow": {
    execute: (input) => removeInfiniteCanvasWindowFromWorkspace(input.currentState, input),
  },
  "workspace.reorder": {
    execute: (input) => reorderInfiniteCanvasWorkspace(input.currentState, input),
  },
  "workspace.setWindows": {
    execute: (input) => setInfiniteCanvasWorkspaceWindows(input.currentState, input),
  },
  "group.setTitle": { execute: (input) => renameInfiniteCanvasGroup(input.currentState, input) },
  "group.close": {
    execute: ({ currentState, groupId }) => closeInfiniteCanvasGroup(currentState, groupId),
  },
  "group.create": { execute: (input) => createInfiniteCanvasGroup(input.currentState, input) },
  "group.dockWindow": {
    execute: (input) => dockInfiniteCanvasWindowIntoGroup(input.currentState, input),
  },
  "group.reorderChild": {
    execute: (input) => reorderInfiniteCanvasGroupChildInState(input.currentState, input),
  },
  "group.setActiveChild": {
    execute: (input) => setInfiniteCanvasGroupActiveChildInState(input.currentState, input),
  },
  "group.setAxis": {
    execute: (input) => setInfiniteCanvasGroupAxisInState(input.currentState, input),
  },
  "group.setChildWeights": {
    execute: (input) => setInfiniteCanvasGroupChildWeightsInState(input.currentState, input),
  },
  "group.setLayoutMode": {
    execute: (input) => setInfiniteCanvasGroupLayoutModeInState(input.currentState, input),
  },
  "group.setRect": { execute: (input) => setInfiniteCanvasGroupRect(input.currentState, input) },
  "group.setChildLayouts": {
    execute: (input) => setInfiniteCanvasGroupWindowNodeLayoutsInState(input.currentState, input),
  },
  "group.undockWindow": {
    execute: (input) => undockInfiniteCanvasWindowFromGroup(input.currentState, input),
  },
  "recipe.apply": {
    execute: ({ currentState, recipe, placement }) =>
      applyInfiniteCanvasRecipe(currentState, recipe, placement),
  },
  "window.setTitle": { execute: (input) => renameWindow(input.currentState, input) },
  "window.setContentHeight": {
    execute: (input) => setInfiniteCanvasWindowContentHeight(input.currentState, input),
  },
  "window.setData": {
    execute: ({ currentState, windowId, data }) => {
      if (!currentState.windows.some((window) => window.id === windowId && window.data !== data))
        return currentState;
      return {
        ...currentState,
        windows: currentState.windows.map((window) =>
          window.id === windowId ? { ...window, data } : window,
        ),
      };
    },
  },
  "window.focus": { execute: ({ currentState, windowId }) => focusWindow(currentState, windowId) },
  "window.open": {
    execute: ({ currentState, window, placement, target }) => {
      const opened =
        placement === undefined
          ? window
          : { ...window, rect: getInfiniteCanvasPlacedWindowRect(currentState, window, placement) };
      const next =
        currentState.activeWorkspaceId === null
          ? openWindow(currentState, opened)
          : addInfiniteCanvasWindowToWorkspace(openWindow(currentState, opened), {
              windowId: opened.id,
              workspaceId: currentState.activeWorkspaceId,
            });
      if (target === undefined) return next;
      const group = findInfiniteCanvasGroup(currentState, target.groupId);
      const container =
        group && findInfiniteCanvasGroupNode(group.tree, target.containerId ?? group.tree.id);
      if (
        container === null ||
        container === undefined ||
        (target.containerId !== undefined && container.kind !== "container") ||
        (target.layout &&
          (container.kind !== "container" ||
            layoutDefinitions[container.layout].members?.drop === undefined))
      )
        return currentState;
      const docked = dockInfiniteCanvasWindowIntoGroup(next, {
        groupId: target.groupId,
        containerId: container.kind === "container" ? container.id : target.groupId,
        targetId: container.id,
        edge: "center",
        windowId: opened.id,
      });
      const placed =
        target.layout === undefined
          ? docked
          : setInfiniteCanvasGroupWindowNodeLayoutsInState(docked, {
              groupId: target.groupId,
              layouts: { [opened.id]: target.layout },
            });
      return target.index === undefined
        ? placed
        : reorderInfiniteCanvasGroupChildInState(placed, {
            groupId: target.groupId,
            childId: opened.id,
            toIndex: target.index,
          });
    },
  },
  "window.setRect": {
    execute: ({ currentState, windowId, rect }) =>
      isInfiniteCanvasWindowGrouped(currentState, windowId)
        ? currentState
        : updateWindowRect(currentState, windowId, rect),
  },
  "window.togglePinned": {
    execute: ({ currentState, windowId }) => toggleWindowPinned(currentState, windowId),
  },
  "window.close": {
    schema: commandInputs["window.close"],
    group: "window",
    available: ({ currentState, windowId }) =>
      isInfiniteCanvasWindowCapable(findWindow(currentState, windowId), "closable"),
    execute: ({ currentState, windowId }) => ({
      ...currentState,
      windows: currentState.windows.filter((window) => window.id !== windowId),
    }),
  },
  "window.minimize": {
    schema: commandInputs["window.minimize"],
    group: "window",
    available: ({ currentState, windowId }) =>
      isInfiniteCanvasWindowCapable(findWindow(currentState, windowId), "minimizable") &&
      findWindow(currentState, windowId)?.mode !== "minimized",
    execute: ({ currentState, windowId }) => ({
      ...currentState,
      windows: currentState.windows.map((window) =>
        window.id === windowId ? { ...window, mode: "minimized" as const } : window,
      ),
    }),
  },
  "window.maximize": {
    schema: commandInputs["window.maximize"],
    group: "window",
    available: ({ currentState, windowId }) =>
      isInfiniteCanvasWindowCapable(findWindow(currentState, windowId), "maximizable"),
    execute: ({ currentState: state, windowId }) => {
      const window = findWindow(state, windowId);
      if (window === null) return state;
      const rect = getViewportInsetWorldRect(state.camera, state.viewport, 36);
      const restoreRect =
        window.restoreRect ??
        getTargetBounds({ state, target: { type: "window", id: windowId } }) ??
        window.rect;
      return focusWindow(
        {
          ...state,
          windows: state.windows.map((entry) =>
            entry.id === windowId
              ? { ...entry, mode: "maximized" as const, rect, restoreRect }
              : entry,
          ),
        },
        windowId,
      );
    },
  },
  "window.restore": {
    schema: commandInputs["window.restore"],
    group: "window",
    available: ({ currentState, windowId }) => findWindow(currentState, windowId) !== null,
    execute: ({ currentState: state, windowId }) => {
      return focusWindow(
        {
          ...state,
          windows: state.windows.map((window) =>
            window.id === windowId
              ? {
                  ...window,
                  mode: "normal" as const,
                  rect: window.restoreRect ?? window.rect,
                  restoreRect: undefined,
                }
              : window,
          ),
        },
        windowId,
      );
    },
  },
  "camera.navigate": {
    schema: commandInputs["camera.navigate"],
    group: "view",
    available: ({ currentState: state, request, options }) =>
      isCameraNavigationAvailable(state, request, options.selectionBounds),
    execute: ({ currentState: state, options, request }) =>
      navigateCamera(
        state,
        request,
        options.zoomPolicy ?? DEFAULT_INFINITE_CANVAS_ZOOM,
        options.selectionBounds,
      ),
  },
} as const satisfies CommandDefinitions;

export type CommandId = {
  [Key in keyof typeof commandDefinitions]: (typeof commandDefinitions)[Key] extends {
    variants: readonly { id: infer Id extends string }[];
  }
    ? Id
    : never;
}[keyof typeof commandDefinitions];

const DEFAULT_INFINITE_CANVAS_COMMAND_DESCRIPTORS = Object.entries(commandDefinitions).flatMap(
  ([type, definition]) =>
    ("variants" in definition ? definition.variants : []).map(({ input, ...metadata }) => ({
      ...metadata,
      command: { ...input, type },
    })),
) as readonly InfiniteCanvasCommandDescriptor[];

function applyAction<Kind extends string, ActionType extends InfiniteCanvasAction["type"]>(
  input: InfiniteCanvasCommandHandlerInput<ActionType, Kind>,
): InfiniteCanvasState<Kind> {
  if (!Object.hasOwn(commandDefinitions, input.type)) {
    console.warn("Canvas action rejected", { type: input.type });
    return input.currentState;
  }
  const definition = (commandDefinitions as CommandDefinitions)[input.type];
  if (definition === undefined || definition.schema?.allows(input) === false) {
    console.warn("Canvas action rejected", { type: input.type });
    return input.currentState;
  }
  if (definition.available?.(input) === false) return input.currentState;
  return definition.execute(input) as InfiniteCanvasState<Kind>;
}

export function reduceInfiniteCanvasState<Kind extends string>(
  state: InfiniteCanvasState<Kind>,
  action: InfiniteCanvasAction<Kind>,
  options: InfiniteCanvasReducerOptions<Kind> = {},
): InfiniteCanvasState<Kind> {
  const applied = applyAction({ ...action, currentState: state, options });
  if (applied === state) return state;
  const nextState = reconcileInfiniteCanvasInteraction({
    previousState: state,
    state: reconcileInfiniteCanvasState({ previousState: state, state: applied }),
  });
  return nextState;
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
  getInfiniteCanvasCommandGroup,
  getInfiniteCanvasContextualCommands,
  getInfiniteCanvasHotkeyBindings,
  isInfiniteCanvasCommandEnabled,
};

export type {
  InfiniteCanvasCommandDescriptor,
  InfiniteCanvasHotkeyBinding,
  InfiniteCanvasReducerOptions,
};
