import type { InfiniteCanvasState } from "./types";

/** Reads workspace membership without importing workspace mutations. */
/** Returns admitted IDs, or null when all windows are admitted. */
function getInfiniteCanvasWorkspaceWindowIds<Kind extends string>(
  state: InfiniteCanvasState<Kind>,
): ReadonlySet<string> | null {
  const active = state.workspaces.find((workspace) => workspace.id === state.activeWorkspaceId);

  return active === undefined ? null : new Set(active.windowIds);
}

/** Returns whether the active workspace admits one window. */
function isInfiniteCanvasWindowInActiveWorkspace<Kind extends string>(
  state: InfiniteCanvasState<Kind>,
  windowId: string,
): boolean {
  const active = state.workspaces.find((workspace) => workspace.id === state.activeWorkspaceId);

  return active === undefined || active.windowIds.includes(windowId);
}

export { getInfiniteCanvasWorkspaceWindowIds, isInfiniteCanvasWindowInActiveWorkspace };
