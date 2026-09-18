import {
  getCanvasLayout,
  getInfiniteCanvasGroupTitle,
  getInfiniteCanvasGroupWindowIds,
  isInfiniteCanvasWindowInActiveWorkspace,
  isWorldRectWithinViewport,
  type InfiniteCanvasState,
  getSelectedWindowIds,
} from "@hyphened/infinite-canvas";

import type { WindowKind } from "./window-registry";

function describeCanvas(state: InfiniteCanvasState<WindowKind>): string {
  const selected = new Set(getSelectedWindowIds(state.selection));
  const canvasLayout = getCanvasLayout(state);
  const hiddenLabels = new Map(
    [...canvasLayout.layouts.values()].flatMap(({ tabStrips }) =>
      tabStrips.flatMap(({ childIds, activeChildId }) =>
        childIds.filter((id) => id !== activeChildId).map((id) => [id, "behind a tab"] as const),
      ),
    ),
  );
  const windows = state.windows
    .filter((window) => isInfiniteCanvasWindowInActiveWorkspace(state, window.id))
    .map((window) =>
      [
        `${window.kind} "${window.title}" [${window.id}]`,
        window.id === state.activeWindowId ? "active" : null,
        selected.has(window.id) ? "selected" : null,
        canvasLayout.hiddenWindowIds.has(window.id)
          ? (hiddenLabels.get(window.id) ?? "hidden in its group")
          : null,
        isWorldRectWithinViewport(
          state.camera,
          state.viewport,
          canvasLayout.windowRects.get(window.id)!,
        )
          ? null
          : "offscreen",
        window.mode === "normal" ? null : window.mode,
      ]
        .filter((part) => part !== null)
        .join(", "),
    );
  const groups = state.groups
    .filter((group) => canvasLayout.visibleGroupIds.has(group.id))
    .map((group) => {
      const members = getInfiniteCanvasGroupWindowIds(group.tree);

      return `"${getInfiniteCanvasGroupTitle(group, state.windows)}" [${group.id}] holding ${members.map((windowId) => `[${windowId}]`).join(", ")}`;
    });

  const desktops = state.workspaces.map(
    (workspace) =>
      `"${workspace.title}" [${workspace.id}]${workspace.id === state.activeWorkspaceId ? " (current)" : ""}`,
  );

  const selectedConnections = state.selection.targets.filter(
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
