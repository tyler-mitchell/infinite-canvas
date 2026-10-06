import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

import { expect, test } from "vite-plus/test";

import { HUD_EXTENT_BOTTOM_PROPERTY, HUD_EXTENT_TOP_PROPERTY } from "./canvas-hud";

const THEME = fileURLToPath(new URL("./theme.css", import.meta.url));

test("the published property names are what consumers were told to read", () => {
  expect(HUD_EXTENT_BOTTOM_PROPERTY).toBe("--icx-hud-extent-bottom");
  expect(HUD_EXTENT_TOP_PROPERTY).toBe("--icx-hud-extent-top");
});

test("the stylesheet documents both, since that is where a consumer looks for a token", () => {
  const theme = readFileSync(THEME, "utf8");

  expect(theme).toContain(HUD_EXTENT_BOTTOM_PROPERTY);
  expect(theme).toContain(HUD_EXTENT_TOP_PROPERTY);
});

test("the stylesheet does not declare them, because a declaration there could never win", () => {
  const theme = readFileSync(THEME, "utf8");

  for (const property of [HUD_EXTENT_BOTTOM_PROPERTY, HUD_EXTENT_TOP_PROPERTY]) {
    expect(theme).not.toContain(`${property}:`);
  }
});
