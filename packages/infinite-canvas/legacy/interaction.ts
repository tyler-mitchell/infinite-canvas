import {
  getRectFromPoints,
  rectsIntersect,
  resizeRectFromHandle,
  screenPointToWorldPoint,
  subtractPoints,
} from "./geometry";
import { getInfiniteCanvasGroupGutterWeights } from "./layout";
import {
  findInfiniteCanvasGroupNode,
  getInfiniteCanvasGroupWindowIds,
  isInfiniteCanvasGroupContainer,
} from "./group-tree";
import { getCanvasLayout, getTargetBounds } from "./layout";
import {
  getInfiniteCanvasMovableSelection,
  moveInfiniteCanvasTargets,
  resolveInfiniteCanvasMoveTarget,
} from "./movement";
import {
  applyInfiniteCanvasDockPreview,
  findInfiniteCanvasGroup,
  getWindowLayoutMembership,
  isInfiniteCanvasWindowGrouped,
  resizeLayoutMember,
  resolveInfiniteCanvasDockPreview,
  setInfiniteCanvasGroupChildWeightsInState,
  setInfiniteCanvasGroupBounds,
  undockInfiniteCanvasWindowFromGroup,
} from "./group-state";
import { isSelectionTargetSelected, updateSelection } from "./selection";
import { applyResizeSnapToRect, applySnapToRect } from "./snap-resolver";
import { isInfiniteCanvasWindowCapable } from "./window-capabilities";
import {
  findWindow,
  focusWindow,
  focusWindowPreservingSelection,
  updateWindowRect,
} from "./stacking";
import type {
  InfiniteCanvasActionInput,
  InfiniteCanvasCamera,
  InfiniteCanvasGroupGutterInteraction,
  InfiniteCanvasGroupResizeInteraction,
  InfiniteCanvasMarqueeInteraction,
  InfiniteCanvasMoveInteraction,
  InfiniteCanvasPoint,
  InfiniteCanvasResizeInteraction,
  InfiniteCanvasSnapPolicy,
  InfiniteCanvasState,
} from "./types";

function beginCanvasPan<Kind extends string>({
  clearSelection: clearSelectionOnStart = false,
  currentState: state,
  point,
  pointerId,
}: InfiniteCanvasActionInput<"interaction.startPan", Kind>): InfiniteCanvasState<Kind> {
  return {
    ...(clearSelectionOnStart ? updateSelection(state, { mode: "replace", targets: [] }) : state),
    interaction: {
      kind: "pan",
      originCamera: state.camera,
      originPointer: point,
      pointerId,
    },
    snapPreview: null,
  };
}

function beginMarqueeSelection<Kind extends string>({
  currentState: state,
  mode,
  point,
  pointerId,
}: InfiniteCanvasActionInput<"interaction.startMarquee", Kind>): InfiniteCanvasState<Kind> {
  const nextState = {
    ...state,
    interaction: {
      currentPointer: point,
      kind: "marquee",
      mode,
      originPointer: point,
      originSelection: state.selection,
      pointerId,
    },
    snapPreview: null,
  } satisfies InfiniteCanvasState<Kind>;

  return mode === "replace"
    ? updateSelection(nextState, { mode: "replace", targets: [] })
    : nextState;
}

/** Returns drag travel in world units across camera changes. */
function getInteractionWorldDelta<Kind extends string>(
  state: InfiniteCanvasState<Kind>,
  interaction: Readonly<{
    originCamera: InfiniteCanvasCamera;
    originPointer: InfiniteCanvasPoint;
  }>,
  point: InfiniteCanvasPoint,
): InfiniteCanvasPoint {
  return subtractPoints(
    screenPointToWorldPoint(state.camera, state.viewport, point),
    screenPointToWorldPoint(interaction.originCamera, state.viewport, interaction.originPointer),
  );
}

