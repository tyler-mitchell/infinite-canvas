import { EMPTY_INFINITE_CANVAS_HISTORY } from "./history";
import type {
  InfiniteCanvasCamera,
  InfiniteCanvasGroup,
  InfiniteCanvasRect,
  InfiniteCanvasSelection,
  InfiniteCanvasSize,
  InfiniteCanvasState,
  InfiniteCanvasWindow,
} from "./types";

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

/**
 * A group's tree is deeply immutable — every `group-tree` mutation returns fresh
 * nodes and shares the rest — so it is safe to carry by reference. Only `rect` is
 * a mutable-shaped value worth copying.
 */
function cloneGroup(group: InfiniteCanvasGroup): InfiniteCanvasGroup {
  return { ...group, rect: cloneRect(group.rect) };
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
    groups: state.groups.map(cloneGroup),
    selection: cloneSelection(state.selection),
    viewport: cloneSize(state.viewport),
    windows: state.windows.map(cloneWindow),
  };
}

/**
 * Reset drops the undo stack. The document you would be undoing into is one the
 * user never edited — restoring it would be a surprise, not an undo.
 */
function resetInfiniteCanvasState<Kind extends string>(
  currentState: InfiniteCanvasState<Kind>,
  initialState: InfiniteCanvasState<Kind>,
) {
  return {
    ...cloneInfiniteCanvasState(initialState),
    history: EMPTY_INFINITE_CANVAS_HISTORY,
    interaction: null,
    snapPreview: null,
    viewport: cloneSize(currentState.viewport),
  } satisfies InfiniteCanvasState<Kind>;
}

export { cloneInfiniteCanvasState, resetInfiniteCanvasState };
