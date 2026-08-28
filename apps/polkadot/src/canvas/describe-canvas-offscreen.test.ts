import { createInfiniteCanvasState, createInfiniteCanvasWindow } from "@hyphened/infinite-canvas";
import { expect, test } from "vite-plus/test";

import { describeCanvas } from "./describe-canvas";
import type { WindowKind } from "./window-registry";

/**
 * The fourth way a window is on the canvas without being on screen.
 *
 * `describe-canvas.ts` already reports minimized, behind-a-tab and another-desktop, and its own
 * comment counts "the two ways" while handling three. The one it did not handle is the camera: a
 * window can be admitted, normal and unhidden and still be a mile off the edge, so a report saying
 * "3 window(s)" gave no hint that none of them was in front of you — and a caller with no hint has
 * no reason to call `window.reveal`, which exists for exactly this.
 *
 * Camera-derived rather than a state, which is what these fixtures turn on: the same window is
 * offscreen or not depending only on where you are looking, and a test that moved the *window*
 * would prove a property of the rect instead.
 *
 * A separate file from `describe-canvas.test.ts` deliberately: that one is being edited elsewhere,
 * and adding to it would mean committing somebody's unfinished work along with this.
 */

const VIEWPORT = { height: 800, width: 1200 };

const windowAt = (id: string, x: number) =>
  createInfiniteCanvasWindow<WindowKind>({
    id,
    kind: "note",
    rect: { height: 200, width: 320, x, y: 0 },
    title: id,
  });

/** Default camera sees roughly x -600..600 at this viewport, so `far` is well outside it. */
const canvasLookingAt = (centreX: number) =>
  createInfiniteCanvasState<WindowKind>({
    camera: { center: { x: centreX, y: 0 }, zoom: 1 },
    viewport: VIEWPORT,
    windows: [windowAt("near", 0), windowAt("far", 5000)],
  });

/**
 * One window's entry, found by its handle rather than by what sits next to it.
 *
 * The first draft asserted `'note "near" [near], offscreen'` and failed on a correct report:
 * `createInfiniteCanvasState` makes the first window active, so "active, selected" lands between
 * the id and the label. Asserting adjacency in a list whose parts are conditional tests the fixture
 * as much as the code.
 */
const entryFor = (described: string, id: string) =>
  described.split("; ").find((part) => part.includes(`[${id}]`)) ?? "";

test("a window the camera cannot see is said to be offscreen", () => {
  const described = describeCanvas(canvasLookingAt(0));

  expect(entryFor(described, "far")).toContain("offscreen");
  expect(entryFor(described, "near")).not.toContain("offscreen");
});

test("the same window stops being offscreen when the camera goes to it", () => {
  /*
   * The discrimination half, and it moves the camera rather than the window. Offscreen is not a
   * property of a rect — it is the relationship between the rect and where you are looking, which
   * is why this is the one label in the report that changes without anybody acting on a window.
   */
  const described = describeCanvas(canvasLookingAt(5000));

  expect(entryFor(described, "near")).toContain("offscreen");
  expect(entryFor(described, "far")).not.toContain("offscreen");
});

test("offscreen reads alongside the other things a window can be, not instead of them", () => {
  const described = describeCanvas({
    ...canvasLookingAt(0),
    activeWindowId: "far",
    selection: { anchorWindowId: "far", windowIds: ["far"] },
  });

  expect(described).toContain('note "far" [far], active, selected, offscreen');
});

test("the report still names the handle window.reveal takes, which is the point of saying it", () => {
  // Telling a caller something is out of view is only useful with the id that brings it back.
  const described = describeCanvas(canvasLookingAt(0));

  expect(described).toContain("[far], offscreen");
});