/** Starts a group resize with metrics captured for the complete drag. */
function beginInfiniteCanvasGroupResize<Kind extends string>({
  currentState: state,
  groupId,
  handle,
  minSize,
  point,
  pointerId,
}: Omit<
  InfiniteCanvasActionInput<"interaction.startGroupResize", Kind>,
  "type"
>): InfiniteCanvasState<Kind> {
  const group = findInfiniteCanvasGroup(state, groupId);

  if (group === null) return state;

  return {
    ...updateSelection(state, {
      mode: "replace",
      targets: [{ type: "group", kind: "group", id: group.id }],
    }),
    interaction: {
      groupId: group.id,
      handle,
      kind: "groupResize",
      minSize,
      originPointer: point,
      originRect: getTargetBounds({ state, target: { type: "group", id: group.id } })!,
      pointerId,
      originCamera: state.camera,
    },
    snapPreview: null,
  };
}

/** Uses the original shell rect so travel past a clamp is recoverable. */
function stepInfiniteCanvasGroupResize<Kind extends string>(
  state: InfiniteCanvasState<Kind>,
  interaction: InfiniteCanvasGroupResizeInteraction,
  point: InfiniteCanvasPoint,
): InfiniteCanvasState<Kind> {
  const rect = resizeRectFromHandle(
    interaction.originRect,
    interaction.handle,
    getInteractionWorldDelta(state, interaction, point),
    interaction.minSize,
  );
  return setInfiniteCanvasGroupBounds(state, {
    groupId: interaction.groupId,
    bounds: rect,
  });
}

/** Starts a split-seam drag with all values required by each step. */
function beginInfiniteCanvasGroupGutterDrag<Kind extends string>(
  input: InfiniteCanvasActionInput<"interaction.startGroupGutter", Kind>,
): InfiniteCanvasState<Kind> {
  const group = findInfiniteCanvasGroup(input.currentState, input.groupId);
  if (group === null) return input.currentState;
  const originContainer = findInfiniteCanvasGroupNode(group.tree, input.containerId);
  if (originContainer === null || !isInfiniteCanvasGroupContainer(originContainer))
    return input.currentState;
  const gutter = getCanvasLayout(input.currentState)
    .layouts.get(group.id)
    ?.gutters.find(
      (gutter) =>
        gutter.containerId === input.containerId &&
        gutter.beforeChildId === input.beforeChildId &&
        gutter.afterChildId === input.afterChildId,
    );
  if (gutter === undefined) return input.currentState;
  return {
    ...input.currentState,
    interaction: {
      afterChildId: input.afterChildId,
      availableExtent: gutter.availableExtent,
      axis: gutter.axis,
      beforeChildId: input.beforeChildId,
      containerId: input.containerId,
      groupId: input.groupId,
      kind: "groupGutter",
      originCamera: input.currentState.camera,
      originContainer,
      originPointer: input.point,
      pointerId: input.pointerId,
    },
    snapPreview: null,
  };
}

/** Recomputes seam weights from the original container and total drag distance. */
function stepInfiniteCanvasGroupGutterDrag<Kind extends string>(
  state: InfiniteCanvasState<Kind>,
  interaction: InfiniteCanvasGroupGutterInteraction,
  point: InfiniteCanvasPoint,
): InfiniteCanvasState<Kind> {
  const worldDelta = getInteractionWorldDelta(state, interaction, point);
  const weights = getInfiniteCanvasGroupGutterWeights(interaction.originContainer, interaction, {
    availableExtent: interaction.availableExtent,
    delta: interaction.axis === "horizontal" ? worldDelta.x : worldDelta.y,
  });

  if (Object.keys(weights).length === 0) {
    return state;
  }

  return setInfiniteCanvasGroupChildWeightsInState(state, {
    containerId: interaction.containerId,
    groupId: interaction.groupId,
    weights,
  });
}

