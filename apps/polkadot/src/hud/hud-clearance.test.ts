import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

import { expect, test } from "vite-plus/test";

import { BARE_CORNER_PX, GAP_PX } from "./hud-clearance";

const SURFACES = fileURLToPath(new URL("./hud-surfaces.tsx", import.meta.url));

test("the corner asks the canvas where its HUD ended up", () => {
  const source = readFileSync(SURFACES, "utf8");

  expect(source).toContain("--icx-hud-extent-bottom");
  expect(source).toContain("BARE_CORNER_PX");
  expect(source).toContain("GAP_PX");
  expect(BARE_CORNER_PX).toBeGreaterThan(0);
  expect(GAP_PX).toBeGreaterThan(0);
});

test("the scan would notice the var being replaced by a number", () => {
  const flattened = readFileSync(SURFACES, "utf8").replaceAll("--icx-hud-extent-bottom", "122");

  expect(flattened).not.toContain("--icx-hud-extent-bottom");
});
