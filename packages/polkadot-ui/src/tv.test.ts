import { readdirSync, readFileSync } from "node:fs";

import { tv as stock } from "tailwind-variants";
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

/**
 * And nothing may reach for the stock one. The readme states this as a rule and no rule read it:
 * a component importing `tv` from `tailwind-variants` passed the whole suite, and the damage is
 * quiet and shape-dependent — the badge kept both its size and its colour under the stock merge,
 * because the size happened to come last, while the pair in the fixture below loses one.
 *
 * `tv.ts` builds the configured one and this file imports the stock one on purpose, so both are
 * named. Anything else importing it is a slot that may silently lose a class.
 */
const STOCK_ON_PURPOSE = ["tv.ts", "tv.test.ts"];

const componentDir = new URL("./components/", import.meta.url);

const reachesForStock = (sources: readonly { readonly file: string; readonly source: string }[]) =>
  sources
    .filter(({ file }) => !STOCK_ON_PURPOSE.includes(file))
    .flatMap(({ file, source }) =>
      [...source.matchAll(/import\s*\{([^}]*)\}\s*from\s*"tailwind-variants"/g)]
        .flatMap(([, list]) => list!.split(","))
        .map((part) => part.trim())
        .filter((part) => /^(?:tv|createTV)\b/.test(part))
        .map((part) => `${file} imports ${part} from tailwind-variants`),
    )
    .sort();

test("a file reaching for the stock tv is reported", () => {
  const stock = [
    { file: "badge.tsx", source: 'import { tv, type VariantProps } from "tailwind-variants";' },
  ];
  const typed = [
    { file: "badge.tsx", source: 'import type { VariantProps } from "tailwind-variants";' },
  ];

  expect(reachesForStock(stock)).toEqual(["badge.tsx imports tv from tailwind-variants"]);
  expect(reachesForStock(typed)).toEqual([]);
  /* The two that mean to: one builds the configured tv, the other compares against the stock. */
  expect(reachesForStock([{ file: "tv.ts", source: stock[0]!.source }])).toEqual([]);
});

test("nothing but the two that mean to reaches for the stock tv", () => {
  const sources = [
    ...readdirSync(new URL(".", import.meta.url))
      .filter((name) => name.endsWith(".ts") || name.endsWith(".tsx"))
      .map((file) => ({ file, source: readFileSync(new URL(file, import.meta.url), "utf8") })),
    ...readdirSync(componentDir)
      .filter((name) => name.endsWith(".tsx"))
      .map((file) => ({ file, source: readFileSync(new URL(file, componentDir), "utf8") })),
  ];

  /* Read first: the files are read, and the one that does import it on purpose is among them. */
  expect(sources.length).toBeGreaterThan(50);
  expect(sources.some(({ file }) => file === "tv.ts")).toBe(true);
  expect(reachesForStock(sources)).toEqual([]);
});

test("the stock tv is what makes the configured one necessary", () => {
  const both = "text-pk-label text-pk-on-accent";

  /* The stock merge keeps the colour and drops the size, without saying so. */
  expect(stock({ base: both })()).toBe("text-pk-on-accent");
  expect(tv({ base: both })().split(" ")).toHaveLength(2);
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
