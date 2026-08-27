import { expect, test } from "vite-plus/test";

import { BOTTOM_INSET } from "./chrome-insets";
import { BUILT_IN_HUD_EXTENT, getBuiltInHudClearance } from "./hud-clearance";

/**
 * A corner surface sits above the rail the canvas puts in that corner.
 *
 * The numbers here are measured, not chosen, and pinning them is the point: `BUILT_IN_HUD_EXTENT`
 * describes the framework's chrome rather than this app's, so nothing tells us when it moves. If it
 * does, the arithmetic below stays true while the app is wrong on screen — so the measured total is
 * asserted outright, and a change to either constant has to be a deliberate edit to this line.
 *
 * What it cannot catch is the framework retuning its own HUD, which is why `ROADMAP.md` carries the
 * affordance that would end the coupling: the canvas publishing where its HUD ended up.
 */

test("the corner clearance sits above the rail, by the gap it says it leaves", () => {
  // Read from `data-slot="hud-group"` in the running app at 1440×900 on 2026-08-27.
  const measuredRailTopPx = 114;

  expect(BOTTOM_INSET + BUILT_IN_HUD_EXTENT).toBe(measuredRailTopPx);
  expect(getBuiltInHudClearance(BOTTOM_INSET)).toBeGreaterThan(measuredRailTopPx);
});

/** The inset is the caller's, so a consumer reserving more bottom chrome pushes the corner up. */
test("it moves with the inset the canvas was given, because the rail does", () => {
  expect(getBuiltInHudClearance(BOTTOM_INSET + 40) - getBuiltInHudClearance(BOTTOM_INSET)).toBe(40);
});
