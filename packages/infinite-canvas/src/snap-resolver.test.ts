import { expect, test } from "vite-plus/test";

import { DEFAULT_INFINITE_CANVAS_SNAP_POLICY } from "./constants";
import { createInfiniteCanvasState, createInfiniteCanvasWindow } from "./factory";
import { applySnapToRect } from "./snap-resolver";
import type { InfiniteCanvasState } from "./types";

type Kind = "note";

const ANCHOR_X = 500;

const baseState = (zoom = 1): InfiniteCanvasState<Kind> => ({
  ...createInfiniteCanvasState<Kind>({
    camera: { center: { x: 400, y: 200 }, zoom },
    windows: [
      createInfiniteCanvasWindow<Kind>({
        id: "anchor",
        kind: "note",
        rect: { height: 200, width: 300, x: ANCHOR_X, y: 0 },
        title: "Anchor",
      }),
      createInfiniteCanvasWindow<Kind>({
        id: "mover",
        kind: "note",
        rect: { height: 200, width: 300, x: 0, y: 0 },
        title: "Mover",
      }),
    ],
  }),
  viewport: { height: 800, width: 1200 },
});

const movedTo = (x: number) => ({ height: 200, width: 300, x, y: 0 });

const snapAt = (state: InfiniteCanvasState<Kind>, x: number) =>
  applySnapToRect(state, "mover", movedTo(x), DEFAULT_INFINITE_CANVAS_SNAP_POLICY);

const xGuides = (result: ReturnType<typeof snapAt>) =>
  (result.preview?.guides ?? []).filter((guide) => guide.axis === "x");

const withPreview = (
  state: InfiniteCanvasState<Kind>,
  preview: ReturnType<typeof snapAt>["preview"],
): InfiniteCanvasState<Kind> => ({ ...state, snapPreview: preview });

test("an idle guide engages at `threshold`", () => {
  const result = snapAt(baseState(), ANCHOR_X + 10);

  expect(xGuides(result)).not.toHaveLength(0);
  expect(result.rect.x).toBe(ANCHOR_X);
});

test("an idle guide does not engage past `threshold`", () => {
  const result = snapAt(baseState(), ANCHOR_X + 14);

  expect(xGuides(result)).toHaveLength(0);
  expect(result.rect.x).toBe(ANCHOR_X + 14);
});

test("SNAP-005: a caught guide holds where an idle one would not — the band itself", () => {
  const state = baseState();
  const engaged = snapAt(state, ANCHOR_X + 10);

  expect(xGuides(engaged)).not.toHaveLength(0);

  const held = snapAt(withPreview(state, engaged.preview), ANCHOR_X + 14);

  expect(xGuides(held)).not.toHaveLength(0);
  expect(held.rect.x).toBe(ANCHOR_X);

  expect(xGuides(snapAt(state, ANCHOR_X + 14))).toHaveLength(0);
});

test("a caught guide releases past `releaseThreshold`", () => {
  const state = baseState();
  const engaged = snapAt(state, ANCHOR_X + 10);
  const released = snapAt(withPreview(state, engaged.preview), ANCHOR_X + 20);

  expect(xGuides(released)).toHaveLength(0);
  expect(released.rect.x).toBe(ANCHOR_X + 20);
});

test("thresholds are screen pixels, so zoom changes the world distance they cover", () => {
  const zoomed = baseState(2);

  expect(snapAt(zoomed, ANCHOR_X + 5).rect.x).toBe(ANCHOR_X);
  expect(snapAt(zoomed, ANCHOR_X + 7).rect.x).toBe(ANCHOR_X + 7);

  expect(snapAt(baseState(1), ANCHOR_X + 7).rect.x).toBe(ANCHOR_X);
});

test("a preview belonging to another window does not make this one sticky", () => {
  const state = baseState();
  const engaged = snapAt(state, ANCHOR_X + 10);
  const foreign = {
    ...engaged.preview!,
    windowId: "someone-else",
  };

  expect(xGuides(snapAt(withPreview(state, foreign), ANCHOR_X + 14))).toHaveLength(0);
});

test("snapping off is a pass-through", () => {
  const disabled = applySnapToRect(baseState(), "mover", movedTo(ANCHOR_X + 2), {
    ...DEFAULT_INFINITE_CANVAS_SNAP_POLICY,
    enabled: false,
  });

  expect(disabled.preview).toBeNull();
  expect(disabled.rect.x).toBe(ANCHOR_X + 2);
});
