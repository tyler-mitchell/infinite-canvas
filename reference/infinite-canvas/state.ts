import type {
  InfiniteCanvasCamera,
  InfiniteCanvasRect,
  InfiniteCanvasSelection,
  InfiniteCanvasSize,
  InfiniteCanvasState,
  InfiniteCanvasWindow,
} from "#/experiments/infinite-canvas/types";

function cloneSize(size: InfiniteCanvasSize): InfiniteCanvasSize {
  return {
    height: size.height,
    width: size.width,
  };
}

function cloneRect(rect: InfiniteCanvasRect): InfiniteCanvasRect {
  return {
    height: rect.height,
    width: rect.width,
    x: rect.x,
    y: rect.y,
  };
}

function cloneCamera(camera: InfiniteCanvasCamera): InfiniteCanvasCamera {
  return {
    center: {
      x: camera.center.x,
      y: camera.center.y,
    },
    zoom: camera.zoom,
  };
}

function cloneSelection(selection: InfiniteCanvasSelection): InfiniteCanvasSelection {
  const anchorTarget =
    selection.anchorTarget === undefined || selection.anchorTarget === null
      ? selection.anchorTarget
      : {
          ...selection.anchorTarget,
        };
  const targets = selection.targets?.map((target) => ({
    ...target,
  }));

  return {
    ...(anchorTarget === undefined ? {} : { anchorTarget }),
    anchorWindowId: selection.anchorWindowId,
    ...(targets === undefined ? {} : { targets }),
    windowIds: [...selection.windowIds],
  };
}

function cloneWindow<Kind extends string>(
  window: InfiniteCanvasWindow<Kind>,
): InfiniteCanvasWindow<Kind> {
  return {
    ...window,
    minSize: cloneSize(window.minSize),
    rect: cloneRect(window.rect),
    restoreRect: window.restoreRect === undefined ? undefined : cloneRect(window.restoreRect),
  };
}

function cloneInfiniteCanvasState<Kind extends string>(
  state: InfiniteCanvasState<Kind>,
): InfiniteCanvasState<Kind> {
  return {
    ...state,
    camera: cloneCamera(state.camera),
    selection: cloneSelection(state.selection),
    viewport: cloneSize(state.viewport),
    windows: state.windows.map(cloneWindow),
  };
}

function resetInfiniteCanvasState<Kind extends string>(
  currentState: InfiniteCanvasState<Kind>,
  initialState: InfiniteCanvasState<Kind>,
) {
  return {
    ...cloneInfiniteCanvasState(initialState),
    interaction: null,
    snapPreview: null,
    viewport: cloneSize(currentState.viewport),
  } satisfies InfiniteCanvasState<Kind>;
}

export { cloneInfiniteCanvasState, resetInfiniteCanvasState };
