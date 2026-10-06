import { getSelectedWindowIds } from "./selection";
import { getCanvasLayout } from "./layout";
import type { InfiniteCanvasState, InfiniteCanvasWindow, InfiniteCanvasWindowMode } from "./types";
import { getInfiniteCanvasWorkspaceWindowIds } from "./workspace-membership";

type InfiniteCanvasWindowPresenceItem<Kind extends string = string> = Readonly<{
  id: string;
  /** True when the active workspace admits this window. */
  isAdmitted: boolean;
  isActive: boolean;
  /** True for a hidden group member. */
  isHidden: boolean;
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
  /** Windows rendered in the active workspace. */
  visible: readonly InfiniteCanvasWindowPresenceItem<Kind>[];
  windows: readonly InfiniteCanvasWindowPresenceItem<Kind>[];
}>;

/** Shared membership and group projection for one presence pass. */
type InfiniteCanvasWindowPresenceScope = Readonly<{
  admittedWindowIds: ReadonlySet<string> | null;
  hiddenWindowIds: ReadonlySet<string>;
}>;

const getInfiniteCanvasWindowPresenceScope = <Kind extends string>(
  state: InfiniteCanvasState<Kind>,
  hiddenWindowIds = getCanvasLayout(state).hiddenWindowIds,
): InfiniteCanvasWindowPresenceScope => ({
  admittedWindowIds: getInfiniteCanvasWorkspaceWindowIds(state),
  hiddenWindowIds,
});

function getInfiniteCanvasWindowPresenceItem<Kind extends string>(
  state: InfiniteCanvasState<Kind>,
  window: InfiniteCanvasWindow<Kind>,
  scope: InfiniteCanvasWindowPresenceScope = getInfiniteCanvasWindowPresenceScope(state),
): InfiniteCanvasWindowPresenceItem<Kind> {
  return {
    id: window.id,
    isActive: state.activeWindowId === window.id,
    isAdmitted: scope.admittedWindowIds === null || scope.admittedWindowIds.has(window.id),
    isHidden: scope.hiddenWindowIds.has(window.id),
    isPinned: window.isPinned,
    isSelected: getSelectedWindowIds(state.selection).includes(window.id),
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
  const canvasLayout = getCanvasLayout(state);
  const scope = getInfiniteCanvasWindowPresenceScope(state, canvasLayout.hiddenWindowIds);
  const windows = sortWindowPresenceItemsByStack(
    state.windows.map((window) => getInfiniteCanvasWindowPresenceItem(state, window, scope)),
  );
  const visible = windows.filter((window) => canvasLayout.visibleWindowIds.has(window.id));
  // Keep minimized windows from all workspaces in the consumer-owned dock.
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
