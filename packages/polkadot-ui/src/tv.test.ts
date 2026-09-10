import { readFileSync } from "node:fs";

import { expect, test } from "vite-plus/test";

import { FONT_SIZES, tv } from "./tv.ts";

/*
 * Read as a file rather than imported with `?raw`: Vite's CSS pipeline claims the import and
 * hands back an empty string, which would make every check below pass while proving nothing.
 */
const themeCss = readFileSync(new URL("./theme.css", import.meta.url), "utf8");

/** Base size tokens only: --line-height and its siblings are modifiers on a size, not sizes. */
const declaredSizes = [...themeCss.matchAll(/--text-(pk-[a-z\d-]+):/g)]
  .map((match) => match[1]!)
  .filter((name) => !name.includes("--"));

test("the theme is read, and it declares sizes", () => {
  expect(themeCss.length).toBeGreaterThan(1000);
  expect(declaredSizes).toContain("pk-label");
  expect(declaredSizes).toContain("pk-display");
});

test("every size the theme declares is one tailwind-merge knows is a size", () => {
  const missing = [...new Set(declaredSizes)].filter(
    (name) => !(FONT_SIZES as readonly string[]).includes(name),
  );

  expect(missing).toEqual([]);
});

test("no name is claimed as a size that the theme does not declare", () => {
  const stale = FONT_SIZES.filter((name) => !declaredSizes.includes(name));

  expect(stale).toEqual([]);
});

test("a slot may set a size and a colour without either being dropped", () => {
  const styles = tv({ base: "text-pk-label text-pk-on-accent" })();

  expect(styles).toContain("text-pk-label");
  expect(styles).toContain("text-pk-on-accent");
});

test("two sizes still collapse to the last one", () => {
  const styles = tv({ base: "text-pk-label text-pk-display" })();

  expect(styles).toContain("text-pk-display");
  expect(styles).not.toContain("text-pk-label");
});
