import { DEFAULT_INFINITE_CANVAS_STACK_BANDS } from "./constants";
import { getViewportInsetWorldRect } from "./geometry";
import {
  cleanSelection,
  isWindowSelected,
  normalizeSelection,
  replaceSelection,
} from "./selection";
import type { InfiniteCanvasStackBands, InfiniteCanvasState, InfiniteCanvasWindow } from "./types";

function getWindowStackValue(
  window: Pick<InfiniteCanvasWindow, "isPinned" | "zIndex">,
  bands: InfiniteCanvasStackBands = DEFAULT_INFINITE_CANVAS_STACK_BANDS,
) {
  return (window.isPinned ? bands.pinned : 0) + window.zIndex;
}

function getNextZIndex<Kind extends string>(
  windows: readonly InfiniteCanvasWindow<Kind>[],
  isPinned: boolean,
) {
  return (
    Math.max(
      -1,
      ...windows.filter((window) => window.isPinned === isPinned).map((window) => window.zIndex),
    ) + 1
  );
}

function findWindow<Kind extends string>(state: InfiniteCanvasState<Kind>, windowId: string) {
  return state.windows.find((window) => window.id === windowId) ?? null;
}

function focusWindow<Kind extends string>(
  state: InfiniteCanvasState<Kind>,
  windowId: string,
): InfiniteCanvasState<Kind> {
  const targetWindow = findWindow(state, windowId);

  if (targetWindow === null) {
    return state;
  }

  return replaceSelection(raiseWindow(state, targetWindow), [windowId]);
}

function focusWindowPreservingSelection<Kind extends string>(
  state: InfiniteCanvasState<Kind>,
  windowId: string,
): InfiniteCanvasState<Kind> {
  const targetWindow = findWindow(state, windowId);

  if (targetWindow === null) {
    return state;
  }

  const raisedState = raiseWindow(state, targetWindow);
  const normalizedSelection = normalizeSelection(raisedState, raisedState.selection);
  const nextSelection = isWindowSelected(raisedState, windowId)
    ? {
        ...normalizedSelection,
        anchorWindowId: windowId,
      }
    : normalizedSelection;

  return {
    ...raisedState,
    activeWindowId: nextSelection.anchorWindowId,
    selection: nextSelection,
  };
}

function raiseWindow<Kind extends string>(
  state: InfiniteCanvasState<Kind>,
  targetWindow: InfiniteCanvasWindow<Kind>,
): InfiniteCanvasState<Kind> {
  const nextZIndex = getNextZIndex(state.windows, targetWindow.isPinned);

  return {
    ...state,
    activeWindowId: targetWindow.id,
    windows: state.windows.map((window) =>
      window.id === targetWindow.id
        ? {
            ...window,
            mode: window.mode === "minimized" ? "normal" : window.mode,
            zIndex: nextZIndex,
          }
        : window,
    ),
  };
}

function cleanSelectionWithFallback<Kind extends string>(
  state: InfiniteCanvasState<Kind>,
  fallbackWindowId: string | null,
) {
  const cleanedState = cleanSelection(state);

  return cleanedState.selection.windowIds.length === 0 && fallbackWindowId !== null
    ? replaceSelection(cleanedState, [fallbackWindowId])
    : cleanedState;
}

function toggleWindowPinned<Kind extends string>(
  state: InfiniteCanvasState<Kind>,
  windowId: string,
): InfiniteCanvasState<Kind> {
  const targetWindow = findWindow(state, windowId);

  if (targetWindow === null) {
    return state;
  }

  const nextPinned = !targetWindow.isPinned;
  const nextZIndex = getNextZIndex(state.windows, nextPinned);

  return replaceSelection(
    {
      ...state,
      activeWindowId: windowId,
      windows: state.windows.map((window) =>
        window.id === windowId
          ? {
              ...window,
              isPinned: nextPinned,
              zIndex: nextZIndex,
            }
          : window,
      ),
    },
    [windowId],
  );
}

function getNextVisibleWindowId<Kind extends string>(
  windows: readonly InfiniteCanvasWindow<Kind>[],
) {
  return (
    sortWindowsByStack(windows)
      .filter((window) => window.mode !== "minimized")
      .at(-1)?.id ?? null
  );
}

function openWindow<Kind extends string>(
  state: InfiniteCanvasState<Kind>,
  nextWindow: InfiniteCanvasWindow<Kind>,
): InfiniteCanvasState<Kind> {
  const existingWindow = findWindow(state, nextWindow.id);
  const normalizedWindow = {
    ...nextWindow,
    mode: nextWindow.mode === "minimized" ? "normal" : nextWindow.mode,
    zIndex: getNextZIndex(state.windows, nextWindow.isPinned),
  };

  return replaceSelection(
    {
      ...state,
      activeWindowId: nextWindow.id,
      windows:
        existingWindow === null
          ? [...state.windows, normalizedWindow]
          : state.windows.map((window) =>
              window.id === nextWindow.id ? normalizedWindow : window,
            ),
    },
    [nextWindow.id],
  );
}