function beginMove<Kind extends string>({
  currentState,
  point,
  pointerId,
  target,
  undock = false,
}: Omit<
  InfiniteCanvasActionInput<"interaction.startMove", Kind>,
  "type"
>): InfiniteCanvasState<Kind> {
  const state =
    undock && target.type === "window"
      ? undockInfiniteCanvasWindowFromGroup(currentState, { windowId: target.id })
      : currentState;
  const resolved = resolveInfiniteCanvasMoveTarget({ state, target });
  if (resolved === null) return currentState;
  const selected =
    target.type === "window"
      ? isSelectionTargetSelected(state.selection, { type: "window", id: target.id })
      : isSelectionTargetSelected(state.selection, target);
  const focusedState = {
    window: () =>
      selected ? focusWindowPreservingSelection(state, target.id) : focusWindow(state, target.id),
    group: () =>
      selected
        ? state
        : updateSelection(state, {
            mode: "replace",
            targets: [{ id: target.id, type: "group", kind: "group" }],
          }),
  }[target.type]();
  return {
    ...focusedState,
    interaction: {
      delta: { x: 0, y: 0 },
      dockPreview: null,
      kind: "move",
      originPointer: point,
      originRects: getInfiniteCanvasMovableSelection(focusedState),
      pointerId,
      target:
        resolved.type === "group"
          ? { type: "group", id: resolved.group.id }
          : { type: "window", id: resolved.window.id },
      originCamera: focusedState.camera,
    },
    snapPreview: null,
  };
}

function beginWindowResize<Kind extends string>({
  currentState: state,
  handle,
  point,
  pointerId,
  windowId,
}: InfiniteCanvasActionInput<"interaction.startResize", Kind>): InfiniteCanvasState<Kind> {
  const targetWindow = findWindow(state, windowId);
  const originRect = getTargetBounds({ state, target: { type: "window", id: windowId } });

  if (
    targetWindow === null ||
    originRect === null ||
    (isInfiniteCanvasWindowGrouped(state, windowId) &&
      getWindowLayoutMembership(state, windowId)?.operations?.resize === undefined) ||
    !isInfiniteCanvasWindowCapable(targetWindow, "resizable")
  ) {
    return state;
  }

  const focusedState = focusWindow(state, windowId);

  return {
    ...focusedState,
    interaction: {
      handle,
      kind: "resize",
      originPointer: point,
      originRect,
      pointerId,
      windowId,
      originCamera: focusedState.camera,
    },
    snapPreview: null,
    windows: focusedState.windows.map((window) => {
      if (window.id !== windowId || window.heightMode === "manual") return window;
      return { ...window, heightMode: "manual" as const };
    }),
  };
}

function stepCanvasInteraction<Kind extends string>(
  state: InfiniteCanvasState<Kind>,
  pointerId: number,
  point: InfiniteCanvasPoint,
  snapPolicy?: InfiniteCanvasSnapPolicy,
  options: Readonly<{ dockIntent?: boolean }> = {},
): InfiniteCanvasState<Kind> {
  const interaction = state.interaction;

  if (interaction === null || interaction.pointerId !== pointerId) {
    return state;
  }

  if (interaction.kind === "groupReorder") return state;

  if (interaction.kind === "pan") {
    const worldAtOrigin = screenPointToWorldPoint(
      interaction.originCamera,
      state.viewport,
      interaction.originPointer,
    );

    return {
      ...state,
      camera: {
        ...state.camera,
        center: {
          x: worldAtOrigin.x - (point.x - state.viewport.width / 2) / state.camera.zoom,
          y: worldAtOrigin.y - (point.y - state.viewport.height / 2) / state.camera.zoom,
        },
      },
    };
  }

  if (interaction.kind === "marquee") {
    return stepMarqueeSelection(state, interaction, point);
  }

  if (interaction.kind === "groupGutter") {
    return stepInfiniteCanvasGroupGutterDrag(state, interaction, point);
  }

  if (interaction.kind === "groupResize") {
    return stepInfiniteCanvasGroupResize(state, interaction, point);
  }

  if (interaction.kind === "move")
    return stepMove(state, interaction, point, snapPolicy, options.dockIntent === true);

  const targetWindow = findWindow(state, interaction.windowId);

  if (targetWindow === null) {
    return {
      ...state,
      interaction: null,
    };
  }

  const worldDelta = getInteractionWorldDelta(state, interaction, point);

  const membership = getWindowLayoutMembership(state, interaction.windowId);

  if (membership?.operations?.resize === undefined)
    return stepWindowResize(
      state,
      interaction,
      worldDelta,
      targetWindow.minSize,
      snapPolicy,
      targetWindow.aspectRatio,
    );
  return resizeLayoutMember(
    state,
    interaction.windowId,
    resizeRectFromHandle(
      interaction.originRect,
      interaction.handle,
      worldDelta,
      {
        width: 0,
        height: 0,
      },
      targetWindow.aspectRatio,
    ),
    interaction.handle,
  );
}

