import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

import { expect, test } from "vite-plus/test";

import { BARE_CORNER_PX, GAP_PX } from "./hud-clearance";

/**
 * A corner surface sits above the rail the canvas puts in that corner, on the canvas's own numbers.
 *
 * There is no arithmetic left here to test — the position comes from `--icx-hud-extent-bottom`,
 * which the framework writes as it lays its HUD out. What is worth guarding is that this app is
 * still *asking*: an earlier version restated the rail's height as a constant, and the version
 * before that guessed it, and both were wrong on screen while every test passed.
 *
 * So the assertion is on the source. What goes missing here is the `var()` itself, and it goes
 * missing the moment somebody "simplifies" a `calc` back into a number.
 */

const SURFACES = fileURLToPath(new URL("./hud-surfaces.tsx", import.meta.url));

test("the corner asks the canvas where its HUD ended up", () => {
  const source = readFileSync(SURFACES, "utf8");

  expect(source).toContain("--icx-hud-extent-bottom");
  /*
   * The named constants, not their values. The first draft of this asserted the rendered `16px`
   * and failed: the source interpolates, so the digits never appear as text. Asserting the names
   * is what was wanted anyway — it catches a number being inlined over the constant, which is the
   * shape every earlier version of this bug took.
   */
  expect(source).toContain("BARE_CORNER_PX");
  expect(source).toContain("GAP_PX");
  expect(BARE_CORNER_PX).toBeGreaterThan(0);
  expect(GAP_PX).toBeGreaterThan(0);
});

test("the scan would notice the var being replaced by a number", () => {
  const flattened = readFileSync(SURFACES, "utf8").replaceAll("--icx-hud-extent-bottom", "122");

  expect(flattened).not.toContain("--icx-hud-extent-bottom");
});
