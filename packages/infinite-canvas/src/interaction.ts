import {
  getRectFromPoints,
  rectsIntersect,
  resizeRectFromHandle,
  screenPointToWorldPoint,
  subtractPoints,
} from "./geometry";
import { getInfiniteCanvasGroupGutterWeights } from "./group-layout";
import { getInfiniteCanvasGroupWindowIds } from "./group-tree";
import {
  MASONRY_RESIZE_HANDLE_AXIS,
  applyInfiniteCanvasDockPreview,
  findInfiniteCanvasGroup,
  getInfiniteCanvasMasonryMembership,
  moveInfiniteCanvasMasonryMember,
  resizeInfiniteCanvasMasonryMember,
  resolveInfiniteCanvasDockPreview,
  resolveInfiniteCanvasLatticeDropPreview,
  setInfiniteCanvasGroupChildWeightsInState,
  setInfiniteCanvasGroupRect,
  syncInfiniteCanvasGroupWindowRects,
  undockInfiniteCanvasWindowFromGroup,
} from "./group-state";
import { clearSelection, isWindowSelected, replaceSelection } from "./selection";
import { applyResizeSnapToRect, applySnapToRect } from "./snap-resolver";
import {
  findWindow,
  focusWindow,
  focusWindowPreservingSelection,
  updateWindowRect,
} from "./stacking";
import type {
  InfiniteCanvasCamera,
  InfiniteCanvasGroup,
  InfiniteCanvasGroupGutterInteraction,
  InfiniteCanvasGroupResizeInteraction,
  InfiniteCanvasSize,
  InfiniteCanvasGroupMoveInteraction,
  InfiniteCanvasMarqueeInteraction,
  InfiniteCanvasMarqueeMode,
  InfiniteCanvasMoveInteraction,
  InfiniteCanvasPoint,
  InfiniteCanvasResizeHandle,
  InfiniteCanvasResizeInteraction,
  InfiniteCanvasSnapPolicy,
  InfiniteCanvasState,
} from "./types";

function beginCanvasPan<Kind extends string>(
  state: InfiniteCanvasState<Kind>,
  pointerId: number,
  point: InfiniteCanvasPoint,
  clearSelectionOnStart = false,
): InfiniteCanvasState<Kind> {
  return {
    ...(clearSelectionOnStart ? clearSelection(state) : state),
    interaction: {
      kind: "pan",
      originCamera: state.camera,
      originPointer: point,
      pointerId,
    },
    snapPreview: null,
  };
}