function getMarqueeWorldRect<Kind extends string>(
  state: InfiniteCanvasState<Kind>,
  interaction: InfiniteCanvasMarqueeInteraction,
) {
  return getRectFromPoints(
    screenPointToWorldPoint(state.camera, state.viewport, interaction.originPointer),
    screenPointToWorldPoint(state.camera, state.viewport, interaction.currentPointer),
  );
}

function getMarqueeHitWindowIds<Kind extends string>(
  state: InfiniteCanvasState<Kind>,
  interaction: InfiniteCanvasMarqueeInteraction,
) {
  const marqueeRect = getMarqueeWorldRect(state, interaction);

  const geometry = getCanvasLayout(state);
  return [...geometry.visibleWindowIds].filter((windowId) =>
    rectsIntersect(geometry.windowRects.get(windowId)!, marqueeRect),
  );
}

function stepMarqueeSelection<Kind extends string>(
  state: InfiniteCanvasState<Kind>,
  interaction: InfiniteCanvasMarqueeInteraction,
  point: InfiniteCanvasPoint,
) {
  const nextInteraction = {
    ...interaction,
    currentPointer: point,
  };
  return updateSelection(
    {
      ...state,
      interaction: nextInteraction,
      selection: interaction.originSelection,
    },
    {
      mode: interaction.mode,
      targets: getMarqueeHitWindowIds(state, nextInteraction).map((id) => ({ type: "window", id })),
    },
  );
}

function stepMove<Kind extends string>(
  state: InfiniteCanvasState<Kind>,
  interaction: InfiniteCanvasMoveInteraction,
  point: InfiniteCanvasPoint,
  snapPolicy: InfiniteCanvasSnapPolicy | undefined,
  dockIntent: boolean,
): InfiniteCanvasState<Kind> {
  const target = interaction.target;
  const targetOrigin = interaction.originRects.find(
    (origin) => origin.target.type === target.type && origin.target.id === target.id,
  );
  const resolved = resolveInfiniteCanvasMoveTarget({ state, target });

  if (targetOrigin === undefined || resolved === null) {
    return { ...state, interaction: null, snapPreview: null };
  }

  const currentBounds = getTargetBounds({ state, target });

  if (currentBounds === null) {
    return { ...state, interaction: null, snapPreview: null };
  }

  const worldDelta = getInteractionWorldDelta(state, interaction, point);
  const originRect = {
    ...currentBounds,
    x: targetOrigin.bounds.x,
    y: targetOrigin.bounds.y,
  };
  const unsnappedRect = {
    ...originRect,
    x: originRect.x + worldDelta.x,
    y: originRect.y + worldDelta.y,
  };
  const membership = target.type === "window" ? getWindowLayoutMembership(state, target.id) : null;
  const worldPoint = screenPointToWorldPoint(state.camera, state.viewport, point);

  if (membership?.operations?.move !== undefined) {
    const shell = getTargetBounds({
      state,
      target: { type: "group", id: membership.group.id },
    });
    const staysInGrid =
      shell === null ||
      (worldPoint.x >= shell.x && worldPoint.x <= shell.x + shell.width && worldPoint.y >= shell.y);
    if (!staysInGrid) {
      const undocked = undockInfiniteCanvasWindowFromGroup(state, {
        windowId: target.id,
        rect: unsnappedRect,
      });
      if (undocked === state) return state;
      return stepMove(undocked, interaction, point, snapPolicy, dockIntent);
    }
    const moved = moveInfiniteCanvasTargets({
      state,
      origins: interaction.originRects,
      delta: worldDelta,
    });

    return {
      ...moved,
      interaction: { ...interaction, delta: worldDelta, dockPreview: null },
      snapPreview: null,
    };
  }

  const dockPreview = resolveInfiniteCanvasDockPreview({ state, worldPoint, dockIntent });
  const excludedWindowIds = interaction.originRects.flatMap((origin) => {
    if (origin.target.type === "window") return [origin.target.id];
    const group = findInfiniteCanvasGroup(state, origin.target.id);
    if (group === null) return [];
    return getInfiniteCanvasGroupWindowIds(group.tree);
  });
  const snapResult = applySnapToRect(
    state,
    target,
    unsnappedRect,
    dockPreview === null && snapPolicy,
    excludedWindowIds,
  );
  const snappedDelta = {
    x: snapResult.rect.x - originRect.x,
    y: snapResult.rect.y - originRect.y,
  };
  const moved = moveInfiniteCanvasTargets({
    state,
    origins: interaction.originRects,
    delta: snappedDelta,
  });

  return {
    ...moved,
    interaction: { ...interaction, delta: snappedDelta, dockPreview },
    snapPreview: snapResult.preview,
  };
}

