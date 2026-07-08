import {
  getRectFromPoints,
  rectsIntersect,
  resizeRectFromHandle,
  screenPointToWorldPoint,
  subtractPoints,
} from "./geometry";
import {
  getInfiniteCanvasGroupGutterWeights,
  getInfiniteCanvasGroupMinimumSize,
} from "./group-layout";
import {
  applyInfiniteCanvasDockPreview,
  resolveInfiniteCanvasDockPreview,
  setInfiniteCanvasGroupChildWeightsInState,
  setInfiniteCanvasGroupRect,
} from "./group-state";
import { clearSelection, isWindowSelected, replaceSelection } from "./selection";
import { applyResizeSnapToRect, applySnapToRect } from "./snap";
import {
  findWindow,
  focusWindow,
  focusWindowPreservingSelection,
  updateWindowRect,
} from "./stacking";
import type {
  InfiniteCanvasGroup,
  InfiniteCanvasGroupGutterInteraction,
  InfiniteCanvasGroupResizeInteraction,
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

/**
 * Drag a group shell by one of its members' headers. The whole group travels as
 * one world object (DOCK-003); the members follow because their rects are
 * re-derived from the shell, never stored.
 */
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
      zoom: state.camera.zoom,
    },
    snapPreview: null,
  };
}

/**
 * Drag a group shell's outer edge.
 *
 * The structural minimum is resolved once, at drag start, from the tree as it stands.
 * Re-deriving it every step would let a mode change mid-drag move the floor under the
 * pointer; capturing it means the shell stops exactly where it stopped.
 */
function beginInfiniteCanvasGroupResize<Kind extends string>(
  state: InfiniteCanvasState<Kind>,
  pointerId: number,
  group: InfiniteCanvasGroup,
  handle: InfiniteCanvasResizeHandle,
  point: InfiniteCanvasPoint,
): InfiniteCanvasState<Kind> {
  return {
    ...state,
    interaction: {
      groupId: group.id,
      handle,
      kind: "groupResize",
      minSize: getInfiniteCanvasGroupMinimumSize(group.tree),
      originPointer: point,
      originRect: group.rect,
      pointerId,
      zoom: state.camera.zoom,
    },
    snapPreview: null,
  };
}

/**
 * Resize from the rect the shell had when the drag began, never from its live rect.
 *
 * `resizeRectFromHandle` clamps against `minSize`, so once the shell is at its floor the
 * pointer can travel further without the rect moving — and travelling back must return it
 * step for step. Applying an incremental delta to the live rect would instead lose every
 * pixel spent past the clamp, and the edge would lag the cursor by however far it was
 * over-dragged. This is the same reason a gutter drag recomputes from `originContainer`.
 */
function stepInfiniteCanvasGroupResize<Kind extends string>(
  state: InfiniteCanvasState<Kind>,
  interaction: InfiniteCanvasGroupResizeInteraction,
  point: InfiniteCanvasPoint,
): InfiniteCanvasState<Kind> {
  const screenDelta = subtractPoints(point, interaction.originPointer);
  const worldDelta = {
    x: screenDelta.x / interaction.zoom,
    y: screenDelta.y / interaction.zoom,
  };

  return setInfiniteCanvasGroupRect(state, {
    groupId: interaction.groupId,
    rect: resizeRectFromHandle(
      interaction.originRect,
      interaction.handle,
      worldDelta,
      interaction.minSize,
    ),
  });
}

/** Drag the seam between two split panes. Everything a step needs is captured here. */
function beginInfiniteCanvasGroupGutterDrag<Kind extends string>(
  state: InfiniteCanvasState<Kind>,
  input: Omit<InfiniteCanvasGroupGutterInteraction, "kind" | "zoom">,
): InfiniteCanvasState<Kind> {
  return {
    ...state,
    interaction: {
      ...input,
      kind: "groupGutter",
      zoom: state.camera.zoom,
    },
    snapPreview: null,
  };
}

function stepInfiniteCanvasGroupMove<Kind extends string>(
  state: InfiniteCanvasState<Kind>,
  interaction: InfiniteCanvasGroupMoveInteraction,
  point: InfiniteCanvasPoint,
): InfiniteCanvasState<Kind> {
  const screenDelta = subtractPoints(point, interaction.originPointer);

  return setInfiniteCanvasGroupRect(state, {
    groupId: interaction.groupId,
    rect: {
      ...interaction.originRect,
      x: interaction.originRect.x + screenDelta.x / interaction.zoom,
      y: interaction.originRect.y + screenDelta.y / interaction.zoom,
    },
  });
}

/**
 * Recompute the pair's weights from the container as it stood when the drag
 * began, and the total pointer travel since. Deriving from the origin rather
 * than applying an incremental delta to live weights is what keeps the seam
 * exactly under the cursor instead of drifting as rounding accumulates.
 */
function stepInfiniteCanvasGroupGutterDrag<Kind extends string>(
  state: InfiniteCanvasState<Kind>,
  interaction: InfiniteCanvasGroupGutterInteraction,
  point: InfiniteCanvasPoint,
): InfiniteCanvasState<Kind> {
  const screenDelta = subtractPoints(point, interaction.originPointer);
  const alongAxis = interaction.axis === "horizontal" ? screenDelta.x : screenDelta.y;
  const weights = getInfiniteCanvasGroupGutterWeights(interaction.originContainer, interaction, {
    availableExtent: interaction.availableExtent,
    delta: alongAxis / interaction.zoom,
  });

  // `{}` means the pair has no room left to move; the drag continues, nothing shifts.
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
      zoom: focusedState.camera.zoom,
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
          zoom: focusedState.camera.zoom,
        },
        snapPreview: null,
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
    const delta = subtractPoints(point, interaction.originPointer);

    return {
      ...state,
      camera: {
        ...interaction.originCamera,
        center: {
          x: interaction.originCamera.center.x - delta.x / interaction.originCamera.zoom,
          y: interaction.originCamera.center.y - delta.y / interaction.originCamera.zoom,
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

  const screenDelta = subtractPoints(point, interaction.originPointer);
  const worldDelta = {
    x: screenDelta.x / interaction.zoom,
    y: screenDelta.y / interaction.zoom,
  };

  if (interaction.kind === "resize") {
    return stepWindowResize(state, interaction, worldDelta, targetWindow.minSize, snapPolicy);
  }

  // Docking is an explicit intent, never something a drag falls into. Without it
  // a window could not be dragged over another to overlap it -- which is most of
  // what an infinite canvas is for. A multi-window group move cannot dock either:
  // there is no single window to seat against the target.
  const dockPreview =
    options.dockIntent === true && interaction.originRects.length === 1
      ? resolveInfiniteCanvasDockPreview(
          state,
          screenPointToWorldPoint(state.camera, state.viewport, point),
          interaction.windowId,
        )
      : null;
  // Alignment guides and a dock region are contradictory affordances. Once the
  // user is aiming at a drop target, stop offering to line them up with a
  // neighbour instead (research/snapping.md, risk R3).
  const moved = stepWindowMove(
    state,
    interaction,
    worldDelta,
    dockPreview === null ? snapPolicy : undefined,
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
  snapPolicy?: InfiniteCanvasSnapPolicy,
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

/**
 * Releasing over a dock region commits the dock; releasing anywhere else simply
 * ends the drag, leaving the window where it was dropped. The preview the user
 * was looking at is exactly what gets applied — it is the same value, not a
 * re-resolution against a pointer that has since moved.
 */
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

  return {
    ...docked,
    interaction: null,
    snapPreview: null,
  };
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
  getInteractionCursor,
  stepCanvasInteraction,
};
