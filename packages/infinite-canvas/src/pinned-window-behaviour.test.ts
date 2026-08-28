import { expect, test } from "vite-plus/test";

import { executeInfiniteCanvasCommand } from "./commands";
import { createInfiniteCanvasState, createInfiniteCanvasWindow } from "./factory";
import { getVisibleWindowBounds } from "./selection";
import type { InfiniteCanvasState } from "./types";

/**
 * What pinning does, and the two things its description claimed it did.
 *
 * `activeWindow.togglePinned` read "Pin the active window so panning and fit-all leave it in
 * place". Neither half held: nothing in the camera, the pan handler or `getVisibleWindowBounds`
 * reads `isPinned`. Pinning moves a window into the pinned stacking band, and that is all.
 *
 * Asserted rather than argued because a wrong description is invisible — it fails no typecheck and
 * breaks no test, and the only way it gets caught is somebody reading the sentence against the
 * code. These make the next wrong version fail instead.
 */

type Kind = "note";

const pane = (id: string, x: number) =>
  createInfiniteCanvasWindow<Kind>({
    id,
    kind: "note",
    rect: { height: 200, width: 300, x, y: 0 },
    title: id,
  });

const canvas = (): InfiniteCanvasState<Kind> => ({
  ...createInfiniteCanvasState<Kind>({ windows: [pane("a", 0), pane("b", 4000)] }),
  activeWindowId: "a",
  viewport: { height: 800, width: 1200 },
});

const pin = (state: InfiniteCanvasState<Kind>) =>
  executeInfiniteCanvasCommand(state, { type: "activeWindow.togglePinned" });

const windowById = (state: InfiniteCanvasState<Kind>, id: string) =>
  state.windows.find((window) => window.id === id);

test("pinning raises the window above every unpinned one", () => {
  /*
   * The thing it actually does. `getWindowStackValue` adds the pinned band to the z-index, so a
   * pinned window outranks an unpinned one whatever their raw indices are — which is why the raw
   * index alone is not the assertion.
   */
  const pinned = pin(canvas());

  expect(windowById(pinned, "a")?.isPinned).toBe(true);
  expect(windowById(pinned, "b")?.isPinned).toBe(false);
});

test("pinning does not move the window", () => {
  const before = canvas();
  const after = pin(before);

  expect(windowById(after, "a")?.rect).toStrictEqual(windowById(before, "a")?.rect);
});

test("panning leaves a pinned window exactly where it was", () => {
  /*
   * The first false claim. A window that "stays in place" while the camera pans would have to be
   * screen-anchored, and nothing here is: panning moves the camera and touches no window rect, so
   * a pinned window travels across the viewport like any other.
   */
  const pinned = pin(canvas());
  const panned = executeInfiniteCanvasCommand(pinned, {
    amountPx: 200,
    direction: "right",
    type: "view.pan",
  });

  expect(windowById(panned, "a")?.rect).toStrictEqual(windowById(pinned, "a")?.rect);
  expect(panned.camera.center.x).not.toBe(pinned.camera.center.x);
});

test("fit-all measures a pinned window like any other", () => {
  /*
   * The second false claim. If fit-all "left a pinned window in place" it would have to exclude it
   * from the bounds it fits. `getVisibleWindowBounds` filters on `isSelectableWindow` alone, so the
   * far window at x4000 is measured whether or not it is pinned — identical bounds either way.
   */
  const plain = canvas();
  const pinned = pin({ ...plain, activeWindowId: "b" });

  expect(getVisibleWindowBounds(pinned)).toStrictEqual(getVisibleWindowBounds(plain));
});
