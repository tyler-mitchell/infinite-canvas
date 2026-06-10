import {
  getRectFromPoints,
  rectsIntersect,
  resizeRectFromHandle,
  screenPointToWorldPoint,
  subtractPoints,
} from "#/experiments/infinite-canvas/geometry";
import {
  clearSelection,
  isWindowSelected,
  replaceSelection,
} from "#/experiments/infinite-canvas/selection";
import { applyResizeSnapToRect, applySnapToRect } from "#/experiments/infinite-canvas/snap";
import {
  findWindow,
  focusWindow,
  focusWindowPreservingSelection,
  updateWindowRect,
} from "#/experiments/infinite-canvas/stacking";
import type {
  InfiniteCanvasMarqueeInteraction,
  InfiniteCanvasMarqueeMode,
  InfiniteCanvasMoveInteraction,
  InfiniteCanvasPoint,
  InfiniteCanvasResizeHandle,
  InfiniteCanvasResizeInteraction,
  InfiniteCanvasSnapPolicy,
  InfiniteCanvasState,
} from "#/experiments/infinite-canvas/types";

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

  return interaction.kind === "move"
    ? stepWindowMove(state, interaction, worldDelta, snapPolicy)
    : stepWindowResize(state, interaction, worldDelta, targetWindow.minSize, snapPolicy);
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

function finishCanvasInteraction<Kind extends string>(
  state: InfiniteCanvasState<Kind>,
  pointerId: number,
): InfiniteCanvasState<Kind> {
  return state.interaction?.pointerId === pointerId
    ? {
        ...state,
        interaction: null,
        snapPreview: null,
      }
    : state;
}

function getInteractionCursor(interaction: InfiniteCanvasState["interaction"]) {
  if (interaction === null) {
    return undefined;
  }

  if (interaction.kind === "pan" || interaction.kind === "move") {
    return "grabbing";
  }

  if (interaction.kind === "marquee") {
    return "crosshair";
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
  beginMarqueeSelection,
  beginWindowMove,
  beginWindowResize,
  finishCanvasInteraction,
  getInteractionCursor,
  stepCanvasInteraction,
};
