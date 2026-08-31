import { EMPTY_INFINITE_CANVAS_HISTORY } from "./history";
import type {
  InfiniteCanvasCamera,
  InfiniteCanvasGroup,
  InfiniteCanvasRect,
  InfiniteCanvasSelection,
  InfiniteCanvasSize,
  InfiniteCanvasState,
  InfiniteCanvasWindow,
  InfiniteCanvasWorkspace,
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

/** Copies group geometry and shares its immutable tree. */
function cloneGroup(group: InfiniteCanvasGroup): InfiniteCanvasGroup {
  return { ...group, rect: cloneRect(group.rect) };
}

/** Copies workspace camera and selection values. */
function cloneWorkspace(workspace: InfiniteCanvasWorkspace): InfiniteCanvasWorkspace {
  return {
    ...workspace,
    camera: cloneCamera(workspace.camera),
    selection: cloneSelection(workspace.selection),
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
    groupMetrics: { ...state.groupMetrics },
    groups: state.groups.map(cloneGroup),
    selection: cloneSelection(state.selection),
    viewport: cloneSize(state.viewport),
    viewportInsets: { ...state.viewportInsets },
    // Copy each rect because callers can retain input objects.
    viewportOccluders: state.viewportOccluders.map((occluder) => ({ ...occluder })),
    windows: state.windows.map(cloneWindow),
    workspaces: state.workspaces.map(cloneWorkspace),
  };
}

/** Resets the document and keeps the measured viewport. */
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
