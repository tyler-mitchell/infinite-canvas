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

/**
 * What each component needs before anything can be seen: the props it reads, and for a container
 * the part it holds. A container is judged with its parts, since a toolbar with no buttons fades
 * nothing and a field with no label has nothing to grey.
 */
const REQUIRED: Record<string, Record<string, unknown>> = {
  Accordion: {
    children: createElement(
      kit.AccordionItem,
      null,
      createElement(kit.AccordionTrigger, null, "open"),
    ),
  },
  ActivityFeed: { entries: [] },
  ActivityGrid: { days: [] },
  Avatar: { name: "Ada Lovelace" },
  Bars: { values: [1, 2, 3] },
  Binding: { keys: ["a"], action: "do the thing" },
  Breakdown: { parts: [{ name: "p", share: 1, color: "red" }] },
  Collapsible: { children: createElement(kit.CollapsibleTrigger, null, "open") },
  Dialog: { children: createElement(kit.DialogTrigger, null, "open") },
  Field: { children: createElement(kit.FieldLabel, null, "name") },
  LayoutPreview: { panes: [] },
  Menu: { children: createElement(kit.MenuTrigger, null, "open") },
  NumberField: { children: createElement(kit.NumberFieldGroup) },
  Popover: { children: createElement(kit.PopoverTrigger, null, "open") },
  RadioGroup: { children: createElement(kit.Radio, { value: "a" }) },
  ReceiptBarcode: { value: "order 42" },
  Sparkline: { values: [1, 2, 3] },
  SwipeDeck: { items: [] },
  ToggleGroup: { children: createElement(kit.Toggle, { value: "a" }, "one") },
  Tooltip: { children: createElement(kit.TooltipTrigger, null, "open") },
  /* The bare part, not one propped up with `render`: a toolbar button has to dress itself. */
  Toolbar: { children: createElement(kit.ToolbarButton, null, "cut") },
};

/** `surfaceVariants` describes `Surface`, so the pair is derived rather than listed by hand. */
const ownerOf = (name: string) => {
  const component = name.slice(0, -"Variants".length);

  return component.charAt(0).toUpperCase() + component.slice(1);
};

const variantNames = Object.keys(kit).filter((name) => name.endsWith("Variants"));

const pairs: readonly Pair[] = variantNames.flatMap((name) => {
  const owner = ownerOf(name);
  const drawn = (kit as Record<string, unknown>)[owner];

  return typeof drawn === "function"
    ? [{ owner, draw: drawn, config: (kit as Record<string, unknown>)[name] as VariantObject }]
    : [];
});

/**
 * A variants object whose name does not resolve to a component is dropped from the sweep, and a
 * dropped one looks exactly like one that passed. Only the text roles are in that position: they
 * are exported as `Display`, `Kind`, `Label` and four more rather than as a `Text`, and each sets
 * its own `as` internally, so handing that variant to one of them would do nothing and prove less.
 *
 * Named here so the skip is stated. A component whose export name stops matching its variants
 * object joins this list on purpose or is fixed, rather than leaving the sweep quietly.
 */
const DRAWN_THROUGH_SEVERAL = ["textVariants"];

