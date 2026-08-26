import { expect, test } from "vite-plus/test";

import { createInfiniteCanvasState, createInfiniteCanvasWindow } from "./factory";
import { worldRectToScreenRect } from "./geometry";
import type { InfiniteCanvasState, InfiniteCanvasViewport } from "./types";
import {
  getInfiniteCanvasConnectionAffordanceWindowId,
  getInfiniteCanvasConnectionHandles,
  getInfiniteCanvasConnectionPreviewPath,
} from "./window-connection";

/**
 * These exist because the first version of this gesture shipped broken in a way a typecheck, a
 * green suite, and a scripted click all missed.
 *
 * The handle sat outside the window and its visibility was driven by "is the pointer over the
 * window", so it disappeared the moment anyone moved toward it. The only reason it ever appeared to
 * work was that the test dispatched `pointerdown` straight at the element — the one path a real
 * pointer never takes, since a real pointer must *travel* there first.
 *
 * So the load-bearing test here is `reach`: it walks the pointer from inside a window to a handle,
 * one step at a time, and asserts the affordance survives every step. It fails against the
 * behaviour that shipped.
 */

const VIEWPORT: InfiniteCanvasViewport = { height: 800, width: 1200 };

function stateWith(
  windows: readonly Readonly<{ height: number; id: string; width: number; x: number; y: number }>[],
): InfiniteCanvasState<"note"> {
  return createInfiniteCanvasState<"note">({
    camera: { center: { x: 0, y: 0 }, zoom: 1 },
    viewport: VIEWPORT,
    windows: windows.map((window, index) =>
      createInfiniteCanvasWindow<"note">({
        id: window.id,
        kind: "note",
        rect: { height: window.height, width: window.width, x: window.x, y: window.y },
        title: window.id,
        zIndex: index + 1,
      }),
    ),
  });
}

const SINGLE = stateWith([{ height: 200, id: "a", width: 400, x: -200, y: -100 }]);

test("a window offers one handle per edge", () => {
  const window = SINGLE.windows[0];

  if (window === undefined) {
    throw new Error("fixture window missing");
  }

  const handles = getInfiniteCanvasConnectionHandles(window, SINGLE.camera, SINGLE.viewport);

  expect(handles.map((handle) => handle.edge)).toEqual(["north", "east", "south", "west"]);
  expect(handles.every((handle) => handle.windowId === "a")).toBe(true);
});

test("each handle sits outside the edge it names", () => {
  const window = SINGLE.windows[0];

  if (window === undefined) {
    throw new Error("fixture window missing");
  }

  const rect = worldRectToScreenRect(SINGLE.camera, SINGLE.viewport, window.rect);
  const handles = getInfiniteCanvasConnectionHandles(window, SINGLE.camera, SINGLE.viewport);
  const byEdge = new Map(handles.map((handle) => [handle.edge, handle.point]));

  expect(byEdge.get("north")?.y).toBeLessThan(rect.top);
  expect(byEdge.get("south")?.y).toBeGreaterThan(rect.top + rect.height);
  expect(byEdge.get("west")?.x).toBeLessThan(rect.left);
  expect(byEdge.get("east")?.x).toBeGreaterThan(rect.left + rect.width);
});

test("the pointer keeps a window's affordance the whole way to every handle", () => {
  const window = SINGLE.windows[0];

  if (window === undefined) {
    throw new Error("fixture window missing");
  }

  const rect = worldRectToScreenRect(SINGLE.camera, SINGLE.viewport, window.rect);
  const start = { x: rect.left + rect.width / 2, y: rect.top + rect.height / 2 };

  for (const handle of getInfiniteCanvasConnectionHandles(window, SINGLE.camera, SINGLE.viewport)) {
    // Walk the pointer there rather than teleporting: the defect only appears in transit.
    const held = Array.from({ length: 41 }, (unused, step) => step / 40).reduce<string | null>(
      (previousWindowId, progress) =>
        getInfiniteCanvasConnectionAffordanceWindowId(
          SINGLE,
          {
            x: start.x + (handle.point.x - start.x) * progress,
            y: start.y + (handle.point.y - start.y) * progress,
          },
          previousWindowId,
        ),
      null,
    );

    expect(held).toBe("a");
  }
});

