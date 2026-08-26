import {
  getInfiniteCanvasContentViewport,
  screenPointToWorldPoint,
  type InfiniteCanvasCamera,
  type InfiniteCanvasViewportInsets,
  type InfiniteCanvasViewportSize,
} from "@hyphened/infinite-canvas";
import { observable } from "@legendapp/state";

import { savedViews as viewGateway } from "../database/operations";

/**
 * The framings one canvas remembers.
 *
 * Sibling to `project-notes`, and the same shape for the same reason: a module observable, one
 * loader, and every mutation re-asking. It carries the canvas it belongs to, so that navigating
 * between canvases cannot leave a surface reading the previous one's list without being able to
 * tell — the correction `project-notes` records having had to make.
 *
 * Keyed by canvas rather than by project, because a rect is in one canvas's world coordinates and
 * names nothing in another's.
 *
 * **A saved view is not a workspace, and the difference is not cosmetic.** The framework already
 * stores a camera per workspace, but its own note calls that copy "a snapshot taken on the way out
 * … stale by design", because writing through on every pan would make each frame a workspace
 * mutation and every pan an undo entry. That is resume-where-you-left-off. This is the opposite
 * intent: a framing you return to *because* it does not move while you work.
 */

type SavedViewRect = Readonly<{ height: number; width: number; x: number; y: number }>;

type SavedView = Readonly<{ id: string; rect: SavedViewRect; title: string }>;

type CanvasSavedViews = Readonly<{ canvasId: string; views: readonly SavedView[] }>;

/** `null` until a read answers. "Nobody has asked yet" is not "there are none". */
const savedViews$ = observable<CanvasSavedViews | null>(null);

/** The listing, or `null` when what is held belongs to another canvas or nothing is held. */
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

/**
 * What is on screen right now, in world coordinates — the rect a new view stores.
 *
 * **The inset region, not the whole viewport, and that is the whole subtlety here.** This app
 * declares `viewportInsets` for the library rail, the identity rail and the minimap, so a
 * meaningful part of the viewport is behind the app's own chrome. Framing the whole viewport would
 * save a rect whose left quarter is permanently under the rail, and returning to it would put the
 * thing you were looking at behind a panel — off-centre by exactly the width of the chrome.
 * `getInfiniteCanvasContentViewport` is the framework's answer to "which region do my insets
 * leave", and it is exported precisely so a consumer does not re-derive it.
 *
 * `getVisibleWorldRect` is the tempting neighbour and is the wrong call: it takes a single scalar
 * padding and knows nothing about which edges are covered.
 */
function getCurrentFraming(
  input: Readonly<{
    camera: InfiniteCanvasCamera;
    insets: InfiniteCanvasViewportInsets;
    viewport: InfiniteCanvasViewportSize;
  }>,
): SavedViewRect {
  const content = getInfiniteCanvasContentViewport(input.viewport, input.insets);
  const origin = screenPointToWorldPoint(input.camera, input.viewport, {
    x: content.x,
    y: content.y,
  });

  return {
    height: content.height / input.camera.zoom,
    width: content.width / input.camera.zoom,
    x: origin.x,
    y: origin.y,
  };
}

export { getCurrentFraming, getSavedViews, loadSavedViews, removeSavedView, savedViews$, saveView };
export type { SavedView, SavedViewRect };
