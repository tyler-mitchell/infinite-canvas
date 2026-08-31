import {
  getInfiniteCanvasGroupProjection,
  getInfiniteCanvasGroupTitle,
  getInfiniteCanvasGroupWindowIds,
  getSelectionTargets,
  isInfiniteCanvasWindowInActiveWorkspace,
  isWorldRectWithinViewport,
  type InfiniteCanvasState,
} from "@hyphened/infinite-canvas";

import type { WindowKind } from "./window-registry";

function describeCanvas(state: InfiniteCanvasState<WindowKind>): string {
  const selected = new Set(state.selection.windowIds);
  const { hiddenWindowIds } = getInfiniteCanvasGroupProjection(state.groups, state.groupMetrics);
  const windows = state.windows
    .filter((window) => isInfiniteCanvasWindowInActiveWorkspace(state, window.id))
    .map((window) =>
      [
        `${window.kind} "${window.title}" [${window.id}]`,
        window.id === state.activeWindowId ? "active" : null,
        selected.has(window.id) ? "selected" : null,
        hiddenWindowIds.has(window.id) ? "behind a tab" : null,
        isWorldRectWithinViewport(state.camera, state.viewport, window.rect) ? null : "offscreen",
        window.mode === "normal" ? null : window.mode,
      ]
        .filter((part) => part !== null)
        .join(", "),
    );
  const groups = state.groups.map((group) => {
    const members = getInfiniteCanvasGroupWindowIds(group.tree);

    return `"${getInfiniteCanvasGroupTitle(group, state.windows)}" [${group.id}] holding ${members.map((windowId) => `[${windowId}]`).join(", ")}`;
  });

  const desktops = state.workspaces.map(
    (workspace) =>
      `"${workspace.title}" [${workspace.id}]${workspace.id === state.activeWorkspaceId ? " (current)" : ""}`,
  );

  const selectedConnections = getSelectionTargets(state.selection).filter(
    (target) => target.type === "edge",
  ).length;

  return [
    `Zoom ${Math.round(state.camera.zoom * 100)}%.`,
    desktops.length === 0
      ? null
      : `${desktops.length} desktop(s), showing only the current one's windows: ${desktops.join(", ")}.`,
    windows.length === 0
      ? "No windows open."
      : `${windows.length} window(s): ${windows.join("; ")}.`,
    groups.length === 0 ? "No groups." : `${groups.length} group(s): ${groups.join(", ")}.`,
    selectedConnections === 0
      ? null
      : `${selectedConnections} connection(s) selected; content.list names them.`,
  ]
    .filter((sentence) => sentence !== null)
    .join(" ");
}

export { describeCanvas };