test("the affordance is not offered for a pointer nowhere near a window", () => {
  expect(getInfiniteCanvasConnectionAffordanceWindowId(SINGLE, { x: 1100, y: 700 }, "a")).toBe(
    null,
  );
});

/**
 * Two windows a hair apart, so one's halo overlaps the other's rect.
 *
 * This is the case stickiness could break: holding on too eagerly would make a neighbour
 * unreachable, and holding on too weakly is the original bug.
 */
const PAIR = stateWith([
  { height: 200, id: "a", width: 400, x: -400, y: -100 },
  { height: 200, id: "b", width: 400, x: 20, y: -100 },
]);

test("a neighbour takes the affordance once the pointer is properly inside it", () => {
  const b = PAIR.windows[1];

  if (b === undefined) {
    throw new Error("fixture window missing");
  }

  const rect = worldRectToScreenRect(PAIR.camera, PAIR.viewport, b.rect);

  expect(
    getInfiniteCanvasConnectionAffordanceWindowId(
      PAIR,
      { x: rect.left + rect.width / 2, y: rect.top + rect.height / 2 },
      "a",
    ),
  ).toBe("b");
});

test("a neighbour does not steal the affordance from a pointer merely passing near it", () => {
  const a = PAIR.windows[0];
  const b = PAIR.windows[1];

  if (a === undefined || b === undefined) {
    throw new Error("fixture window missing");
  }

  const aRect = worldRectToScreenRect(PAIR.camera, PAIR.viewport, a.rect);
  const bRect = worldRectToScreenRect(PAIR.camera, PAIR.viewport, b.rect);
  // In the gap: outside both rects, inside both halos, reaching for a's east handle.
  const between = {
    x: (aRect.left + aRect.width + bRect.left) / 2,
    y: aRect.top + aRect.height / 2,
  };

  expect(getInfiniteCanvasConnectionAffordanceWindowId(PAIR, between, "a")).toBe("a");
});

test("a minimized window offers no affordance", () => {
  const minimized = createInfiniteCanvasState<"note">({
    camera: { center: { x: 0, y: 0 }, zoom: 1 },
    viewport: VIEWPORT,
    windows: [
      createInfiniteCanvasWindow<"note">({
        id: "a",
        kind: "note",
        mode: "minimized",
        rect: { height: 200, width: 400, x: -200, y: -100 },
        title: "a",
      }),
    ],
  });

  expect(getInfiniteCanvasConnectionAffordanceWindowId(minimized, { x: 600, y: 400 }, "a")).toBe(
    null,
  );
});

/**
 * The claim the preview rests on: a bare point routes exactly as a zero-extent rect, so the line
 * shown during a drag is the line that will be committed rather than one that resembles it.
 */
test("a preview to a point ends exactly on that point", () => {
  const path = getInfiniteCanvasConnectionPreviewPath(
    { height: 200, width: 400, x: 0, y: 0 },
    { x: 900, y: 640 },
    { route: "orthogonal" },
  );

  expect(path.points.at(-1)).toEqual({ x: 900, y: 640 });
});

test("a preview to a point routes with the same elbow as a preview to a rect there", () => {
  const sourceRect = { height: 200, width: 400, x: 0, y: 0 };
  const toPoint = getInfiniteCanvasConnectionPreviewPath(
    sourceRect,
    { x: 900, y: 640 },
    { route: "orthogonal" },
  );
  const toDegenerateRect = getInfiniteCanvasConnectionPreviewPath(
    sourceRect,
    { height: 0, width: 0, x: 900, y: 640 },
    { route: "orthogonal" },
  );

  expect(toPoint.points).toEqual(toDegenerateRect.points);
  expect(toPoint.points.length).toBe(4);
});
