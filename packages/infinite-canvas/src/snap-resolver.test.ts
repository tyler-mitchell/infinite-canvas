import { expect, test } from "vite-plus/test";

import { DEFAULT_INFINITE_CANVAS_SNAP_POLICY } from "./constants";
import { createInfiniteCanvasState, createInfiniteCanvasWindow } from "./factory";
import { applySnapToRect } from "./snap-resolver";
import type { InfiniteCanvasState } from "./types";

/**
 * Snap hysteresis (SNAP-005) — the flicker guarantee, which had no test.
 *
 * `README.md` promises "screen-pixel-stable thresholds and hysteresis (a caught guide holds until
 * you pull `releaseThreshold` away, so nothing flickers on the boundary)", and `snap-resolver.ts`
 * calls it risk R3: with a single distance a guide engages and releases at the same position, so
 * a pointer resting on the boundary makes the window shiver and the guide strobe every frame.
 *
 * That is the same shape as the semantic-LOD band that shipped broken earlier today — two
 * thresholds, a dead zone between them, and a defect that only appears on the *return* journey.
 * The band is asserted here from both directions for exactly that reason.
 *
 * Engagement state is not separate bookkeeping: `getEngagedGuideIds` reads `state.snapPreview`,
 * so these tests feed a real preview back in as the next frame's state, which is what the drag
 * loop does.
 */

type Kind = "note";

const ANCHOR_X = 500;

/** A static window whose left edge at `ANCHOR_X` is the candidate everything snaps to. */
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

/**
 * Only the x-axis guides.
 *
 * Both fixtures share `y: 0` and a height, so their horizontal edges align *exactly* and a
 * y-axis guide is always engaged at distance 0. The first draft of this file asserted
 * `preview === null` and failed on that, which was the test being imprecise rather than the
 * resolver being wrong: `preview` is non-null whenever *any* axis caught. The claim under test
 * is about the axis being moved, so that is what is inspected.
 */
const xGuides = (result: ReturnType<typeof snapAt>) =>
  (result.preview?.guides ?? []).filter((guide) => guide.axis === "x");

/** The next frame, with last frame's preview fed back in — exactly what the drag loop does. */
const withPreview = (
  state: InfiniteCanvasState<Kind>,
  preview: ReturnType<typeof snapAt>["preview"],
): InfiniteCanvasState<Kind> => ({ ...state, snapPreview: preview });

test("an idle guide engages at `threshold`", () => {
  // 10 world units at zoom 1 is 10 screen px, exactly the default threshold.
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
  // The whole guarantee in one assertion pair: the same 14px offset answers differently
  // depending on whether a guide was already engaged. Without this, the pointer sitting on the
  // boundary would snap and un-snap every frame.
  const state = baseState();
  const engaged = snapAt(state, ANCHOR_X + 10);

  expect(xGuides(engaged)).not.toHaveLength(0);

  const held = snapAt(withPreview(state, engaged.preview), ANCHOR_X + 14);

  expect(xGuides(held)).not.toHaveLength(0);
  expect(held.rect.x).toBe(ANCHOR_X);

  // ...and the idle answer at the identical distance is the opposite.
  expect(xGuides(snapAt(state, ANCHOR_X + 14))).toHaveLength(0);
});

test("a caught guide releases past `releaseThreshold`", () => {
  // The band has to end, or a guide caught once would drag the window forever.
  const state = baseState();
  const engaged = snapAt(state, ANCHOR_X + 10);
  const released = snapAt(withPreview(state, engaged.preview), ANCHOR_X + 20);

  expect(xGuides(released)).toHaveLength(0);
  expect(released.rect.x).toBe(ANCHOR_X + 20);
});

test("thresholds are screen pixels, so zoom changes the world distance they cover", () => {
  // "Screen-pixel-stable" is the claim: distance is |worldDelta| * zoom against a px threshold.
  // At zoom 2 the same 10px threshold reaches only 5 world units.
  const zoomed = baseState(2);

  expect(snapAt(zoomed, ANCHOR_X + 5).rect.x).toBe(ANCHOR_X);
  expect(snapAt(zoomed, ANCHOR_X + 7).rect.x).toBe(ANCHOR_X + 7);

  // The same 7-unit offset is well inside the threshold at zoom 1, which is the point: the
  // user's feel stays constant in the pixels they actually see.
  expect(snapAt(baseState(1), ANCHOR_X + 7).rect.x).toBe(ANCHOR_X);
});

test("a preview belonging to another window does not make this one sticky", () => {
  // `getEngagedGuideIds` filters on `snapPreview.windowId`. Without that check, dragging one
  // window would widen the threshold for the next window picked up.
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
