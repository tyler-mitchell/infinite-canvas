import {
  getInfiniteCanvasContentWorldRect,
  type InfiniteCanvasCamera,
  type InfiniteCanvasViewportInsets,
  type InfiniteCanvasViewportSize,
} from "@hyphened/infinite-canvas/legacy";
import { observable } from "@legendapp/state";
import PQueue from "p-queue";

import { savedViews as viewGateway } from "../database/operations";
import { getNextNumberedTitle } from "../titles";

// Saved view rects belong to one canvas.
type SavedViewRect = Readonly<{ height: number; width: number; x: number; y: number }>;

type SavedView = Readonly<{ id: string; rect: SavedViewRect; title: string }>;

type CanvasSavedViews = Readonly<{ canvasId: string; views: readonly SavedView[] }>;

// null means that no read has returned for this canvas.
const savedViews$ = observable<Record<string, CanvasSavedViews | null>>({});
const queue = new PQueue({ concurrency: 1 });

// Another canvas's list returns null.
function getSavedViews(listing: CanvasSavedViews | null | undefined, canvasId: string) {
  return listing?.canvasId === canvasId ? listing.views : null;
}

function loadSavedViews(canvasId: string) {
  if (savedViews$[canvasId].peek() === undefined) savedViews$[canvasId].set(null);
  return queue.add(async () => {
    savedViews$[canvasId].set({ canvasId, views: await viewGateway.list(canvasId) });
  });
}

function saveView(input: Readonly<{ canvasId: string; rect: SavedViewRect; title?: string }>) {
  return queue.add(async () => {
    const views =
      savedViews$[input.canvasId].peek()?.views ?? (await viewGateway.list(input.canvasId));
    const saved = await viewGateway.create({
      ...input,
      title:
        input.title ??
        getNextNumberedTitle(
          "View",
          views.map((view) => view.title),
        ),
    });
    savedViews$[input.canvasId].set({
      canvasId: input.canvasId,
      views: [...views, saved].toSorted((left, right) => {
        if (left.title === right.title) return 0;
        return left.title < right.title ? -1 : 1;
      }),
    });
  });
}

function removeSavedView(input: Readonly<{ canvasId: string; viewId: string }>) {
  return queue.add(async () => {
    await viewGateway.remove(input.viewId);
    const views = getSavedViews(savedViews$[input.canvasId].peek(), input.canvasId);
    if (views !== null)
      savedViews$[input.canvasId].views.set(views.filter((view) => view.id !== input.viewId));
  });
}

function reframeView(input: Readonly<{ canvasId: string; rect: SavedViewRect; viewId: string }>) {
  return queue.add(async () => {
    await viewGateway.reframe({ rect: input.rect, viewId: input.viewId });
    const views = getSavedViews(savedViews$[input.canvasId].peek(), input.canvasId);
    if (views !== null)
      savedViews$[input.canvasId].views.set(
        views.map((view) => (view.id === input.viewId ? { ...view, rect: input.rect } : view)),
      );
  });
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
  getSavedViews,
  loadSavedViews,
  reframeView,
  removeSavedView,
  savedViews$,
  saveView,
};
export type { SavedView, SavedViewRect };