function stepWindowResize<Kind extends string>(
  state: InfiniteCanvasState<Kind>,
  interaction: InfiniteCanvasResizeInteraction,
  worldDelta: InfiniteCanvasPoint,
  minSize: InfiniteCanvasState<Kind>["windows"][number]["minSize"],
  snapPolicy?: InfiniteCanvasSnapPolicy,
  aspectRatio?: number,
): InfiniteCanvasState<Kind> {
  const unsnappedRect = resizeRectFromHandle(
    interaction.originRect,
    interaction.handle,
    worldDelta,
    minSize,
    aspectRatio,
  );
  const snapResult = applyResizeSnapToRect(
    state,
    interaction.windowId,
    unsnappedRect,
    interaction.handle,
    minSize,
    snapPolicy,
    aspectRatio,
  );

  return {
    ...updateWindowRect(state, interaction.windowId, snapResult.rect),
    snapPreview: snapResult.preview,
  };
}

function finishCanvasInteraction<Kind extends string>(
  state: InfiniteCanvasState<Kind>,
  pointerId: number,
): InfiniteCanvasState<Kind> {
  const interaction = state.interaction;

  if (interaction?.pointerId !== pointerId) {
    return state;
  }

  if (interaction.kind === "move" && interaction.dockPreview !== null) {
    return {
      ...applyInfiniteCanvasDockPreview(state, interaction.dockPreview),
      interaction: null,
      snapPreview: null,
    };
  }

  return {
    ...state,
    interaction: null,
    snapPreview: null,
  };
}

function isInteractionWindowStable<Kind extends string>(
  state: InfiniteCanvasState<Kind>,
  previousState: InfiniteCanvasState<Kind>,
  windowId: string,
) {
  const window = findWindow(state, windowId);
  const previousWindow = findWindow(previousState, windowId);

  return (
    window !== null &&
    previousWindow !== null &&
    window.mode !== "minimized" &&
    window.mode === previousWindow.mode
  );
}

function isInteractionGroupStable<Kind extends string>(
  state: InfiniteCanvasState<Kind>,
  previousState: InfiniteCanvasState<Kind>,
  groupId: string,
) {
  const group = findInfiniteCanvasGroup(state, groupId);
  const previousGroup = findInfiniteCanvasGroup(previousState, groupId);

  if (group === null || previousGroup === null) return false;

  const windowIds = getInfiniteCanvasGroupWindowIds(group.tree);
  const previousWindowIds = getInfiniteCanvasGroupWindowIds(previousGroup.tree);

  if (
    windowIds.length !== previousWindowIds.length ||
    windowIds.some((windowId) => !previousWindowIds.includes(windowId))
  ) {
    return false;
  }

  return windowIds.every((windowId) => isInteractionWindowStable(state, previousState, windowId));
}

