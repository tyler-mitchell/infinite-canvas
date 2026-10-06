import type { InfiniteCanvasDocument } from "@hyphened/infinite-canvas/legacy";
import type { WindowKind } from "./window-registry";

export const initialLayout = {
  version: 4,
  activeWindowId: null,
  activeWorkspaceId: null,
  camera: { center: { x: 0, y: 0 }, zoom: 1 },
  connections: [],
  groups: [],
  selection: { anchorTarget: null, targets: [] },
  windows: [],
  workspaces: [],
} satisfies InfiniteCanvasDocument<WindowKind>;
