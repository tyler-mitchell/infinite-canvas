import { getVisibleWorldRect, isUsableViewport, unionRects } from "./geometry";
import { getCanvasLayout } from "./layout";
import { isSelectionTargetSelected } from "./selection";
import type {
  InfiniteCanvasPoint,
  InfiniteCanvasRect,
  InfiniteCanvasSize,
  InfiniteCanvasState,
} from "./types";

/** @experimental Projects visible content into a minimap and maps points back to the world. */
type InfiniteCanvasMinimapWindow = Readonly<{
  isActive: boolean;
  isSelected: boolean;
  rect: InfiniteCanvasRect;
  windowId: string;
}>;

type InfiniteCanvasMinimapGroup = Readonly<{
  groupId: string;
  rect: InfiniteCanvasRect;
}>;

type InfiniteCanvasMinimapLayout = Readonly<{
  bounds: InfiniteCanvasRect;
  groups: readonly InfiniteCanvasMinimapGroup[];
  /** Includes padding and center offset for exact inverse projection. */
  offset: InfiniteCanvasPoint;
  scale: number;
  /** Null when the camera contains all visible content. */
  viewport: InfiniteCanvasRect | null;
  windows: readonly InfiniteCanvasMinimapWindow[];
}>;

type InfiniteCanvasMinimapOptions = Readonly<{
  paddingPx?: number;
}>;

const DEFAULT_MINIMAP_PADDING_PX = 8;

const scaleRect = (
  rect: InfiniteCanvasRect,
  bounds: InfiniteCanvasRect,
  scale: number,
  offset: InfiniteCanvasPoint,
): InfiniteCanvasRect => ({
  height: rect.height * scale,
  width: rect.width * scale,
  x: offset.x + (rect.x - bounds.x) * scale,
  y: offset.y + (rect.y - bounds.y) * scale,
});

/** Returns a minimap layout, or null when the viewport or content has no usable area. */
function getInfiniteCanvasMinimapLayout<Kind extends string>(
  state: InfiniteCanvasState<Kind>,
  size: InfiniteCanvasSize,
  options: InfiniteCanvasMinimapOptions = {},
): InfiniteCanvasMinimapLayout | null {
  const { paddingPx = DEFAULT_MINIMAP_PADDING_PX } = options;
  const innerWidth = size.width - paddingPx * 2;
  const innerHeight = size.height - paddingPx * 2;

  if (!isUsableViewport(state.viewport) || innerWidth <= 0 || innerHeight <= 0) {
    return null;
  }

  const canvasLayout = getCanvasLayout(state);
  const drawnWindows = state.windows.filter((window) =>
    canvasLayout.visibleWindowIds.has(window.id),
  );
  const drawnGroups = state.groups.filter((group) => canvasLayout.visibleGroupIds.has(group.id));
  // This guard comes before the camera expands the bounds.
  if (drawnWindows.length === 0 && drawnGroups.length === 0) {
    return null;
  }

  const visibleWorldRect = getVisibleWorldRect(state.camera, state.viewport, 0);
  const contentBounds = unionRects([
    ...drawnWindows.map((window) => canvasLayout.windowRects.get(window.id)!),
    ...drawnGroups.map((group) => canvasLayout.groupRects.get(group.id)!),
  ]);
  const bounds = unionRects(
    contentBounds === null ? [visibleWorldRect] : [contentBounds, visibleWorldRect],
  );

  if (bounds === null || bounds.width <= 0 || bounds.height <= 0) {
    return null;
  }

  // Use one scale to preserve the aspect ratio.
  const scale = Math.min(innerWidth / bounds.width, innerHeight / bounds.height);
  const offset = {
    x: paddingPx + (innerWidth - bounds.width * scale) / 2,
    y: paddingPx + (innerHeight - bounds.height * scale) / 2,
  };

  return {
    bounds,
    // Use the same groups for bounds and output.
    groups: drawnGroups.map((group) => ({
      groupId: group.id,
      rect: scaleRect(canvasLayout.groupRects.get(group.id)!, bounds, scale, offset),
    })),
    offset,
    scale,
    // Equal bounds mean that the camera contains all visible content.
    viewport:
      bounds.x === visibleWorldRect.x &&
      bounds.y === visibleWorldRect.y &&
      bounds.width === visibleWorldRect.width &&
      bounds.height === visibleWorldRect.height
        ? null
        : scaleRect(visibleWorldRect, bounds, scale, offset),
    windows: drawnWindows.map((window) => ({
      isActive: state.activeWindowId === window.id,
      isSelected: isSelectionTargetSelected(state.selection, { type: "window", id: window.id }),
      rect: scaleRect(canvasLayout.windowRects.get(window.id)!, bounds, scale, offset),
      windowId: window.id,
    })),
  };
}

/** Converts minimap pixels to the matching world point. */
function getInfiniteCanvasMinimapWorldPoint(
  layout: InfiniteCanvasMinimapLayout,
  minimapPoint: InfiniteCanvasPoint,
): InfiniteCanvasPoint {
  return {
    x: layout.bounds.x + (minimapPoint.x - layout.offset.x) / layout.scale,
    y: layout.bounds.y + (minimapPoint.y - layout.offset.y) / layout.scale,
  };
}

export { getInfiniteCanvasMinimapLayout, getInfiniteCanvasMinimapWorldPoint };
export type {
  InfiniteCanvasMinimapGroup,
  InfiniteCanvasMinimapLayout,
  InfiniteCanvasMinimapOptions,
  InfiniteCanvasMinimapWindow,
};
