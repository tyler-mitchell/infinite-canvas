import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

import { expect, test } from "vite-plus/test";

const source = readFileSync(fileURLToPath(new URL("empty-project.tsx", import.meta.url)), "utf8");

/*
 * A source scan rather than a render.
 *
 * What matters here is which fact the invitation keys on, and that is one condition in one file.
 * Rendering it would need a canvas store, a listing observable and a router, and would still be
 * asserting the same line. Two source scans have caught real violations in this codebase already.
 */

test("the invitation asks whether the project is empty, not whether the canvas is", () => {
  /*
   * Closing every window is a normal thing to do. Keying on the canvas would tell somebody with
   * fifty notes that they have nothing, and the failure is silent: a card appears where none
   * belongs, which no error reports and a screenshot of an empty project cannot distinguish.
   */
  expect(source).toContain("listing.items.length > 0");
  expect(source).not.toContain("windows.length");
  expect(source).not.toContain("state.windows");
});

test("a listing that has not loaded renders nothing rather than an empty project", () => {
  // Without this, a slow read flashes "This project is empty" at a project that is full.
  expect(source).toContain("listing === null");
});
