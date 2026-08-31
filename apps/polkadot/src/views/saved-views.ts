import {
  getInfiniteCanvasContentWorldRect,
  type InfiniteCanvasCamera,
  type InfiniteCanvasViewportInsets,
  type InfiniteCanvasViewportSize,
} from "@hyphened/infinite-canvas";
import { observable } from "@legendapp/state";

import { savedViews as viewGateway } from "../database/operations";

// Saved view rects belong to one canvas.
type SavedViewRect = Readonly<{ height: number; width: number; x: number; y: number }>;

type SavedView = Readonly<{ id: string; rect: SavedViewRect; title: string }>;

type CanvasSavedViews = Readonly<{ canvasId: string; views: readonly SavedView[] }>;

// null means that no read has returned for this canvas.
const savedViews$ = observable<CanvasSavedViews | null>(null);

// Another canvas's list returns null.
function getSavedViews(listing: CanvasSavedViews | null, canvasId: string) {
  return listing?.canvasId === canvasId ? listing.views : null;
}

async function loadSavedViews(canvasId: string) {
  if (savedViews$.peek()?.canvasId !== canvasId) {
    savedViews$.set(null);
  }

  savedViews$.set({ canvasId, views: await viewGateway.list(canvasId) });
}

async function saveView(input: Readonly<{ canvasId: string; rect: SavedViewRect; title: string }>) {
  await viewGateway.create(input);
  await loadSavedViews(input.canvasId);
}

async function removeSavedView(input: Readonly<{ canvasId: string; viewId: string }>) {
  await viewGateway.remove(input.viewId);
  await loadSavedViews(input.canvasId);
}

// Use the largest ordinal so removed titles do not create duplicates.
function getNextViewTitle(views: readonly SavedView[]) {
  const used = views.flatMap((view) => {
    const ordinal = /^View (\d+)$/.exec(view.title)?.[1];

    return ordinal === undefined ? [] : [Number(ordinal)];
  });

  return `View ${String(Math.max(0, ...used) + 1)}`;
}

async function reframeView(
  input: Readonly<{ canvasId: string; rect: SavedViewRect; viewId: string }>,
) {
  await viewGateway.reframe({ rect: input.rect, viewId: input.viewId });
  await loadSavedViews(input.canvasId);
}

// Use the visible content rect after viewport insets.
function getCurrentFraming(
  input: Readonly<{
    camera: InfiniteCanvasCamera;
    insets: InfiniteCanvasViewportInsets;
    viewport: InfiniteCanvasViewportSize;
  }>,
): SavedViewRect {
  return getInfiniteCanvasContentWorldRect(input.camera, input.viewport, input.insets);
}

export {
  getCurrentFraming,
  getNextViewTitle,
  getSavedViews,
  loadSavedViews,
  reframeView,
  removeSavedView,
  savedViews$,
  saveView,
};
export type { SavedView, SavedViewRect };