function closeWindow<Kind extends string>(
  state: InfiniteCanvasState<Kind>,
  windowId: string,
): InfiniteCanvasState<Kind> {
  const nextWindows = state.windows.filter((window) => window.id !== windowId);
  const fallbackWindowId =
    state.activeWindowId === windowId ? getNextVisibleWindowId(nextWindows) : state.activeWindowId;

  return cleanSelectionWithFallback(
    {
      ...state,
      activeWindowId: fallbackWindowId,
      interaction:
        state.interaction !== null &&
        "windowId" in state.interaction &&
        state.interaction.windowId === windowId
          ? null
          : state.interaction,
      selection: {
        anchorWindowId:
          state.selection.anchorWindowId === windowId ? null : state.selection.anchorWindowId,
        windowIds: state.selection.windowIds.filter(
          (selectedWindowId) => selectedWindowId !== windowId,
        ),
      },
      snapPreview: state.snapPreview?.windowId === windowId ? null : state.snapPreview,
      windows: nextWindows,
    },
    fallbackWindowId,
  );
}

function minimizeWindow<Kind extends string>(
  state: InfiniteCanvasState<Kind>,
  windowId: string,
): InfiniteCanvasState<Kind> {
  if (findWindow(state, windowId) === null) {
    return state;
  }

  const nextWindows = state.windows.map((window) =>
    window.id === windowId
      ? {
          ...window,
          mode: "minimized" as const,
        }
      : window,
  );
  const fallbackWindowId =
    state.activeWindowId === windowId ? getNextVisibleWindowId(nextWindows) : state.activeWindowId;

  return cleanSelectionWithFallback(
    {
      ...state,
      activeWindowId: fallbackWindowId,
      interaction:
        state.interaction !== null &&
        "windowId" in state.interaction &&
        state.interaction.windowId === windowId
          ? null
          : state.interaction,
      selection: {
        anchorWindowId:
          state.selection.anchorWindowId === windowId ? null : state.selection.anchorWindowId,
        windowIds: state.selection.windowIds.filter(
          (selectedWindowId) => selectedWindowId !== windowId,
        ),
      },
      snapPreview: state.snapPreview?.windowId === windowId ? null : state.snapPreview,
      windows: nextWindows,
    },
    fallbackWindowId,
  );
}

function maximizeWindow<Kind extends string>(
  state: InfiniteCanvasState<Kind>,
  windowId: string,
): InfiniteCanvasState<Kind> {
  const focusedState = focusWindow(state, windowId);
  const targetWindow = findWindow(focusedState, windowId);

  if (targetWindow === null) {
    return state;
  }

  const maximizedRect = getViewportInsetWorldRect(focusedState.camera, focusedState.viewport, 36);

  return {
    ...focusedState,
    windows: focusedState.windows.map((window) =>
      window.id === windowId
        ? {
            ...window,
            mode: "maximized",
            rect: maximizedRect,
            restoreRect: window.mode === "maximized" ? window.restoreRect : window.rect,
          }
        : window,
    ),
  };
}

function restoreWindow<Kind extends string>(
  state: InfiniteCanvasState<Kind>,
  windowId: string,
): InfiniteCanvasState<Kind> {
  const focusedState = focusWindow(state, windowId);

  return {
    ...focusedState,
    windows: focusedState.windows.map((window) =>
      window.id === windowId
        ? {
            ...window,
            mode: "normal",
            rect: window.restoreRect ?? window.rect,
            restoreRect: undefined,
          }
        : window,
    ),
  };
}

function updateWindowRect<Kind extends string>(
  state: InfiniteCanvasState<Kind>,
  windowId: string,
  rect: InfiniteCanvasWindow<Kind>["rect"],
): InfiniteCanvasState<Kind> {
  return {
    ...state,
    windows: state.windows.map((window) =>
      window.id === windowId
        ? {
            ...window,
            rect,
          }
        : window,
    ),
  };
}

function sortWindowsByStack<Kind extends string>(windows: readonly InfiniteCanvasWindow<Kind>[]) {
  return [...windows].sort((left, right) => getWindowStackValue(left) - getWindowStackValue(right));
}

export {
  closeWindow,
  findWindow,
  focusWindow,
  focusWindowPreservingSelection,
  getNextVisibleWindowId,
  getNextZIndex,
  getWindowStackValue,
  maximizeWindow,
  minimizeWindow,
  openWindow,
  restoreWindow,
  sortWindowsByStack,
  toggleWindowPinned,
  updateWindowRect,
};
