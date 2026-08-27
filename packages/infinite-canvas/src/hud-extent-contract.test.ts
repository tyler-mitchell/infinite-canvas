import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

import { expect, test } from "vite-plus/test";

import { HUD_EXTENT_BOTTOM_PROPERTY, HUD_EXTENT_TOP_PROPERTY } from "./canvas-hud";

/**
 * The two custom properties the HUD publishes are a contract, and nothing type-checks a contract
 * made of strings.
 *
 * `--icx-hud-extent-bottom` is written here and read by a consumer's stylesheet or inline style.
 * Renaming it breaks every consumer *silently* — `var()` simply falls back, so a corner surface
 * quietly returns to the position it had before the affordance existed, which in Polkadot's case
 * was 37% of its minimap underneath a rail that swallowed the clicks. No typecheck, no error, no
 * visibly broken pixel.
 *
 * So the names are pinned in two directions. Below, that the value is what consumers were told; and
 * that `theme.css` — where the contract is documented, and the only place a consumer would look —
 * still describes the same two names. A rename now has to be a deliberate edit in three places
 * instead of a silent one in a single string.
 *
 * The consuming half is pinned in the consumer, `apps/polkadot/src/hud/hud-clearance.test.ts`,
 * because a package cannot assert against an app that depends on it.
 */

const THEME = fileURLToPath(new URL("./theme.css", import.meta.url));

test("the published property names are what consumers were told to read", () => {
  expect(HUD_EXTENT_BOTTOM_PROPERTY).toBe("--icx-hud-extent-bottom");
  expect(HUD_EXTENT_TOP_PROPERTY).toBe("--icx-hud-extent-top");
});

/**
 * Both values have been read off a real canvas, which this file cannot do — jsdom performs no
 * layout, so every rect here would be zero and an assertion on one would pass for the wrong reason.
 *
 * Driven in a browser on 2026-08-27 at 1440×900, against a change rather than once:
 * `--icx-hud-extent-bottom` read 114px with the consumer's bottom inset at 56 and 154px at 96, the
 * band's own top edge measuring 114 and 154 to match. `--icx-hud-extent-top` needed the status card
 * turned on, since the incubator ships with `statusCard: false` and it publishes 0px otherwise; with
 * the card it read 123px against a card whose bottom edge measured 123 from the viewport's top.
 */

test("the stylesheet documents both, since that is where a consumer looks for a token", () => {
  const theme = readFileSync(THEME, "utf8");

  expect(theme).toContain(HUD_EXTENT_BOTTOM_PROPERTY);
  expect(theme).toContain(HUD_EXTENT_TOP_PROPERTY);
});

/**
 * They are documented rather than declared, and the difference is load-bearing.
 *
 * The HUD writes them as an inline style, which outranks every stylesheet rule in every cascade
 * layer. A default in `theme.css` could never win, so declaring one would advertise an override
 * point that does not exist — the "present, generated, and beaten" defect this file's own header
 * warns about twice.
 */
test("the stylesheet does not declare them, because a declaration there could never win", () => {
  const theme = readFileSync(THEME, "utf8");

  for (const property of [HUD_EXTENT_BOTTOM_PROPERTY, HUD_EXTENT_TOP_PROPERTY]) {
    expect(theme).not.toContain(`${property}:`);
  }
});
