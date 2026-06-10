import type {
  InfiniteCanvasState,
  InfiniteCanvasWindow,
  InfiniteCanvasWindowMode,
} from "#/experiments/infinite-canvas/types";

type InfiniteCanvasWindowPresenceItem<Kind extends string = string> = Readonly<{
  id: string;
  isActive: boolean;
  isPinned: boolean;
  isSelected: boolean;
  kind: Kind;
  mode: InfiniteCanvasWindowMode;
  title: string;
  zIndex: number;
}>;

type InfiniteCanvasWindowPresence<Kind extends string = string> = Readonly<{
  activeWindow: InfiniteCanvasWindowPresenceItem<Kind> | null;
  minimized: readonly InfiniteCanvasWindowPresenceItem<Kind>[];
  pinned: readonly InfiniteCanvasWindowPresenceItem<Kind>[];
  visible: readonly InfiniteCanvasWindowPresenceItem<Kind>[];
  windows: readonly InfiniteCanvasWindowPresenceItem<Kind>[];
}>;

function getInfiniteCanvasWindowPresenceItem<Kind extends string>(
  state: InfiniteCanvasState<Kind>,
  window: InfiniteCanvasWindow<Kind>,
): InfiniteCanvasWindowPresenceItem<Kind> {
  return {
    id: window.id,
    isActive: state.activeWindowId === window.id,
    isPinned: window.isPinned,
    isSelected: state.selection.windowIds.includes(window.id),
    kind: window.kind,
    mode: window.mode,
    title: window.title,
    zIndex: window.zIndex,
  };
}

function sortWindowPresenceItemsByStack<Kind extends string>(
  items: readonly InfiniteCanvasWindowPresenceItem<Kind>[],
) {
  return [...items].sort((left, right) => right.zIndex - left.zIndex);
}

function getInfiniteCanvasWindowPresence<Kind extends string>(
  state: InfiniteCanvasState<Kind>,
): InfiniteCanvasWindowPresence<Kind> {
  const windows = sortWindowPresenceItemsByStack(
    state.windows.map((window) => getInfiniteCanvasWindowPresenceItem(state, window)),
  );
  const visible = windows.filter((window) => window.mode !== "minimized");
  const minimized = windows.filter((window) => window.mode === "minimized");
  const pinned = visible.filter((window) => window.isPinned);

  return {
    activeWindow: windows.find((window) => window.isActive) ?? null,
    minimized,
    pinned,
    visible,
    windows,
  };
}

function getInfiniteCanvasMinimizedWindowItems<Kind extends string>(
  state: InfiniteCanvasState<Kind>,
) {
  return getInfiniteCanvasWindowPresence(state).minimized;
}

function getInfiniteCanvasVisibleWindowItems<Kind extends string>(
  state: InfiniteCanvasState<Kind>,
) {
  return getInfiniteCanvasWindowPresence(state).visible;
}

export {
  getInfiniteCanvasMinimizedWindowItems,
  getInfiniteCanvasVisibleWindowItems,
  getInfiniteCanvasWindowPresence,
  getInfiniteCanvasWindowPresenceItem,
};

export type { InfiniteCanvasWindowPresence, InfiniteCanvasWindowPresenceItem };
