import { readdirSync, readFileSync } from "node:fs";
import { createCanvasState } from "@hyphened/infinite-canvas/next";
import { CanvasScroll, CanvasViewport } from "@hyphened/infinite-canvas/next/react";
import { createElement, type ReactElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { expect, test } from "vite-plus/test";

import * as kit from "./index.ts";
import { FONT_SIZES } from "./tv.ts";

const canvas = createCanvasState({ windowDefinitions: { note: {} } });

const WITHIN: Record<string, (element: ReactElement) => ReactElement> = {
  CanvasSectionRail: (element) =>
    createElement(CanvasScroll, {
      canvas,
      children: createElement(CanvasViewport, {
        canvas,
        renderWindow: () => null,
        children: element,
      }),
    }),
};

const drawnWithin = (name: string, element: ReactElement) =>
  renderToStaticMarkup(WITHIN[name]?.(element) ?? element);

interface VariantObject {
  readonly variants?: Record<string, Record<string, unknown>>;
  readonly compoundVariants?: readonly Record<string, unknown>[];
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
  Command: {
    children: createElement(kit.CommandList, null, createElement(kit.CommandItem, null, "open")),
  },
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

/**
 * A variant whose two values are `true` and `false` names a state rather than a taste, and a state
 * a component draws only in colour reaches nobody who cannot see the colour. The terminal's running
 * command was exactly this: an accent on two slots, no word, no attribute.
 */
const COLOUR = /^(?:text|bg|border|ring|outline|fill|stroke|shadow|decoration|from|via|to)-/;

const SIZED = new RegExp(`^text-(?:\\[length:|\\(length:|(?:${FONT_SIZES.join("|")})$)`);

const paints = (one: string) => {
  const bare = one.replace(/^[\w-]+:/, "");

  return COLOUR.test(bare) && !SIZED.test(bare);
};

test("a size is not read as a colour", () => {
  expect(paints("text-pk-ink-soft")).toBe(true);
  expect(paints("hover:text-pk-ink-bright")).toBe(true);
  expect(paints("text-pk-title")).toBe(false);
  expect(paints("text-[length:clamp(var(--text-pk-title),6cqi,var(--text-pk-display))]")).toBe(
    false,
  );
});

/**
 * Classes that differ across the values of one variant, over every slot it dresses. A compound
 * counts as the variant it names: the toggle keeps all of its pressed styling in one, and reading
 * the plain table alone found two empty strings and called the state undressed.
 */
const changedBy = (config: VariantObject, key: string) => {
  const drawn = Object.keys(config.variants?.[key] ?? {}).map((option) => {
    const values = config.variants![key]![option];
    const plain = typeof values === "string" ? { "": values } : (values as Record<string, string>);

    return (config.compoundVariants ?? [])
      .filter((compound) => String(compound[key]) === option)
      .reduce<Record<string, string>>((carried, compound) => {
        const added =
          typeof compound.class === "string"
            ? { "": compound.class }
            : ((compound.class ?? {}) as Record<string, string>);

        return Object.entries(added).reduce(
          (each, [slot, one]) => ({ ...each, [slot]: `${each[slot] ?? ""} ${one}`.trim() }),
          carried,
        );
      }, plain);
  });
  const slots = new Set(drawn.flatMap((one) => Object.keys(one)));

  return [...slots].flatMap((slot) => {
    const sets = drawn.map((one) => new Set((one[slot] ?? "").split(/\s+/).filter(Boolean)));

    return [...new Set(sets.flatMap((one) => [...one]))].filter(
      (one) => !sets.every((set) => set.has(one)),
    );
  });
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
          drawnWithin(owner, createElement(draw as never, { ...REQUIRED[owner], [key]: given }));
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

/** Holds the line, whatever the text does. `truncate` carries a `whitespace-nowrap` of its own. */
const REFUSES_TO_WRAP = /\b(?:whitespace-nowrap|whitespace-pre|truncate)\b/;

/**
 * Asks for a wrap, in one of the four properties that can. None of them is in the same Tailwind
 * group as `white-space`, so `tw-merge` keeps both and the browser quietly drops the loser.
 */
const ASKS_TO_WRAP =
  /\b(?:wrap-anywhere|wrap-break-word|break-words|break-all|whitespace-normal|text-pretty|text-balance|line-clamp-\d+)\b/;

/**
 * Every class list the kit can actually emit, rather than the strings it was written from. A `tv`
 * call composes a base, a variant and any compound into one list, so a contradiction can live in
 * the composition while each string on its own reads correctly — which is what happened: the text
 * base asked every role to wrap anywhere, and the readout role says it stays on one line.
 *
 * Six rules read slot strings one at a time and not one of them could have seen it. It was found
 * by reading the computed style of a live element, and the element wrapping was the loser.
 */
const emitted = (name: string, styles: unknown): readonly string[] => {
  if (typeof styles === "string") return [`${name}: ${styles}`];
  if (typeof styles === "function") return emitted(name, (styles as () => unknown)());
  if (styles && typeof styles === "object")
    return Object.entries(styles).flatMap(([slot, value]) => emitted(`${name}.${slot}`, value));

  return [];
};

const everyClassList = (): readonly string[] =>
  variantNames.flatMap((name) => {
    const variants = ((kit as Record<string, unknown>)[name] as VariantObject).variants ?? {};
    const make = (kit as Record<string, unknown>)[name] as (values?: unknown) => unknown;

    return [
      ...emitted(name, make()),
      ...Object.entries(variants).flatMap(([variant, values]) =>
        Object.keys(values).flatMap((value) =>
          emitted(`${name}(${variant}=${value})`, make({ [variant]: value })),
        ),
      ),
    ];
  });

const bothWays = (lists: readonly string[]) =>
  lists.filter((list) => REFUSES_TO_WRAP.test(list) && ASKS_TO_WRAP.test(list)).sort();

test("a class list that both holds the line and asks to wrap is reported", () => {
  expect(bothWays(["a: whitespace-nowrap wrap-anywhere"])).toEqual([
    "a: whitespace-nowrap wrap-anywhere",
  ]);
  expect(
    bothWays(["b: whitespace-nowrap", "c: wrap-anywhere", "d: truncate text-pk-note"]),
  ).toEqual([]);
});

test("nothing the kit emits asks to wrap and refuses to at the same time", () => {
  const lists = everyClassList();

  expect(lists.length).toBeGreaterThan(200);
  expect(lists.filter((list) => REFUSES_TO_WRAP.test(list)).length).toBeGreaterThan(10);
  expect(bothWays(lists)).toEqual([]);
});

/**
 * A rim draws its border as 2px of transparent with a conic gradient showing through, and the sheet
 * spins that gradient on hover. A border is painted over its own background, so any colour on that
 * border hides the gradient — which is what an `interactive` Surface did to it, the one tone with an
 * animated edge being the one that lost its edge the moment a pointer arrived.
 *
 * The hairline hover now belongs to the three tones that draw a hairline, and this holds it there.
 */
const coversItsOwnEdge = (lists: readonly string[]) =>
  lists.filter(
    (list) => /\bpk-rim(?:-tile)?\b/.test(list) && /hover:border-(?!transparent)/.test(list),
  );

test("a gradient edge painted over by a hover colour is reported", () => {
  expect(coversItsOwnEdge(["a: pk-rim hover:border-pk-line-hover"])).toHaveLength(1);
  expect(
    coversItsOwnEdge(["b: pk-rim transition-colors", "c: hover:border-pk-line-hover"]),
  ).toEqual([]);
});

test("no tone with a gradient edge takes a colour that would cover it", () => {
  const lists = everyClassList();
  const rims = lists.filter((list) => /\bpk-rim(?:-tile)?\b/.test(list));

  /* Read first: both rim tones reach the sweep, so an empty result is not an empty search. */
  expect(rims.length).toBeGreaterThan(1);
  expect(coversItsOwnEdge(lists)).toEqual([]);
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
        const markup = drawnWithin(
          name,
          createElement(draw as never, { ...REQUIRED[name], disabled: true }),
        );

        /*
         * The rendered classes rather than the file's own: a number field's steps take the fade
         * from the button they are laid over, and asking the file would call that nothing.
         */
        if (!markup.includes("data-disabled=")) return [];

        return /data-disabled:|data-\[disabled=true\]:/.test(markup)
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
  const valued = {
    name: "Valued",
    draw: () => <span data-disabled="false" className="data-[disabled=true]:opacity-50" />,
  };
  const lively = { name: "Lively", draw: () => <span className="flex" /> };

  expect(unmarkedDisabled([quiet])).toEqual(["Quiet takes disabled and draws nothing"]);
  expect(unmarkedDisabled([marked])).toEqual([]);
  expect(unmarkedDisabled([valued])).toEqual([]);
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
const KEYBOARD_STATE = /focus-visible:|focus-within:|data-highlighted:|data-\[selected=true\]:/;

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
        const markup = drawnWithin(name, createElement(draw as never, REQUIRED[name]));
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
  const listed = {
    name: "Listed",
    draw: () => <span tabIndex={-1} className="data-[selected=true]:bg-white" />,
  };
  const still = { name: "Still", draw: () => <span className="flex" /> };
  const filed = {
    name: "Filed",
    draw: () => <input aria-hidden="true" tabIndex={-1} readOnly value="" />,
  };

  expect(unlitFocus([bare])).toEqual(["Bare can be reached at its button and draws nothing"]);
  expect(unlitFocus([ringed])).toEqual([]);
  expect(unlitFocus([roving])).toEqual([]);
  expect(unlitFocus([listed])).toEqual([]);
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
 * The rule above asks whether a part draws anything for the keyboard, not whether the mark can be
 * seen. A ring is drawn outside the border box, so a part filling a parent that clips has nothing
 * to draw it on, and the keyboard gets no mark at all.
 *
 * Swept across nine pages against the padding box each clipping parent actually clips at: the
 * viewport is the only focusable part in the kit with no room for an outside ring. Every other one
 * sits in a card, whose 20px of padding is five times what a ring needs. So this is pinned where
 * it is true rather than asked of everything.
 */
test("the one part that fills a parent which clips marks its focus inside its own box", () => {
  const styles = kit.scrollAreaVariants();

  expect(styles.root()).toContain("overflow-hidden");
  expect(styles.viewport()).toContain("size-full");
  expect(styles.viewport()).toContain("focus-visible:inset-ring-2");
  /* An outside ring here would be drawn on nothing, so it cannot be how the mark is made. */
  expect(styles.viewport()).not.toMatch(/focus-visible:ring-\d/);
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
/**
 * A surface that floats is the one thing on a page that can be bigger than the page. The popover
 * and the tooltip clamp their width to `min(92vw, …)`; the menu stated a minimum and no maximum,
 * and its items do not wrap.
 *
 * Measured at 375px: one long item took the menu to 646px and the page scrolled 311px sideways.
 * Base UI publishes `--available-width` for exactly this, so the menu now reads it — 354px, and
 * the page's own overflow is what the library's positioner adds, not the kit's popup.
 *
 * The select and the combobox draw over the menu's popup, so all three are clamped by the one
 * class.
 */
const CLAMPED = /\b(?:max-)?w-(?:\[min\(\d+vw|\(--available-width\))/;

const CAPPED = /\bmax-h-(?:\[min\(\d+vh|\[\d+vh\]|\(--available-height\))/;

/**
 * Height is the same question and had the same answer. At 375 by 500 the menu reached 506 against
 * 489 of room and clipped what it could not fit, the popover reached 545 and painted off the
 * screen, and the dialog reached 752 in a 500 tall window with its top at minus 126 — so its title
 * and both of its actions were out of reach with no way to scroll to them.
 *
 * Base UI flips a popup to the roomier side before it publishes the number, and it still does with
 * the cap in place: with nothing below the trigger and 252 above, the menu opened upward at its
 * full height rather than scrolling in the gap beneath.
 *
 * A tooltip is capped by nothing on purpose. It closes when the pointer leaves it, so a scrollbar
 * on one is a control nobody could reach.
 */
const UNCAPPED_ON_PURPOSE = ["tooltip"];

test("a floating surface that names no ceiling is reported", () => {
  expect(CLAMPED.test("z-50 w-[min(92vw,440px)] rounded")).toBe(true);
  expect(CLAMPED.test("z-50 max-w-[min(92vw,300px)] rounded")).toBe(true);
  expect(CLAMPED.test("z-50 max-w-(--available-width) min-w-[168px]")).toBe(true);
  expect(CLAMPED.test("z-50 min-w-[168px] rounded")).toBe(false);
  expect(CLAMPED.test("z-50 w-[440px] rounded")).toBe(false);

  expect(CAPPED.test("z-50 max-h-[92vh] overflow-y-auto")).toBe(true);
  expect(CAPPED.test("z-50 max-h-(--available-height) overflow-y-auto")).toBe(true);
  expect(CAPPED.test("z-50 max-h-[min(18rem,var(--available-height))]")).toBe(false);
  expect(CAPPED.test("z-50 max-h-[440px] overflow-y-auto")).toBe(false);
  expect(CAPPED.test("z-50 rounded")).toBe(false);
});

/**
 * The dialog answers this at a different part. It is the one surface Base UI gives a `Viewport`,
 * which is the window itself, so the popup is bounded by where it sits rather than by its own
 * classes — it says `w-full max-w-[440px]` and needs no ceiling of its own.
 */
test("the dialog's viewport is the window, so the dialog cannot outgrow it", () => {
  const viewport = kit.dialogVariants().viewport();

  expect(viewport).toContain("fixed");
  expect(viewport).toContain("inset-0");
  expect(viewport).toContain("overflow-y-auto");
});

/**
 * The dialog placed its own popup with `fixed` and two translates for months, which is what Base
 * UI's `Viewport` is for. Nothing here said so, because the result looked right.
 *
 * Every one of these has a library part that decides where it goes — a `Positioner` for the five
 * that hang off a trigger, a `Viewport` for the one that centres. A popup that places itself is
 * either fighting that part or standing in for one that was never mounted.
 *
 * Checked against the installed package rather than assumed: the parts these components do not
 * mount are extras — submenus, chips, scroll arrows, an arrow — and the semantics are right
 * without them. The select's popup carries the listbox role itself, and the combobox's empty
 * message is already a polite live region.
 */
/**
 * Three parts of the kit draw a line between things on a surface, and two of them agreed. The
 * toolbar painted `--pk-line`, which is the token a card or a tray takes for its own outer edge
 * against the page; the kit's separator and the menu's both take `--pk-line-inner`, which is the
 * one named for a line inside a surface. Nothing stated an intent for a toolbar to differ, so it
 * was drift rather than a decision, and it now matches the other two.
 *
 * The receipt's rule is not here. It is printed decoration with no role and a repeating gradient
 * of its own rather than a line token, which the paper rules in `contrast.test.ts` cover.
 */
test("every line the kit draws between things on a surface is the same line", () => {
  const dividers = {
    menu: kit.menuVariants().separator(),
    separator: kit.separatorVariants(),
    toolbar: kit.toolbarVariants().separator(),
  };

  expect(
    Object.entries(dividers)
      .filter(([, classes]) => !classes.includes("bg-pk-line-inner"))
      .map(([name, classes]) => `${name} draws ${/bg-pk-[a-z-]+/.exec(classes)?.[0] ?? "no line"}`),
  ).toEqual([]);
});

test("no popup places itself, because a library part decides where each one goes", () => {
  const popups = {
    combobox: kit.comboboxVariants().popup(),
    dialog: kit.dialogVariants().popup(),
    menu: kit.menuVariants().popup(),
    popover: kit.popoverVariants().popup(),
    select: kit.selectVariants().popup(),
    tooltip: kit.tooltipVariants().popup(),
  };

  expect(
    Object.entries(popups)
      .filter(([, classes]) => /\b(?:fixed|absolute)\b/.test(classes))
      .map(([name]) => `${name} places its own popup`),
  ).toEqual([]);
});

test("every surface that floats clamps to the room it has", () => {
  const floating = {
    menu: kit.menuVariants().popup(),
    popover: kit.popoverVariants().popup(),
    tooltip: kit.tooltipVariants().popup(),
  };

  const wide = Object.entries(floating)
    .filter(([, classes]) => !CLAMPED.test(classes))
    .map(([name]) => `${name} names no ceiling`);

  const tall = Object.entries(floating)
    .filter(([name]) => !UNCAPPED_ON_PURPOSE.includes(name))
    .filter(([, classes]) => !CAPPED.test(classes))
    .map(([name]) => `${name} can outgrow the window`);

  expect(wide).toEqual([]);
  expect(tall).toEqual([]);
  /* A capped surface with nowhere for the overflow to go is a surface that hides it. */
  expect(
    Object.entries(floating)
      .filter(([, classes]) => CAPPED.test(classes) && !classes.includes("overflow-y-auto"))
      .map(([name]) => `${name} caps its height and cannot be scrolled`),
  ).toEqual([]);
});

/**
 * A tray is a row of fixed-size controls, so its width is the sum of them and nothing in it gives.
 * Measured at 320: the six buttons came to 298 inside a 280 column, and the tray's right edge sat
 * 18px past it while clearing the window by two — which was luck, not layout.
 *
 * A second row is what gives, because the control size is an input and never a result, the same
 * trade the activity grid makes with its cells. At 320 the tray now ends exactly on its column at
 * two rows with every group whole, and at 1280 it is inert: 298 by 38 with the class or without.
 */
test("a tray takes a second row rather than spill the column it sits in", () => {
  const root = kit.toolbarVariants().root();

  expect(root).toContain("flex-wrap");
  /* Stacked, the tray runs down the other axis, and the row it wraps is the one it no longer has. */
  expect(root).toContain("data-[orientation=vertical]:flex-col");
  /* A group that wrapped as well would split the controls its separators are drawn to join. */
  expect(kit.toolbarVariants().group()).not.toContain("flex-wrap");
});

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

/**
 * The aurora stacks four decorative layers under its words, and every one of them takes no pointer
 * because none of them is content. The wrapper holding the words carried the same class, so the
 * headline could not be selected — hit-testing it in view landed on the card behind it.
 *
 * The card's hover is unaffected either way: it lives on the root, and hovering a child is
 * hovering its parent.
 */
test("the aurora's words take a pointer and its decoration does not", () => {
  const styles = kit.auroraVariants();

  for (const inert of [styles.blob(), styles.grain(), styles.vignette()]) {
    expect(inert).toContain("pointer-events-none");
  }
  expect(styles.content()).not.toContain("pointer-events-none");
  /* Read first: the wrapper is the one that holds them, so it is the one that has to be hittable. */
  expect(styles.content()).toContain("flex-col");
});

/**
 * A card is stacked absolutely, so it cannot grow and its body is the only part that gives. With
 * the text spacing a reader is entitled to ask for — line height 1.5, letter spacing 0.12em, word
 * spacing 0.16em — the head and the foot grew and squeezed the body from 91 to 34, and the last
 * line was cut off rather than reachable. Measured in the browser at 1280.
 *
 * Scrolling it keeps every word, and takes a vertical touch of its own so the card still takes a
 * sideways one. At ordinary spacing nothing changes: the body measures 91 against 91 and shows no
 * scrollbar at all.
 */
test("a card that cannot grow lets its body scroll rather than cut it", () => {
  const body = kit.swipeDeckVariants().prose();

  expect(body).toContain("overflow-y-auto");
  expect(body).not.toContain("overflow-hidden");
  /* The sideways drag is the card's, so the body claims only the axis the card does not use. */
  expect(body).toContain("touch-pan-y");
  expect(kit.swipeDeckVariants().card()).toContain("touch-pan-y");
});

/**
 * A default names one of the values its own variant declares. Half of that belongs to TypeScript:
 * a default of `inlinee` where the variant declares `inline` is refused at the build, so this does
 * not answer for it and says so rather than taking the credit.
 *
 * The other half is nobody's. A default under a key no variant declares typechecks, and the table
 * a page draws reads the keys of `variants` — so the default is dropped, silently, and a consumer
 * is left with one that does nothing. Both halves are reported here; only the second can fail.
 */
test("every default a variant declares is one of its own values", () => {
  const defaults = variantNames.flatMap((name) => {
    const config = (kit as Record<string, unknown>)[name] as VariantObject;

    return Object.entries(config.defaultVariants ?? {}).map(([key, value]) => ({
      name,
      key,
      value: String(value),
      options: Object.keys(config.variants?.[key] ?? {}),
    }));
  });

  /* Read first: a reader finding no default agrees with every table it is given. */
  expect(defaults.length).toBeGreaterThan(15);
  expect(
    defaults
      .filter(({ value, options }) => !options.includes(value))
      .map(({ name, key, value, options }) =>
        options.length === 0
          ? `${name}.${key} is a default for a variant that is not declared`
          : `${name}.${key} defaults to ${value}, and declares ${options.join(" ")}`,
      ),
  ).toEqual([]);
});

/**
 * A variant whose values are `true` and `false` is a state the component is in, not a taste its
 * consumer picked, and one drawn only in colour reaches nobody who cannot see the colour.
 *
 * The table is all this can read, so it finds candidates and not faults: a component may say the
 * state in its markup instead, which is where all five of these say it. Each is named with the
 * line that proves it, so the list means what it says rather than excusing what is on it. A sixth
 * state drawn in colour joins them and has to bring its own proof.
 *
 * The fifth arrived when compounds were folded in. The toggle keeps every scrap of its pressed
 * styling in one, so the plain table held two empty strings and the state read as undressed.
 */
const SAID_IN_THE_MARKUP = [
  "checkboxVariants.checked",
  "layoutPreviewVariants.active",
  "radioVariants.checked",
  "terminalVariants.running",
  "toggleGroupVariants.pressed",
];

test("a state drawn only in colour is said in the markup, and says where", () => {
  const booleans = variantNames.flatMap((name) => {
    const config = (kit as Record<string, unknown>)[name] as VariantObject;

    return Object.entries(config.variants ?? {})
      .filter(([, options]) => ["false", "true"].every((one) => one in options))
      .map(([key]) => ({ name, key, changed: changedBy(config, key) }));
  });

  /* Were the reader to find no boolean at all, the line below would pass by reaching nothing. */
  expect(booleans.length).toBeGreaterThan(5);
  expect(
    booleans
      .filter(({ changed }) => changed.length > 0 && changed.every(paints))
      .map(({ name, key }) => `${name}.${key}`)
      .sort(),
  ).toEqual(SAID_IN_THE_MARKUP);

  /* Base UI draws the tick and the dot only when checked, and marks the control either way. */
  expect(sourceOf.get("Checkbox")).toContain("CheckboxPrimitive.Indicator");
  expect(sourceOf.get("Radio")).toContain("RadioPrimitive.Indicator");
  /* The command says the word beside the accent. */
  expect(renderToStaticMarkup(<kit.TerminalCommand running>x</kit.TerminalCommand>)).toContain(
    ">running<",
  );
  /* A pane carries no words, and the frame is one image, so its label does the counting. */
  const active = [{ left: 0, top: 0, width: 50, height: 100, active: true }];

  expect(renderToStaticMarkup(<kit.LayoutPreview panes={active} />)).toContain("1 pane, 1 active");
  expect(renderToStaticMarkup(<kit.LayoutPreview panes={[]} />)).toContain('0 panes"');
  /* And a name does not cost the count, which is the only place the active pane is said. */
  expect(renderToStaticMarkup(<kit.LayoutPreview panes={active} label="split" />)).toContain(
    "split, 1 pane, 1 active",
  );
  /* Base UI writes the pressed state onto the button it owns, either way round. */
  const toggles = (value: string[]) =>
    renderToStaticMarkup(
      <kit.ToggleGroup defaultValue={value}>
        <kit.Toggle value="a">one</kit.Toggle>
      </kit.ToggleGroup>,
    );

  expect(toggles(["a"])).toContain('aria-pressed="true"');
  expect(toggles([])).toContain('aria-pressed="false"');
});