test("nothing leaves the sweep without being named", () => {
  const unpaired = variantNames.filter(
    (name) => typeof (kit as Record<string, unknown>)[ownerOf(name)] !== "function",
  );

  expect(unpaired).toEqual(DRAWN_THROUGH_SEVERAL);
  expect(pairs.length).toBe(variantNames.length - DRAWN_THROUGH_SEVERAL.length);
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
 * Base UI writes `data-disabled` on the parts it owns the moment a consumer passes `disabled`, and
 * a component that styles nothing for it draws a control that is off and looks live. Eleven of the
 * kit's controls fade to 40% and stop taking a pointer; this asks which ones accept the prop and
 * answer it with nothing.
 *
 * Only what renders on its own is asked: a part that needs its parent's context throws instead,
 * and a throw here is a component this cannot speak about rather than a failure.
 */
const sourceOf = new Map<string, string>();

for (const file of readdirSync(new URL("./components/", import.meta.url)).filter((name) =>
  name.endsWith(".tsx"),
)) {
  const source = readFileSync(new URL(`./components/${file}`, import.meta.url), "utf8");

  for (const [, list] of source.matchAll(/^export \{([\s\S]*?)\};$/gm)) {
    for (const part of list!.split(",")) {
      const [name] = part.trim().split(/\s+as\s+/);
      if (name && /^[A-Z]/.test(name)) sourceOf.set(name, source);
    }
  }
}

const unmarkedDisabled = (components: readonly { name: string; draw: unknown }[]) =>
  components
    .flatMap(({ name, draw }) => {
      try {
        const markup = renderToStaticMarkup(
          createElement(draw as never, { ...REQUIRED[name], disabled: true }),
        );

        /*
         * The rendered classes rather than the file's own: a number field's steps take the fade
         * from the button they are laid over, and asking the file would call that nothing.
         */
        if (!markup.includes("data-disabled=")) return [];

        return markup.includes("data-disabled:")
          ? []
          : [`${name} takes disabled and draws nothing`];
      } catch {
        return [];
      }
    })
    .sort();

test("a control that can be disabled and draws nothing for it is reported", () => {
  const quiet = { name: "Quiet", draw: () => <span data-disabled="" className="flex" /> };
  const marked = {
    name: "Marked",
    draw: () => <span data-disabled="" className="data-disabled:opacity-40" />,
  };
  const lively = { name: "Lively", draw: () => <span className="flex" /> };

  expect(unmarkedDisabled([quiet])).toEqual(["Quiet takes disabled and draws nothing"]);
  expect(unmarkedDisabled([marked])).toEqual([]);
  expect(unmarkedDisabled([lively])).toEqual([]);
});

test("every control that can be disabled says so", () => {
  const components = [...sourceOf.keys()]
    .filter((name) => typeof (kit as Record<string, unknown>)[name] === "function")
    .map((name) => ({ name, draw: (kit as Record<string, unknown>)[name] }));

  /* Read first: the switch answers `disabled`, so the sweep is reaching real controls. */
  expect(components.length).toBeGreaterThan(40);
  expect(unmarkedDisabled([{ name: "Switch", draw: kit.Switch }])).toEqual([]);
  expect(unmarkedDisabled(components)).toEqual([]);
});

/**
 * The toolbar button passed everything through and drew nothing, and every page hid that by
 * handing it a whole button through `render`. Reading its own file would have called that correct,
 * because the file had nothing in it to be wrong.
 *
 * So this reads what a component renders. A part the keyboard can reach has to draw something when
 * it gets there: a ring for real focus, or the highlight a menu moves instead of focus.
 *
 * Base UI puts a hidden input in a select and a combobox so a form can read the value. It is
 * `aria-hidden`, which is the whole reason nobody lands on it, and that is what excludes it here.
 */
const KEYBOARD_STATE = /focus-visible:|focus-within:|data-highlighted:/;

const reachable = (markup: string) =>
  [...markup.matchAll(/<([a-z]+)((?:\s[^>]*)?)>/g)]
    .filter(
      ([, tag, attributes]) =>
        /^(?:button|input|textarea|select)$/.test(tag!) ||
        (tag === "a" && /\shref=/.test(attributes!)) ||
        /\stabindex=/.test(attributes!),
    )
    .filter(([, , attributes]) => !/\saria-hidden="true"/.test(attributes!))
    .map(([, tag]) => tag!);

const unlitFocus = (components: readonly { name: string; draw: unknown }[]) =>
  components
    .flatMap(({ name, draw }) => {
      try {
        const markup = renderToStaticMarkup(createElement(draw as never, REQUIRED[name]));
        const [reached] = reachable(markup);

        if (reached === undefined || KEYBOARD_STATE.test(markup)) return [];

        return [`${name} can be reached at its ${reached} and draws nothing`];
      } catch {
        return [];
      }
    })
    .sort();

test("a component that can be reached by keyboard and draws nothing is reported", () => {
  const bare = { name: "Bare", draw: () => <button className="flex" /> };
  const ringed = { name: "Ringed", draw: () => <button className="focus-visible:ring-2" /> };
  const roving = {
    name: "Roving",
    draw: () => <span tabIndex={-1} className="data-highlighted:bg-white" />,
  };
  const still = { name: "Still", draw: () => <span className="flex" /> };
  const filed = {
    name: "Filed",
    draw: () => <input aria-hidden="true" tabIndex={-1} readOnly value="" />,
  };

  expect(unlitFocus([bare])).toEqual(["Bare can be reached at its button and draws nothing"]);
  expect(unlitFocus([ringed])).toEqual([]);
  expect(unlitFocus([roving])).toEqual([]);
  expect(unlitFocus([still])).toEqual([]);
  expect(unlitFocus([filed])).toEqual([]);
});

test("every part the keyboard can reach draws something for it", () => {
  const components = [...sourceOf.keys()]
    .filter((name) => typeof (kit as Record<string, unknown>)[name] === "function")
    .map((name) => ({ name, draw: (kit as Record<string, unknown>)[name] }));

  /* Read first: the button answers, so the sweep is reaching parts that really take focus. */
  expect(components.length).toBeGreaterThan(40);
  expect(reachable(renderToStaticMarkup(<kit.Button>press</kit.Button>))).toEqual(["button"]);
  expect(unlitFocus(components)).toEqual([]);
});

/**
 * A pointer target under 24px square is allowed only while nothing else sits within 24px of its
 * centre. The radio is 18px and stacks, so its group's own gap is the whole of what keeps it
 * conformant, and tightening that gap would take it under without changing how anything looks.
 *
 * Counted in the page at 375px before this was written: 28px between radio centres, 56px between
 * anything else. The checkbox and the switch are 18px too, but a page places those, so their room
 * is not the kit's to promise.
 */
const STEP = 4;

const stepsIn = (classes: string, prefix: string) =>
  Number(new RegExp(String.raw`\b${prefix}-(\d+(?:\.\d+)?)\b`).exec(classes)?.[1] ?? Number.NaN);

test("a spacing class is read as the pixels it stands for", () => {
  expect(stepsIn("inline-flex size-4.5 flex-none", "size") * STEP).toBe(18);
  expect(stepsIn("flex flex-col gap-2.5", "gap") * STEP).toBe(10);
  expect(stepsIn("flex flex-row gap-4", "gap") * STEP).toBe(16);
  /* A group that declares no gap reads as no number, which fails the rule rather than passing it. */
  expect(stepsIn("flex flex-col", "gap")).toBeNaN();
});

test("a radio small enough to need room gets it from its own group", () => {
  const box = stepsIn(kit.radioVariants().root(), "size") * STEP;
  const reach = (["stacked", "inline"] as const).map(
    (layout) => box + stepsIn(kit.radioVariants({ layout }).group(), "gap") * STEP,
  );

  /* The rule only means anything while the control is under the minimum. */
  expect(box).toBeLessThan(24);
  for (const centres of reach) expect(centres).toBeGreaterThanOrEqual(24);
});

/**
 * The tile opens its label on hover and on keyboard focus, and a phone has neither, so `open` is
 * the only way a sighted reader there gets the name. The README says to reach for it, which is a
 * claim about this variant rather than about the component — and `open: false` is an empty object,
 * so the whole of it lives in the one branch.
 */
test("holding a tile open is not the same as leaving it shut", () => {
  const shut = kit.iconTileVariants({ open: false }).label();
  const held = kit.iconTileVariants({ open: true }).label();

  expect(held).not.toBe(shut);
  expect(shut).toContain("grid-cols-[minmax(0,0fr)]");
  expect(held).toContain("grid-cols-[minmax(0,1fr)]");
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

/**
 * Named for what the two looks actually do rather than for one of them. This asked that a pressed
 * item carries a fill and that the two strings differ, under a name saying the unpressed one wears
 * no fill — true of the segmented look, false of the chips, which wears a six percent ink at rest.
 * Nothing asserted the half that was wrong.
 */
const fillsOf = (classes: string) => classes.split(/\s+/).filter((one) => one.startsWith("bg-"));

test("pressing a toggle changes the fill it wears", () => {
  for (const look of ["segmented", "chips"] as const) {
    const on = kit.toggleGroupVariants({ look, pressed: true }).item();
    const off = kit.toggleGroupVariants({ look, pressed: false }).item();

    expect(fillsOf(on)).toHaveLength(1);
    expect(fillsOf(on)).not.toEqual(fillsOf(off));
  }

  /* The two looks differ in how: one fills an empty seat, the other replaces a fill. */
  expect(fillsOf(kit.toggleGroupVariants({ look: "segmented", pressed: false }).item())).toEqual(
    [],
  );
  expect(fillsOf(kit.toggleGroupVariants({ look: "chips", pressed: false }).item())).toHaveLength(
    1,
  );
});

test("the item still resolves when only the pressed state is given", () => {
  const bare = kit.toggleGroupVariants({ pressed: true }).item();
  const named = kit.toggleGroupVariants({ look: "segmented", pressed: true }).item();

  expect(bare).toBe(named);
});

/**
 * The nav look says it mirrors its hover treatment onto focus, so a keyboard reaches the same row
 * a pointer does. Every slot has to hold that, not most of them: the lead's two-pixel nudge was
 * hover-only, so a keyboard user got the row, the label and its brightening and not the mark.
 */
test("every hover the nav look draws has a focus that matches it", () => {
  const nav = kit.listItemVariants({ look: "nav" });
  const slots = { root: nav.root(), label: nav.label(), lead: nav.lead(), trail: nav.trail() };

  const unmirrored = Object.entries(slots).flatMap(([slot, classes]) =>
    [...classes.matchAll(/(?:group-)?hover(?:\/item)?:(\S+)/g)]
      .map(([, effect]) => effect!)
      .filter((effect) => !classes.includes(`focus-visible/item:${effect}`))
      .filter((effect) => !classes.includes(`focus-visible:${effect}`))
      .map((effect) => `${slot} hovers to ${effect} and never focuses to it`),
  );

  expect(Object.values(slots).join(" ")).toContain("hover");
  expect(unmirrored).toEqual([]);
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
