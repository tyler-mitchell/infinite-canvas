import type { InfiniteCanvasWindow } from "#/experiments/infinite-canvas/types";

function getDuplicateInfiniteCanvasWindowIds<Kind extends string>(
  windows: readonly InfiniteCanvasWindow<Kind>[],
) {
  const windowIds = windows.map((window) => window.id);

  return [...new Set(windowIds.filter((windowId, index) => windowIds.indexOf(windowId) !== index))];
}

function getUniqueInfiniteCanvasWindows<Kind extends string>(
  windows: readonly InfiniteCanvasWindow<Kind>[],
) {
  const windowIds = windows.map((window) => window.id);

  return windows.filter((window, index) => windowIds.lastIndexOf(window.id) === index);
}

export { getDuplicateInfiniteCanvasWindowIds, getUniqueInfiniteCanvasWindows };
