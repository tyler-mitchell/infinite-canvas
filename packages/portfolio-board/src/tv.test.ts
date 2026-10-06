import { readdirSync, readFileSync } from "node:fs";

import { tv as stock } from "tailwind-variants";
import { expect, test } from "vite-plus/test";

import { FONT_SIZES, THEME_NAMES, tv } from "./tv.ts";

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

/*
 * The same hole the sizes had, in four more namespaces. `tw-merge` knows the names Tailwind ships;
 * a theme name is a class it has never seen, so it keeps it beside the one written to replace it and
 * the stylesheet's print order decides which draws.
 *
 * Found on the page, not here: a number field's step buttons pass `rounded-none` over the button's
 * `rounded-pk-control` and drew an 8px corner. Every namespace whose prefix and `tw-merge` group
 * share a word is listed in `THEME_NAMES` and checked against the sheet below.
 */

/**
 * The sheet's namespace for each `tw-merge` group. Only the radius differs — Tailwind writes it as
 * `rounded-` and the theme declares it as `--radius-` — and reading the wrong one reported every
 * name as undeclared while the merge itself was correct.
 */
const NAMESPACE_OF: Record<string, string> = { rounded: "radius", "max-w": "container" };

const declaredIn = (group: string) =>
  [
    ...themeCss.matchAll(
      new RegExp(String.raw`^\s*--${NAMESPACE_OF[group] ?? group}-(pk-[a-z\d-]+):`, "gm"),
    ),
  ].map(([, name]) => name!);

const merged = (base: string, over: string) => tv({ base })({ className: over }).split(" ").sort();

test("every namespace is read, and the sheet declares names in each", () => {
  const counted = Object.keys(THEME_NAMES).map((group) => [group, declaredIn(group).length]);

  expect(counted).toEqual([
    ["rounded", 8],
    ["shadow", 6],
    ["max-w", 1],
    ["ease", 2],
    ["animate", 2],
  ]);
});

test("every name the theme declares is one tailwind-merge is told about", () => {
  const missing = Object.entries(THEME_NAMES).flatMap(([group, names]) =>
    declaredIn(group)
      .filter((name) => !(names as readonly string[]).includes(name))
      .map((name) => `${group}-${name}`),
  );

  expect(missing).toEqual([]);
});

test("no name is claimed that the theme does not declare", () => {
  const stale = Object.entries(THEME_NAMES).flatMap(([group, names]) =>
    names.filter((name) => !declaredIn(group).includes(name)).map((name) => `${group}-${name}`),
  );

  expect(stale).toEqual([]);
});

test("a radius name works on a side and a corner, not only on the whole box", () => {
  expect(merged("rounded-l-pk-control", "rounded-l-none")).toEqual(["rounded-l-none"]);
  expect(merged("rounded-tl-pk-card", "rounded-tl-pk-chip")).toEqual(["rounded-tl-pk-chip"]);
  /* A side does not answer for the whole box, so both survive and the side wins where they meet. */
  expect(merged("rounded-pk-card", "rounded-l-pk-chip")).toEqual([
    "rounded-l-pk-chip",
    "rounded-pk-card",
  ]);
});

test("a later class replaces an earlier one in every namespace", () => {
  expect(merged("rounded-pk-control", "rounded-none")).toEqual(["rounded-none"]);
  expect(merged("rounded-pk-control", "rounded-pk-card")).toEqual(["rounded-pk-card"]);
  expect(merged("shadow-pk-tray", "shadow-none")).toEqual(["shadow-none"]);
  expect(merged("shadow-pk-tray", "shadow-pk-cell")).toEqual(["shadow-pk-cell"]);
  expect(merged("max-w-pk-page", "max-w-none")).toEqual(["max-w-none"]);
  expect(merged("ease-pk-swift", "ease-linear")).toEqual(["ease-linear"]);
  expect(merged("animate-pk-ping", "animate-none")).toEqual(["animate-none"]);
});

/**
 * The other way this kit names a theme value: `duration-(--pk-duration-hover)` rather than a name
 * from a namespace. Tailwind reads the parentheses as a custom property, and `tw-merge` classifies
 * it by the prefix alone, so unlike a theme name it needs nothing taught. Checked rather than
 * assumed, because a class that fails to collapse is silent and these two are written 53 times.
 */
test("a custom property in parentheses collapses like a plain value", () => {
  expect(merged("duration-150", "duration-(--pk-duration-hover)")).toEqual([
    "duration-(--pk-duration-hover)",
  ]);
  expect(merged("duration-(--pk-duration-hover)", "duration-(--pk-duration-detail)")).toEqual([
    "duration-(--pk-duration-detail)",
  ]);
  expect(merged("ring-offset-2", "ring-offset-(color:--pk-ring-seat)")).toEqual([
    "ring-offset-(color:--pk-ring-seat)",
    "ring-offset-2",
  ]);
  expect(merged("ring-offset-(color:--pk-surface)", "ring-offset-(color:--pk-ring-seat)")).toEqual([
    "ring-offset-(color:--pk-ring-seat)",
  ]);
});

/**
 * The third form, and the one with a hole. `[background:var(…)]` names a whole property; `bg-*`
 * names its colour. `tw-merge` files them separately and is right to — `background` is the shorthand
 * and outranks nothing in particular — so a consumer passing `bg-pk-surface` to a slot that paints
 * with the bracket form gets both, and the stylesheet decides.
 *
 * Five slots write it: three aurora blobs, the aurora's vignette, and the sparkline's glow. Each is
 * a gradient or an image rather than a flat colour, which is why the bracket is there at all.
 */
test("a bracket property and a colour utility do not collapse, which is the shorthand's own rule", () => {
  expect(merged("[background:var(--pk-aurora-teal)]", "bg-pk-surface")).toEqual([
    "[background:var(--pk-aurora-teal)]",
    "bg-pk-surface",
  ]);
  /* Two of the same bracket property do collapse, so a slot cannot paint twice by accident. */
  expect(
    merged("[background:var(--pk-aurora-teal)]", "[background:var(--pk-aurora-white)]"),
  ).toEqual(["[background:var(--pk-aurora-white)]"]);
});

/** A size and a colour share the `text-` prefix and must both survive, which is why they are listed. */
test("a theme size and a theme colour still live on one element", () => {
  expect(merged("text-pk-note", "text-pk-ink-bright")).toEqual([
    "text-pk-ink-bright",
    "text-pk-note",
  ]);
});
