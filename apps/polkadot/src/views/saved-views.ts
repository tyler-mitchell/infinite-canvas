import {
  getInfiniteCanvasContentWorldRect,
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
 * The next "View n" this canvas is not already using.
 *
 * Max-ordinal rather than `length + 1`, which is the defect `open-note` already had to fix: a count
 * frees a number as soon as anything is removed, so deleting the second of three and saving again
 * produces a second "View 3" — two rows with one name, in the one surface whose job is telling them
 * apart.
 *
 * Here rather than in the menu because the menu is no longer the only thing that names a view:
 * `view.save` takes an optional title and needs the same default, and two numberings that could
 * disagree is the collision this function exists to prevent.
 */
function getNextViewTitle(views: readonly SavedView[]) {
  const used = views.flatMap((view) => {
    const ordinal = /^View (\d+)$/.exec(view.title)?.[1];

    return ordinal === undefined ? [] : [Number(ordinal)];
  });

  return `View ${String(Math.max(0, ...used) + 1)}`;
}

/**
 * Point a name at what is on screen now, when the framing it meant has drifted.
 *
 * Remove-and-save-again reaches the same rect and loses the name on the way — you retype it, and
 * the list reorders around a row that is new rather than moved. The name is the durable half of a
 * saved view; the four numbers are the part expected to go stale.
 *
 * `fn::reframe_saved_view` and the client call have existed since saved views landed, reachable
 * from nothing. This is the layer that was missing, not the capability.
 */
async function reframeView(
  input: Readonly<{ canvasId: string; rect: SavedViewRect; viewId: string }>,
) {
  await viewGateway.reframe({ rect: input.rect, viewId: input.viewId });
  await loadSavedViews(input.canvasId);
}

/**
 * What is on screen right now, in world coordinates — the rect a new view stores.
 *
 * **The inset region, not the whole viewport.** This app declares `viewportInsets` for the library
 * rail, the identity rail and the minimap, so a meaningful part of the viewport sits behind the
 * app's own chrome. Framing the whole thing would store a rect whose left quarter is permanently
 * under the rail, and returning to it would put the subject behind a panel, off-centre by exactly
 * the width of the chrome.
 *
 * Composed by hand here first, which is what showed the framework should own it: the arithmetic is
 * the same for anything asking "what can be seen right now" in world terms, and nothing about it is
 * a Polkadot idea. `getInfiniteCanvasContentWorldRect` is that, with the asymmetry case pinned by
 * a test that fails against `getVisibleWorldRect` — the neighbour that looks right and is not.
 */
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