function isMoveTargetStable<Kind extends string>(
  state: InfiniteCanvasState<Kind>,
  previousState: InfiniteCanvasState<Kind>,
  target: InfiniteCanvasMoveInteraction["target"],
) {
  if (target.type === "group") {
    return isInteractionGroupStable(state, previousState, target.id);
  }
  if (!isInteractionWindowStable(state, previousState, target.id)) return false;
  const resolved = resolveInfiniteCanvasMoveTarget({ state, target });
  return resolved !== null && resolved.type === "window";
}

function isInteractionStable<Kind extends string>(
  state: InfiniteCanvasState<Kind>,
  previousState: InfiniteCanvasState<Kind>,
) {
  const interaction = state.interaction;

  if (interaction === null || interaction.kind === "pan" || interaction.kind === "marquee") {
    return true;
  }
  if (interaction.kind === "resize") {
    const window = findWindow(state, interaction.windowId);
    return (
      isInteractionWindowStable(state, previousState, interaction.windowId) &&
      isInfiniteCanvasWindowCapable(window, "resizable") &&
      (!isInfiniteCanvasWindowGrouped(state, interaction.windowId) ||
        getWindowLayoutMembership(state, interaction.windowId)?.operations?.resize !== undefined)
    );
  }
  if (interaction.kind === "move") {
    return (
      isMoveTargetStable(state, previousState, interaction.target) &&
      interaction.originRects.every(({ target }) =>
        isMoveTargetStable(state, previousState, target),
      )
    );
  }
  if (!isInteractionGroupStable(state, previousState, interaction.groupId)) return false;
  if (interaction.kind === "groupGutter") {
    const gutter = getCanvasLayout(state)
      .layouts.get(interaction.groupId)
      ?.gutters.find(
        (gutter) =>
          gutter.containerId === interaction.containerId &&
          gutter.beforeChildId === interaction.beforeChildId &&
          gutter.afterChildId === interaction.afterChildId,
      );
    return (
      gutter !== undefined &&
      gutter.axis === interaction.axis &&
      gutter.availableExtent === interaction.availableExtent
    );
  }
  return true;
}

function isDockPreviewTargetPresent<Kind extends string>(
  state: InfiniteCanvasState<Kind>,
  interaction: InfiniteCanvasMoveInteraction,
) {
  const preview = interaction.dockPreview;

  if (preview === null) return true;
  const geometry = getCanvasLayout(state);
  if (!geometry.visibleWindowIds.has(preview.windowId)) return false;
  if (preview.groupId === null) {
    return (
      geometry.visibleWindowIds.has(preview.targetId) &&
      !isInfiniteCanvasWindowGrouped(state, preview.targetId)
    );
  }
  const group = findInfiniteCanvasGroup(state, preview.groupId);
  if (group === null || !geometry.visibleGroupIds.has(group.id)) return false;
  const target = findInfiniteCanvasGroupNode(group.tree, preview.targetId);
  return target !== null && (target.kind !== "window" || geometry.visibleWindowIds.has(target.id));
}

function isSnapPreviewValid<Kind extends string>(state: InfiniteCanvasState<Kind>) {
  const preview = state.snapPreview;

  if (preview === null) return true;
  const geometry = getCanvasLayout(state);
  const targets = { group: geometry.visibleGroupIds, window: geometry.visibleWindowIds };
  if (preview.target != null && !targets[preview.target.type].has(preview.target.id)) return false;
  return preview.guides.every((guide) =>
    guide.windowIds.every((id) => geometry.visibleWindowIds.has(id)),
  );
}

