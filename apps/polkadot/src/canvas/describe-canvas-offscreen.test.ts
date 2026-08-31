import { createInfiniteCanvasState, createInfiniteCanvasWindow } from "@hyphened/infinite-canvas";
import { expect, test } from "vite-plus/test";

import { describeCanvas } from "./describe-canvas";
import type { WindowKind } from "./window-registry";

const VIEWPORT = { height: 800, width: 1200 };

const windowAt = (id: string, x: number) =>
  createInfiniteCanvasWindow<WindowKind>({
    id,
    kind: "note",
    rect: { height: 200, width: 320, x, y: 0 },
    title: id,
  });

const canvasLookingAt = (centreX: number) =>
  createInfiniteCanvasState<WindowKind>({
    camera: { center: { x: centreX, y: 0 }, zoom: 1 },
    viewport: VIEWPORT,
    windows: [windowAt("near", 0), windowAt("far", 5000)],
  });

const entryFor = (described: string, id: string) =>
  described.split("; ").find((part) => part.includes(`[${id}]`)) ?? "";

test("a window the camera cannot see is said to be offscreen", () => {
  const described = describeCanvas(canvasLookingAt(0));

  expect(entryFor(described, "far")).toContain("offscreen");
  expect(entryFor(described, "near")).not.toContain("offscreen");
});

test("the same window stops being offscreen when the camera goes to it", () => {
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
  const described = describeCanvas(canvasLookingAt(0));

  expect(described).toContain("[far], offscreen");
});
