import { readdirSync, readFileSync } from "node:fs";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { expect, test } from "vite-plus/test";

import * as kit from "./index.ts";

interface VariantObject {
  readonly variants?: Record<string, Record<string, unknown>>;
  readonly defaultVariants?: Record<string, unknown>;
}

interface Pair {
  readonly owner: string;
  readonly draw: unknown;
  readonly config: VariantObject;
}

/** What each component that reads a required prop needs before any variant can be seen. */
const REQUIRED: Record<string, Record<string, unknown>> = {
  ActivityFeed: { entries: [] },
  ActivityGrid: { days: [] },
  Avatar: { name: "Ada Lovelace" },
  Bars: { values: [1, 2, 3] },
  Binding: { keys: ["a"], action: "do the thing" },
  Breakdown: { parts: [{ name: "p", share: 1, color: "red" }] },
  LayoutPreview: { panes: [] },
  ReceiptBarcode: { value: "order 42" },
  Sparkline: { values: [1, 2, 3] },
  SwipeDeck: { items: [] },
};

/** `surfaceVariants` describes `Surface`, so the pair is derived rather than listed by hand. */
const pairs: readonly Pair[] = Object.entries(kit)
  .filter(([name]) => name.endsWith("Variants"))
  .flatMap(([name, value]) => {
    const component = name.slice(0, -"Variants".length);
    const owner = component.charAt(0).toUpperCase() + component.slice(1);
    const drawn = (kit as Record<string, unknown>)[owner];

    return typeof drawn === "function"
      ? [{ owner, draw: drawn, config: value as VariantObject }]
      : [];
  });

/**
 * Every value of every variant, drawn. The pages show the values they happen to use, so a tone or
 * a size nobody demonstrates is otherwise never run at all.
 *
 * This asks only whether drawing it throws. Asking whether the value *changed* anything sounds
 * like the better question and cannot be answered here: a `tv` object does not belong only to the
 * component its name resembles. `receiptVariants` also dresses `ReceiptLine`, `terminalVariants`
 * dresses `TerminalCommand`, `LayoutPreview` takes `active` per pane out of its data, `SwipeDeck`
 * holds `held` in its own state, and `ToggleGroup` declares `pressed` as two empty strings so a
 * compound variant can name it. Handing any of those to the root does nothing, which reads as a
 * variant that draws nothing and is not one.
 */
const eachValue = (pairs: readonly Pair[]) => {
  const broke: string[] = [];
  let drawn = 0;

  for (const { owner, draw, config } of pairs) {
    for (const [key, values] of Object.entries(config.variants ?? {})) {
      for (const value of Object.keys(values)) {
        /* A boolean variant names its values "true" and "false", and "false" is a truthy string. */
        const given = value === "true" ? true : value === "false" ? false : value;

        drawn++;
        try {
          renderToStaticMarkup(createElement(draw as never, { ...REQUIRED[owner], [key]: given }));
        } catch (error) {
          broke.push(`${owner}.${key}=${value}: ${(error as Error).message.slice(0, 50)}`);
        }
      }
    }
  }

  return { drawn, broke };
};

test("a variant value that cannot be drawn is reported", () => {
  const angry = () => {
    throw new Error("no");
  };

  const { drawn, broke } = eachValue([
    {
      owner: "Angry",
      draw: angry,
      config: { variants: { tone: { calm: "a", loud: "b" } } },
    },
  ]);

  expect(drawn).toBe(2);
  expect(broke).toEqual(["Angry.tone=calm: no", "Angry.tone=loud: no"]);
});

test("the pairing reaches most of the kit", () => {
  expect(pairs.length).toBeGreaterThan(25);
  expect(eachValue(pairs).drawn).toBeGreaterThan(70);
});

test("every value of every variant the kit declares can be drawn", () => {
  expect(eachValue(pairs).broke).toEqual([]);
});

/**
 * The one place in the kit where two variants together mean something neither means alone. On its
 * own `pressed` is two empty strings, so all four looks come out of the compound list, and a
 * mistake there costs a state its whole appearance while every variant still reads as declared.
 *
 * The styling object is called directly rather than through the component, because that is what a
 * compound variant is: `pressed` reaches it from Base UI through the `className` function, not
 * from a prop, so handing it to the component would prove nothing.
 */
const COMBINATIONS = [
  { look: "segmented", pressed: true },
  { look: "segmented", pressed: false },
  { look: "chips", pressed: true },
  { look: "chips", pressed: false },
] as const;