function beginMarqueeSelection<Kind extends string>(
  state: InfiniteCanvasState<Kind>,
  pointerId: number,
  point: InfiniteCanvasPoint,
  mode: InfiniteCanvasMarqueeMode,
): InfiniteCanvasState<Kind> {
  const nextState = {
    ...state,
    interaction: {
      currentPointer: point,
      kind: "marquee",
      mode,
      originPointer: point,
      originSelectionIds: state.selection.windowIds,
      pointerId,
    },
    snapPreview: null,
  } satisfies InfiniteCanvasState<Kind>;

  return mode === "replace" ? replaceSelection(nextState, []) : nextState;
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

/** Starts a group move from a member header. */
function beginInfiniteCanvasGroupMove<Kind extends string>(
  state: InfiniteCanvasState<Kind>,
  pointerId: number,
  group: InfiniteCanvasGroup,
  point: InfiniteCanvasPoint,
): InfiniteCanvasState<Kind> {
  return {
    ...state,
    interaction: {
      groupId: group.id,
      kind: "groupMove",
      originPointer: point,
      originRect: group.rect,
      pointerId,
      originCamera: state.camera,
    },
    snapPreview: null,
  };
}

/** Starts a group resize with metrics captured for the complete drag. */
function beginInfiniteCanvasGroupResize<Kind extends string>(
  state: InfiniteCanvasState<Kind>,
  pointerId: number,
  group: InfiniteCanvasGroup,
  handle: InfiniteCanvasResizeHandle,
  minSize: InfiniteCanvasSize,
  point: InfiniteCanvasPoint,
): InfiniteCanvasState<Kind> {
  return {
    ...state,
    interaction: {
      groupId: group.id,
      handle,
      kind: "groupResize",
      minSize,
      originPointer: point,
      originRect: group.rect,
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
  return setInfiniteCanvasGroupRect(state, {
    groupId: interaction.groupId,
    rect: resizeRectFromHandle(
      interaction.originRect,
      interaction.handle,
      getInteractionWorldDelta(state, interaction, point),
      interaction.minSize,
    ),
  });
}

/** Starts a split-seam drag with all values required by each step. */
function beginInfiniteCanvasGroupGutterDrag<Kind extends string>(
  state: InfiniteCanvasState<Kind>,
  input: Omit<InfiniteCanvasGroupGutterInteraction, "kind" | "originCamera">,
): InfiniteCanvasState<Kind> {
  return {
    ...state,
    interaction: {
      ...input,
      kind: "groupGutter",
      originCamera: state.camera,
    },
    snapPreview: null,
  };
}

function stepInfiniteCanvasGroupMove<Kind extends string>(
  state: InfiniteCanvasState<Kind>,
  interaction: InfiniteCanvasGroupMoveInteraction,
  point: InfiniteCanvasPoint,
): InfiniteCanvasState<Kind> {
  const worldDelta = getInteractionWorldDelta(state, interaction, point);

  return setInfiniteCanvasGroupRect(state, {
    groupId: interaction.groupId,
    rect: {
      ...interaction.originRect,
      x: interaction.originRect.x + worldDelta.x,
      y: interaction.originRect.y + worldDelta.y,
    },
  });
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

function beginWindowMove<Kind extends string>(
  state: InfiniteCanvasState<Kind>,
  pointerId: number,
  windowId: string,
  point: InfiniteCanvasPoint,
): InfiniteCanvasState<Kind> {
  const shouldMoveSelection =
    isWindowSelected(state, windowId) && state.selection.windowIds.length > 1;
  const focusedState = shouldMoveSelection
    ? focusWindowPreservingSelection(state, windowId)
    : focusWindow(state, windowId);
  const targetWindow = findWindow(focusedState, windowId);

  if (targetWindow === null) {
    return state;
  }

  const movingWindowIds = shouldMoveSelection ? focusedState.selection.windowIds : [windowId];
  const selectedOriginRects = focusedState.windows
    .filter((window) => movingWindowIds.includes(window.id))
    .map((window) => ({
      rect: window.rect,
      windowId: window.id,
    }));
  const originRects = selectedOriginRects.some((origin) => origin.windowId === windowId)
    ? selectedOriginRects
    : [
        {
          rect: targetWindow.rect,
          windowId,
        },
      ];

  return {
    ...focusedState,
    interaction: {
      dockPreview: null,
      kind: "move",
      originPointer: point,
      originRect: targetWindow.rect,
      originRects,
      pointerId,
      windowId,
      originCamera: focusedState.camera,
    },
    snapPreview: null,
  };
}

function beginWindowResize<Kind extends string>(
  state: InfiniteCanvasState<Kind>,
  pointerId: number,
  windowId: string,
  handle: InfiniteCanvasResizeHandle,
  point: InfiniteCanvasPoint,
): InfiniteCanvasState<Kind> {
  const focusedState = focusWindow(state, windowId);
  const targetWindow = findWindow(focusedState, windowId);

  return targetWindow === null
    ? state
    : {
        ...focusedState,
        interaction: {
          handle,
          kind: "resize",
          originPointer: point,
          originRect: targetWindow.rect,
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

  if (interaction.kind === "groupMove") {
    return stepInfiniteCanvasGroupMove(state, interaction, point);
  }

  if (interaction.kind === "groupGutter") {
    return stepInfiniteCanvasGroupGutterDrag(state, interaction, point);
  }

  if (interaction.kind === "groupResize") {
    return stepInfiniteCanvasGroupResize(state, interaction, point);
  }

  const targetWindow = findWindow(state, interaction.windowId);

  if (targetWindow === null) {
    return {
      ...state,
      interaction: null,
    };
  }

  const worldDelta = getInteractionWorldDelta(state, interaction, point);

  const membership = getInfiniteCanvasMasonryMembership(state, interaction.windowId);

  if (interaction.kind === "resize") {
    if (membership === null) {
      return stepWindowResize(state, interaction, worldDelta, targetWindow.minSize, snapPolicy);
    }

    // Grid constraints convert pointer geometry to cells.
    return resizeInfiniteCanvasMasonryMember(
      state,
      interaction.windowId,
      resizeRectFromHandle(interaction.originRect, interaction.handle, worldDelta, {
        width: 0,
        height: 0,
      }),
      MASONRY_RESIZE_HANDLE_AXIS[interaction.handle],
    );
  }

  // Leaving a grid through its sides or top detaches the dragged member.

  if (membership !== null) {
    const moved = stepWindowMove(state, interaction, worldDelta, false);
    const worldPoint = screenPointToWorldPoint(state.camera, state.viewport, point);
    const shell = membership.group.rect;

    return worldPoint.x >= shell.x &&
      worldPoint.x <= shell.x + shell.width &&
      worldPoint.y >= shell.y
      ? moveInfiniteCanvasMasonryMember(moved, interaction.windowId)
      : undockInfiniteCanvasWindowFromGroup(moved, {
          rect: moved.windows.find((window) => window.id === interaction.windowId)?.rect,
          windowId: interaction.windowId,
        });
  }

  // Grid drops are automatic; other docking requires explicit intent.
  const worldPoint = screenPointToWorldPoint(state.camera, state.viewport, point);
  const resolvePreview =
    options.dockIntent === true
      ? resolveInfiniteCanvasDockPreview
      : resolveInfiniteCanvasLatticeDropPreview;
  const dockPreview =
    interaction.originRects.length !== 1
      ? null
      : resolvePreview(state, worldPoint, interaction.windowId);
  const moved = stepWindowMove(
    state,
    interaction,
    worldDelta,
    dockPreview === null ? snapPolicy : false,
  );

  return moved.interaction === null || moved.interaction.kind !== "move"
    ? moved
    : { ...moved, interaction: { ...moved.interaction, dockPreview } };
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

  return state.windows
    .filter((window) => window.mode !== "minimized" && rectsIntersect(window.rect, marqueeRect))
    .map((window) => window.id);
}

function getMarqueeSelectionIds(
  originSelectionIds: readonly string[],
  hitWindowIds: readonly string[],
  mode: InfiniteCanvasMarqueeMode,
) {
  switch (mode) {
    case "add":
      return [...originSelectionIds, ...hitWindowIds];
    case "replace":
      return hitWindowIds;
    case "toggle":
      return [
        ...originSelectionIds.filter((windowId) => !hitWindowIds.includes(windowId)),
        ...hitWindowIds.filter((windowId) => !originSelectionIds.includes(windowId)),
      ];
  }
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
  const selectedWindowIds = getMarqueeSelectionIds(
    interaction.originSelectionIds,
    getMarqueeHitWindowIds(state, nextInteraction),
    interaction.mode,
  );

  return replaceSelection(
    {
      ...state,
      interaction: nextInteraction,
    },
    selectedWindowIds,
  );
}

function stepWindowMove<Kind extends string>(
  state: InfiniteCanvasState<Kind>,
  interaction: InfiniteCanvasMoveInteraction,
  worldDelta: InfiniteCanvasPoint,
  snapPolicy?: InfiniteCanvasSnapPolicy | false,
): InfiniteCanvasState<Kind> {
  const targetOrigin = interaction.originRects.find(
    (origin) => origin.windowId === interaction.windowId,
  ) ?? {
    rect: interaction.originRect,
    windowId: interaction.windowId,
  };
  const unsnappedRect = {
    ...targetOrigin.rect,
    x: targetOrigin.rect.x + worldDelta.x,
    y: targetOrigin.rect.y + worldDelta.y,
  };
  const excludedWindowIds = interaction.originRects.map((origin) => origin.windowId);
  const snapResult = applySnapToRect(
    state,
    interaction.windowId,
    unsnappedRect,
    snapPolicy,
    excludedWindowIds,
  );
  const snappedDelta = {
    x: snapResult.rect.x - targetOrigin.rect.x,
    y: snapResult.rect.y - targetOrigin.rect.y,
  };

  return {
    ...state,
    snapPreview: snapResult.preview,
    windows: state.windows.map((window) => {
      const origin = interaction.originRects.find(
        (originRect) => originRect.windowId === window.id,
      );

      return origin === undefined
        ? window
        : {
            ...window,
            rect: {
              ...origin.rect,
              x: origin.rect.x + snappedDelta.x,
              y: origin.rect.y + snappedDelta.y,
            },
          };
    }),
  };
}

function stepWindowResize<Kind extends string>(
  state: InfiniteCanvasState<Kind>,
  interaction: InfiniteCanvasResizeInteraction,
  worldDelta: InfiniteCanvasPoint,
  minSize: InfiniteCanvasState<Kind>["windows"][number]["minSize"],
  snapPolicy?: InfiniteCanvasSnapPolicy,
): InfiniteCanvasState<Kind> {
  const unsnappedRect = resizeRectFromHandle(
    interaction.originRect,
    interaction.handle,
    worldDelta,
    minSize,
  );
  const snapResult = applyResizeSnapToRect(
    state,
    interaction.windowId,
    unsnappedRect,
    interaction.handle,
    minSize,
    snapPolicy,
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

  const docked =
    interaction.kind === "move" && interaction.dockPreview !== null
      ? applyInfiniteCanvasDockPreview(state, interaction.dockPreview)
      : state;

  // A released masonry member kept the pointer's rect through the drag; now its cells place it.
  return syncInfiniteCanvasGroupWindowRects({
    ...docked,
    interaction: null,
    snapPreview: null,
  });
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
    return {
      groupIds: NO_POINTER_OWNED_IDS.groupIds,
      windowIds: new Set(interaction.originRects.map((origin) => origin.windowId)),
    };
  }

  // Grid resizing animates between cells; floating resizing follows the pointer.
  if (interaction.kind === "resize") {
    return getInfiniteCanvasMasonryMembership(state, interaction.windowId) === null
      ? { groupIds: NO_POINTER_OWNED_IDS.groupIds, windowIds: new Set([interaction.windowId]) }
      : NO_POINTER_OWNED_IDS;
  }

  if (
    interaction.kind === "groupMove" ||
    interaction.kind === "groupResize" ||
    interaction.kind === "groupGutter"
  ) {
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
    interaction.kind === "groupMove"
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
  beginInfiniteCanvasGroupMove,
  beginInfiniteCanvasGroupResize,
  beginMarqueeSelection,
  beginWindowMove,
  beginWindowResize,
  finishCanvasInteraction,
  getInfiniteCanvasPointerOwnedIds,
  getInteractionCursor,
  stepCanvasInteraction,
};
