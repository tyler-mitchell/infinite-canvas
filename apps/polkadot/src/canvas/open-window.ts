import {
  createInfiniteCanvasWindow,
  getInfiniteCanvasContentWorldRect,
  getInfiniteCanvasOccluderWorldRects,
  getInfiniteCanvasVacantRect,
  getInfiniteCanvasWindowDetailLevel,
  getInfiniteCanvasWindowPlacementRect,
  isInfiniteCanvasWindowInActiveWorkspace,
  type InfiniteCanvasCommands,
  type InfiniteCanvasRect,
  type InfiniteCanvasState,
} from "@hyphened/infinite-canvas";

import { showsContentItem } from "./content-window-data";
import type { WindowData, WindowKind } from "./window-registry";

type WindowSize = Readonly<{ height: number; width: number }>;

type WindowPlacement = Readonly<{
  actions: InfiniteCanvasCommands<WindowKind>;
  state: InfiniteCanvasState<WindowKind>;
}>;

const WINDOW_GAP = 24;

function getPlacedRect(
  input: WindowPlacement & Readonly<{ minSize: WindowSize; size: WindowSize }>,
) {
  const bounds = getInfiniteCanvasContentWorldRect(
    input.state.camera,
    input.state.viewport,
    input.state.viewportInsets,
  );

  return getInfiniteCanvasVacantRect({
    bounds,
    gapPx: WINDOW_GAP,
    occupied: [
      ...getInfiniteCanvasOccluderWorldRects(
        input.state.camera,
        input.state.viewport,
        input.state.viewportOccluders,
      ),
      ...input.state.groups.map((group) => group.rect),
      // Windows outside the active desktop do not reserve space.
      ...input.state.windows
        .filter(
          (window) =>
            window.mode !== "minimized" &&
            isInfiniteCanvasWindowInActiveWorkspace(input.state, window.id),
        )
        .map((window) => window.rect),
    ],
    preferred: getInfiniteCanvasWindowPlacementRect(bounds, "center", input.size, input.minSize),
  });
}

function openContentWindow<Kind extends WindowKind>(
  input: WindowPlacement &
    Readonly<{
      data: WindowData[Kind];
      kind: Kind;
      minSize: WindowSize;
      /** This rectangle overrides automatic placement. */
      rect?: InfiniteCanvasRect;
      size: WindowSize;
      title: string;
    }>,
) {
  const existing = input.state.windows.find((window) =>
    showsContentItem(window, input.data.itemId),
  );

  if (existing !== undefined) {
    input.actions.executeCommand({ type: "window.reveal", windowId: existing.id });

    return;
  }

  const rect = input.rect ?? getPlacedRect(input);

  input.actions.openWindow(
    createInfiniteCanvasWindow<WindowKind, WindowData[Kind]>({
      data: input.data,
      id: globalThis.crypto.randomUUID(),
      kind: input.kind,
      minSize: input.minSize,
      rect,
      title: input.title,
    }),
  );

  // Fit summary windows, but do not zoom past 100%.
  if (getInfiniteCanvasWindowDetailLevel(rect, input.state.camera.zoom) === "summary") {
    input.actions.navigateToRect({ behavior: { maxZoom: 1, paddingPx: 64, type: "fit" }, rect });
  }
}

export { openContentWindow };
export type { WindowPlacement, WindowSize };