test("the four combinations each dress the item differently", () => {
  const drawn = COMBINATIONS.map(({ look, pressed }) =>
    kit.toggleGroupVariants({ look, pressed }).item(),
  );

  expect(new Set(drawn).size).toBe(4);
});

test("a pressed toggle carries a fill its unpressed twin does not", () => {
  for (const look of ["segmented", "chips"] as const) {
    const on = kit.toggleGroupVariants({ look, pressed: true }).item();
    const off = kit.toggleGroupVariants({ look, pressed: false }).item();

    expect(on).toMatch(/\bbg-/);
    expect(on).not.toBe(off);
  }
});

test("the item still resolves when only the pressed state is given", () => {
  const bare = kit.toggleGroupVariants({ pressed: true }).item();
  const named = kit.toggleGroupVariants({ look: "segmented", pressed: true }).item();

  expect(bare).toBe(named);
});

/** The plural a section writes, against the variant key it is counting. */
const KEY_FOR: Record<string, string> = {
  tones: "tone",
  sizes: "size",
  paddings: "padding",
  shapes: "shape",
  alignments: "align",
  justifies: "justify",
};

/**
 * A count written beside the thing it counts drifts the moment a value is added, and nothing
 * else notices. The `Kind` in the same row names the component, so the pair is read rather than
 * guessed: "surface · 7 tones" is checked against `surfaceVariants`.
 *
 * Counts that no variant object owns are a different problem and this cannot help with them: the
 * overview said "seven parts" beside a section drawing twelve cards, and the honest repair was to
 * stop stating a number rather than to keep one correct.
 */
const miscounted = (pages: readonly { readonly page: string; readonly source: string }[]) =>
  pages.flatMap(({ page, source }) =>
    [...source.matchAll(/<Meta>([^<]*)<\/Meta>/g)].flatMap((meta) => {
      const before = source.slice(0, meta.index);
      const kind = [...before.matchAll(/<Kind>([^<]*)<\/Kind>/g)].at(-1)?.[1];
      if (!kind) return [];

      const owner = kind.trim().replace(/\s+(.)/g, (_, c: string) => c.toUpperCase());
      const config = (kit as Record<string, VariantObject | undefined>)[`${owner}Variants`];
      if (!config?.variants) return [];

      /* "3 sizes · plus icon" counts icon apart, and icon is a size, so the section says four. */
      const named = [...meta[1]!.matchAll(/\bplus\s+([a-z]+)/g)].map(([, extra]) => extra!);

      return [
        ...meta[1]!.matchAll(/(\d+)\s+(tones|sizes|paddings|shapes|alignments|justifies)/g),
      ].flatMap(([said, count, plural]) => {
        const values = Object.keys(config.variants?.[KEY_FOR[plural!]!] ?? {});
        const apart = named.filter((extra) => values.includes(extra)).length;
        const stated = Number(count) + apart;

        return values.length === stated
          ? []
          : [`${page} ${kind}: said ${said}${apart ? ` plus ${apart}` : ""}, has ${values.length}`];
      });
    }),
  );

const pageSources = readdirSync(new URL("../app/routes/", import.meta.url))
  .filter((name) => name.endsWith(".tsx"))
  .map((page) => ({
    page,
    source: readFileSync(new URL(`../app/routes/${page}`, import.meta.url), "utf8"),
  }));

test("a count that has drifted from its variant is reported", () => {
  const wrong = [
    { page: "p.tsx", source: "<Kind>surface</Kind><Meta>2 tones · 5 paddings</Meta>" },
  ];
  const right = [
    { page: "p.tsx", source: "<Kind>surface</Kind><Meta>7 tones · 5 paddings</Meta>" },
  ];

  expect(miscounted(wrong)).toEqual(["p.tsx surface: said 2 tones, has 7"]);
  expect(miscounted(right)).toEqual([]);
});

test("a value the section counts apart is still counted", () => {
  /* icon is a size, so three sizes and an icon is four; the same words about tones are not. */
  const sizes = [
    { page: "p.tsx", source: "<Kind>button</Kind><Meta>4 tones × 3 sizes · plus icon</Meta>" },
  ];
  const tones = [{ page: "p.tsx", source: "<Kind>button</Kind><Meta>3 tones · plus icon</Meta>" }];

  expect(miscounted(sizes)).toEqual([]);
  expect(miscounted(tones)).toEqual(["p.tsx button: said 3 tones, has 4"]);
});

test("every count a page states beside a variant is the count it has", () => {
  expect(pageSources.length).toBeGreaterThan(6);
  expect(miscounted(pageSources)).toEqual([]);
});
