import { DEFAULT_INFINITE_CANVAS_STACK_BANDS } from "./constants";
import { normalizeSelection, updateSelection, isSelectionTargetSelected } from "./selection";
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
    windows.reduce(
      (highest, window) =>
        window.isPinned === isPinned ? Math.max(highest, window.zIndex) : highest,
      -1,
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

  return updateSelection(raiseWindow(state, targetWindow), {
    mode: "replace",
    targets: [{ type: "window", id: windowId }],
  });
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
  const nextSelection = isSelectionTargetSelected(raisedState.selection, {
    type: "window",
    id: windowId,
  })
    ? {
        ...normalizedSelection,
        anchorTarget: { type: "window" as const, id: windowId },
      }
    : normalizedSelection;

  return {
    ...raisedState,
    activeWindowId: windowId,
    selection: nextSelection,
  };
}

function raiseWindow<Kind extends string>(
  state: InfiniteCanvasState<Kind>,
  targetWindow: InfiniteCanvasWindow<Kind>,
): InfiniteCanvasState<Kind> {
  if (state.activeWindowId === targetWindow.id && targetWindow.mode !== "minimized") return state;
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

  return updateSelection(
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
    { mode: "replace", targets: [{ type: "window", id: windowId }] },
  );
}

function getNextVisibleWindowId<Kind extends string>(
  windows: readonly InfiniteCanvasWindow<Kind>[],
) {
  const top = windows.reduce<InfiniteCanvasWindow<Kind> | null>((top, window) => {
    if (window.mode === "minimized") return top;
    return top === null || getWindowStackValue(window) >= getWindowStackValue(top) ? window : top;
  }, null);
  return top?.id ?? null;
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

  return updateSelection(
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
    { mode: "replace", targets: [{ type: "window", id: nextWindow.id }] },
  );
}

/** Trims a non-empty title and returns the same state for a no-op. */
function renameWindow<Kind extends string>(
  state: InfiniteCanvasState<Kind>,
  input: Readonly<{ title: string; windowId: string }>,
): InfiniteCanvasState<Kind> {
  const title = input.title.trim();
  const target = findWindow(state, input.windowId);

  if (title === "" || target === null || target.title === title) {
    return state;
  }

  return {
    ...state,
    windows: state.windows.map((window) =>
      window.id === input.windowId ? { ...window, title } : window,
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
  findWindow,
  focusWindow,
  focusWindowPreservingSelection,
  getNextVisibleWindowId,
  getNextZIndex,
  getWindowStackValue,
  openWindow,
  renameWindow,
  sortWindowsByStack,
  toggleWindowPinned,
  updateWindowRect,
};
