import { getInfiniteCanvasGroupProjection } from "./group-state";
import type { InfiniteCanvasState, InfiniteCanvasWindow, InfiniteCanvasWindowMode } from "./types";
import { getInfiniteCanvasWorkspaceWindowIds } from "./workspace-membership";

type InfiniteCanvasWindowPresenceItem<Kind extends string = string> = Readonly<{
  id: string;
  /** On the desktop being looked at. `false` means another workspace holds it. */
  isAdmitted: boolean;
  isActive: boolean;
  /** In a group and not the child being shown — behind an inactive tab, or a collapsed fold. */
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
  /**
   * On screen right now.
   *
   * This was `mode !== "minimized"` and nothing else, which is three of the four ways a window can
   * be on the canvas without being on it. A member behind an inactive tab has `mode: "normal"` and
   * the shell's whole rect, and a window on another desktop is not rendered at all — both were in
   * here, under a name that says otherwise. `windows` is still every window, and each item now
   * carries `isHidden` and `isAdmitted`, so a consumer listing all of them can say which is which
   * rather than having to re-derive it.
   */
  visible: readonly InfiniteCanvasWindowPresenceItem<Kind>[];
  windows: readonly InfiniteCanvasWindowPresenceItem<Kind>[];
}>;

/**
 * What every item in one pass shares. Optional, because a caller asking about a single window
 * should not have to know it exists — but solving a group layout once per window is n × g layout
 * solves for a list, and presence is read on every palette keystroke.
 */
type InfiniteCanvasWindowPresenceScope = Readonly<{
  admittedWindowIds: ReadonlySet<string> | null;
  hiddenWindowIds: ReadonlySet<string>;
}>;

const getInfiniteCanvasWindowPresenceScope = <Kind extends string>(
  state: InfiniteCanvasState<Kind>,
): InfiniteCanvasWindowPresenceScope => ({
  admittedWindowIds: getInfiniteCanvasWorkspaceWindowIds(state),
  hiddenWindowIds: getInfiniteCanvasGroupProjection(state.groups, state.groupMetrics)
    .hiddenWindowIds,
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
  const scope = getInfiniteCanvasWindowPresenceScope(state);
  const windows = sortWindowPresenceItemsByStack(
    state.windows.map((window) => getInfiniteCanvasWindowPresenceItem(state, window, scope)),
  );
  const visible = windows.filter(
    (window) => window.mode !== "minimized" && !window.isHidden && window.isAdmitted,
  );
  // Still every minimized window, admitted or not: the dock is the consumer's to scope, and a
  // minimized window on another desktop is a different statement from one behind a tab.
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