function reconcileInfiniteCanvasInteraction<Kind extends string>({
  previousState,
  state,
}: Readonly<{
  previousState: InfiniteCanvasState<Kind>;
  state: InfiniteCanvasState<Kind>;
}>): InfiniteCanvasState<Kind> {
  if (!isInteractionStable(state, previousState)) {
    return { ...state, interaction: null, snapPreview: null };
  }

  const interaction = state.interaction;
  const hasStaleDockPreview =
    interaction?.kind === "move" && !isDockPreviewTargetPresent(state, interaction);
  const hasStaleSnapPreview = !isSnapPreviewValid(state);

  if (!hasStaleDockPreview && !hasStaleSnapPreview) return state;
  if (hasStaleDockPreview && interaction?.kind === "move") {
    return {
      ...state,
      interaction: { ...interaction, dockPreview: null },
      snapPreview: hasStaleSnapPreview ? null : state.snapPreview,
    };
  }
  return { ...state, snapPreview: null };
}

const NO_POINTER_OWNED_IDS = { groupIds: new Set<string>(), windowIds: new Set<string>() };

/** Identifies frames that must follow pointer updates without transitions. */
function getInfiniteCanvasPointerOwnedIds<Kind extends string>(
  state: InfiniteCanvasState<Kind>,
): Readonly<{ groupIds: ReadonlySet<string>; windowIds: ReadonlySet<string> }> {
  const interaction = state.interaction;

  if (interaction === null) {
    return NO_POINTER_OWNED_IDS;
  }

  if (interaction.kind === "move") {
    const groupIds = new Set(
      interaction.originRects
        .filter(({ target }) => target.type === "group")
        .map(({ target }) => target.id),
    );
    return {
      groupIds,
      windowIds: new Set([
        ...interaction.originRects
          .filter(({ target }) => target.type === "window")
          .map(({ target }) => target.id),
        ...state.groups
          .filter((group) => groupIds.has(group.id))
          .flatMap((group) => getInfiniteCanvasGroupWindowIds(group.tree)),
      ]),
    };
  }

  // Grid resizing animates between cells; floating resizing follows the pointer.
  if (interaction.kind === "resize") {
    return getWindowLayoutMembership(state, interaction.windowId)?.operations?.resize === undefined
      ? { groupIds: NO_POINTER_OWNED_IDS.groupIds, windowIds: new Set([interaction.windowId]) }
      : NO_POINTER_OWNED_IDS;
  }

  if (interaction.kind === "groupResize" || interaction.kind === "groupGutter") {
    const group = findInfiniteCanvasGroup(state, interaction.groupId);

    return {
      groupIds: new Set([interaction.groupId]),
      windowIds: new Set(group === null ? [] : getInfiniteCanvasGroupWindowIds(group.tree)),
    };
  }

  return NO_POINTER_OWNED_IDS;
}

function getInteractionCursor(interaction: InfiniteCanvasState["interaction"]) {
  if (interaction === null) {
    return undefined;
  }

  if (
    interaction.kind === "pan" ||
    interaction.kind === "move" ||
    interaction.kind === "groupReorder"
  ) {
    return "grabbing";
  }

  if (interaction.kind === "marquee") {
    return "crosshair";
  }

  if (interaction.kind === "groupGutter") {
    return interaction.axis === "horizontal" ? "ew-resize" : "ns-resize";
  }

  switch (interaction.handle) {
    case "east":
    case "west":
      return "ew-resize";
    case "north":
    case "south":
      return "ns-resize";
    case "north-east":
    case "south-west":
      return "nesw-resize";
    case "north-west":
    case "south-east":
      return "nwse-resize";
  }
}

export {
  beginCanvasPan,
  beginInfiniteCanvasGroupGutterDrag,
  beginInfiniteCanvasGroupResize,
  beginMarqueeSelection,
  beginMove,
  beginWindowResize,
  finishCanvasInteraction,
  getInfiniteCanvasPointerOwnedIds,
  getInteractionCursor,
  reconcileInfiniteCanvasInteraction,
  stepCanvasInteraction,
};
