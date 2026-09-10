import { readdirSync, readFileSync } from "node:fs";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { expect, test } from "vite-plus/test";

import * as kit from "./index.ts";

/**
 * The first test in this kit that draws anything. `react-dom` is already here, so server rendering
 * needs nothing installed: it cannot show hover, focus or layout, but it can show that a component
 * runs at all and that its markup carries what the component promises.
 */
const components = Object.entries(kit).filter(
  ([name, value]) =>
    /^[A-Z][a-z\d]/.test(name) && typeof value === "function" && !name.endsWith("Variants"),
);

/** What each component that reads a required prop needs before it can draw at all. */
const REQUIRED: Record<string, Record<string, unknown>> = {
  ActivityFeed: { entries: [] },
  ActivityGrid: { days: [] },
  Avatar: { name: "Ada Lovelace" },
  Bars: { values: [] },
  Binding: { keys: [], action: "do the thing" },
  Breakdown: { parts: [] },
  LayoutPreview: { panes: [] },
  ReceiptBarcode: { value: "order 42" },
  Sparkline: { values: [] },
  SwipeDeck: { items: [] },
};

/**
 * Base UI parts read their root through context and throw without it, which is the library working
 * rather than failing. They are covered as whole compositions further down instead.
 */
const NEEDS_ITS_ROOT = new Set([
  "AccordionItem",
  "AccordionPanel",
  "AccordionTrigger",
  "CollapsiblePanel",
  "CollapsibleTrigger",
  "ComboboxContent",
  "ComboboxEmpty",
  "ComboboxInput",
  "ComboboxItem",
  "ComboboxList",
  "DialogClose",
  "DialogContent",
  "DialogDescription",
  "DialogTitle",
  "DialogTrigger",
  "FieldLabel",
  "MenuContent",
  "MenuGroupLabel",
  "MenuItem",
  "MenuTrigger",
  "NumberFieldGroup",
  "NumberFieldScrub",
  "PopoverClose",
  "PopoverContent",
  "PopoverDescription",
  "PopoverTitle",
  "PopoverTrigger",
  "SelectContent",
  "SelectItem",
  "SelectTrigger",
  "Tab",
  "TabPanel",
  "TabsList",
  "ToolbarButton",
  "ToolbarGroup",
  "ToolbarSeparator",
  "TooltipContent",
  "TooltipTrigger",
]);

/*
 * Nothing is passed as children. The grid takes a render function there, so handing every
 * component the same string says more about the harness than about the kit.
 */
const draw = (name: string, value: unknown) =>
  renderToStaticMarkup(createElement(value as never, REQUIRED[name] ?? {}));

test("the kit exports a surface worth drawing", () => {
  expect(components.length).toBeGreaterThan(85);
  expect(components.filter(([name]) => NEEDS_ITS_ROOT.has(name)).length).toBeGreaterThan(25);
});

test("every component that owns itself draws without throwing", () => {
  const broke = components
    .filter(([name]) => !NEEDS_ITS_ROOT.has(name))
    .flatMap(([name, value]) => {
      try {
        draw(name, value);
        return [];
      } catch (error) {
        return [`${name}: ${(error as Error).message.split("\n")[0]!.slice(0, 60)}`];
      }
    });

  expect(broke).toEqual([]);
});

/**
 * The roots that carry context and no markup of their own. They draw nothing until something opens
 * them, so an empty string is right for these five and wrong for everything else.
 *
 * A select root is not one of them, though it reads like one: it always draws a hidden input that
 * carries its value into a form, so it has markup before anything opens.
 */
const DRAWS_ONLY_WHEN_OPEN = new Set(["Dialog", "Menu", "Popover", "Tooltip", "TooltipProvider"]);

test("a component draws markup unless it is a root that waits to be opened", () => {
  const drawn = components
    .filter(([name]) => !NEEDS_ITS_ROOT.has(name))
    .map(([name, value]) => ({ name, empty: draw(name, value).trim().length === 0 }));

  const silent = drawn.filter(({ empty }) => empty).map(({ name }) => name);

  expect(silent.sort()).toEqual([...DRAWS_ONLY_WHEN_OPEN].sort());
});

/*
 * This list is the only one used to skip work rather than to assert an outcome: a name in it is
 * left out of the sweep above. So a name that no longer exists would quietly excuse a component
 * from being drawn at all, and `PopoverPopup` sat here doing that until it was looked for. A name
 * that is not an exported function now fails rather than being passed over.
 */
test("every part the list excuses exists and does need its root", () => {
  const missing = [...NEEDS_ITS_ROOT].filter(
    (name) => typeof (kit as Record<string, unknown>)[name] !== "function",
  );

  const quiet = [...NEEDS_ITS_ROOT]
    .map((name) => ({ name, value: (kit as Record<string, unknown>)[name] }))
    .filter(({ value }) => typeof value === "function")
    .filter(({ value }) => {
      try {
        renderToStaticMarkup(createElement(value as never, {}, "x"));
        return true;
      } catch {
        return false;
      }
    })
    .map(({ name }) => name);

  expect(missing).toEqual([]);
  expect(quiet).toEqual([]);
});

test("the feed draws the list it claims, one item per entry", () => {
  const html = renderToStaticMarkup(
    <kit.ActivityFeed
      entries={[
        { id: "a", name: "one", note: "first" },
        { id: "b", name: "two", note: "second" },
      ]}
    />,
  );

  expect(html).toContain("<ul");
  expect((html.match(/<li/g) ?? []).length).toBe(2);
});

test("the deck seals the cards under the top one and names the queue", () => {
  const html = renderToStaticMarkup(
    <kit.SwipeDeck
      label="inbox"
      items={[
        { id: "a", kind: "gist", title: "one", body: "first", left: "l", right: "r" },
        { id: "b", kind: "issue", title: "two", body: "second", left: "l", right: "r" },
      ]}
    />,
  );

  expect(html).toContain('role="group"');
  expect(html).toContain('aria-label="inbox"');

  /* Two cards drawn, and every one but the top sealed off from a reader. */
  const cards = html.match(/<div[^>]*data-slot="swipe-card"[^>]*>/g) ?? [];

  expect(cards.length).toBe(2);
  expect(cards.filter((tag) => tag.includes('aria-hidden="true"')).length).toBe(1);
});

test("the grid names itself and says which keys walk it", () => {
  const html = renderToStaticMarkup(<kit.ActivityGrid days={[]} label="contributions" />);

  expect(html).toContain('aria-label="contributions"');
  /* The keys themselves, not the attribute: naming an empty list would pass either way. */
  expect(html).toContain('aria-keyshortcuts="ArrowLeft ArrowRight ArrowUp ArrowDown"');
});

/**
 * `initials` says it defaults to the first letter of each of the first two words in `name`. Words
 * are what it says, so the spacing between them should not decide the answer.
 */
test("the initials are the first letters of the first two words, however they are spaced", () => {
  const mark = (name: string) => {
    const html = renderToStaticMarkup(<kit.Avatar name={name} />);

    return /<span[^>]*>([A-Za-z]*)<\/span>/.exec(
      html.replace(/<span aria-hidden[^>]*><\/span>/, ""),
    )?.[1];
  };

  expect(mark("Ada Lovelace")).toBe("AL");
  expect(mark("Ada")).toBe("A");
  expect(mark("Ada  Lovelace")).toBe("AL");
  expect(mark(" Ada Lovelace")).toBe("AL");
  expect(mark("Ada\tLovelace")).toBe("AL");
});

/*
 * The rest of the prop docs that name an exact behaviour. Each assertion is written from the
 * sentence rather than from the code, because a test written from the code can only agree with it.
 */

/*
 * The tab indicator draws itself from `--active-tab-width` and `--active-tab-left`, which Base UI
 * sets only while a tab is active. With nothing chosen those are undefined on an element carrying
 * the accent, so this asks what reaches the markup before anything is selected.
 */
test("a tab list draws its tabs with or without a value", () => {
  const list = (props: { defaultValue?: string }) =>
    renderToStaticMarkup(
      <kit.Tabs {...props}>
        <kit.Tabs.List>
          <kit.Tabs.Tab value="a">a</kit.Tabs.Tab>
          <kit.Tabs.Tab value="b">b</kit.Tabs.Tab>
        </kit.Tabs.List>
      </kit.Tabs>,
    );

  expect(list({ defaultValue: "a" })).toContain('data-slot="tab"');
  expect(list({})).toContain('data-slot="tab"');
  /*
   * The indicator reaches the markup carrying the accent either way, which server rendering can
   * see and cannot judge. Measured in the browser instead: with the variables unset the width
   * declaration is invalid and falls back to auto, which computes to 0px on an absolutely
   * positioned element with no content. It carries the colour and paints none of it.
   */
  expect(list({})).toContain("bg-pk-accent");
});

/*
 * `axis` is the one claim here that server rendering cannot settle. Base UI draws a scrollbar only
 * once it has measured overflow, so none of them reach the server markup whatever `axis` says. It
 * was checked in the browser instead, where the default area carries a vertical bar and the `both`
 * area carries one of each.
 */

/** `children`: "The state in words. Omit for the mark alone, and name the state some other way." */
test("a status dot with no words draws the mark and nothing else", () => {
  const alone = renderToStaticMarkup(<kit.StatusDot />);
  const spoken = renderToStaticMarkup(<kit.StatusDot>open to one project</kit.StatusDot>);

  expect(alone.replace(/<[^>]*>/g, "").trim()).toBe("");
  expect(spoken).toContain("open to one project");
});

/** `stamp`: "The stamp on the right. Defaults to the design's own word." */
test("a pending card stamps itself when the consumer names no word", () => {
  const fallback = renderToStaticMarkup(<kit.PendingCard title="a" body="b" />);
  const named = renderToStaticMarkup(<kit.PendingCard title="a" body="b" stamp="later" />);

  expect(fallback.replace(/<[^>]*>/g, "")).toMatch(/[a-z]/i);
  expect(named).toContain("later");
});

/** `showLegend`: "Hides the legend, for a bar under a heading that already names the parts." */
test("a breakdown legend is drawn unless it is turned off", () => {
  const parts = [{ name: "rust", share: 1, color: "red" }];
  const shown = renderToStaticMarkup(<kit.Breakdown parts={parts} />);
  const hidden = renderToStaticMarkup(<kit.Breakdown parts={parts} showLegend={false} />);

  expect(shown).toContain("rust");
  expect(hidden.replace(/<[^>]*>/g, "")).not.toContain("rust");
});

/** `children`: "receives the focused day, or `undefined` when nothing is." */
test("a grid hands its render function undefined while no day is focused", () => {
  const seen: unknown[] = [];
  renderToStaticMarkup(
    <kit.ActivityGrid days={[{ date: new Date("2026-09-10T00:00:00Z"), count: 1 }]}>
      {(day) => {
        seen.push(day);
        return null;
      }}
    </kit.ActivityGrid>,
  );

  expect(seen).toEqual([undefined]);
});

/**
 * `showValue` defaults to true, so dropping the drawn label alone leaves a header carrying the
 * value. Both halves have to go for the track to be bare.
 */
test("a track is bare only when neither the label nor the value is asked for", () => {
  const noLabel = renderToStaticMarkup(<kit.Slider aria-label="opacity" defaultValue={40} />);
  const bare = renderToStaticMarkup(<kit.Slider aria-label="opacity" showValue={false} />);
  const labelled = renderToStaticMarkup(<kit.Slider label="zoom" defaultValue={40} />);

  expect(noLabel).toContain("40");
  expect(bare).not.toMatch(/>\d+</);
  expect(labelled).toContain("zoom");
});

/**
 * A bare track drew nothing that named it, and the page beside it read "bare track" in a span the
 * control could not see, so it was announced as a slider on 62 and nothing else. Base UI wants the
 * name on each thumb, and a range has two.
 */
test("a track says what it controls whether or not the label is drawn", () => {
  /* The name is asked for on the thumb and lands on the input that thumb owns. */
  const inputs = (html: string) => html.match(/<input[^>]*type="range"[^>]*>/g) ?? [];

  const bare = renderToStaticMarkup(<kit.Slider aria-label="opacity" showValue={false} />);
  const range = renderToStaticMarkup(<kit.Slider aria-label="window" defaultValue={[24, 68]} />);
  const labelled = renderToStaticMarkup(<kit.Slider label="zoom" defaultValue={40} />);

  expect(inputs(bare)).toHaveLength(1);
  expect(inputs(bare).every((tag) => tag.includes('aria-label="opacity"'))).toBe(true);

  /* The root is a group, and an unnamed group beside a named track is half the control. */
  expect(bare).toMatch(/<div[^>]*data-slot="slider"[^>]*aria-label="opacity"/);

  /* A range has two, and a name on one of them is a slider half announced. */
  expect(inputs(range)).toHaveLength(2);
  expect(inputs(range).every((tag) => tag.includes('aria-label="window"'))).toBe(true);

  /*
   * A drawn label names it instead, so nothing puts an `aria-label` there to be outranked. The
   * link itself is not visible here: Base UI's label registers its id after mount, so the server
   * markup carries no `aria-labelledby` and only a browser can show that half. Driven there — all
   * six tracks on the controls page report a name, five by label and the bare one by `aria-label`.
   */
  expect(inputs(labelled)).toHaveLength(1);
  expect(inputs(labelled).every((tag) => !tag.includes("aria-label="))).toBe(true);
});

test("the deck says which keys walk it, and only while a card is there", () => {
  const card = { id: "a", kind: "gist", title: "one", body: "b", left: "l", right: "r" };
  const holding = renderToStaticMarkup(<kit.SwipeDeck items={[card]} />);
  const drained = renderToStaticMarkup(<kit.SwipeDeck items={[]} />);

  expect(holding).toContain('aria-keyshortcuts="ArrowLeft ArrowRight"');
  expect(holding).toContain('tabindex="0"');
  /* Drained, it is not a tab stop and promises no keys, because neither would do anything. */
  expect(drained).not.toContain("aria-keyshortcuts");
  expect(drained).toContain('tabindex="-1"');
});

/*
 * A closed accordion panel renders nothing at all on the server, with or without
 * `hiddenUntilFound`, so neither the attribute nor the words can be asserted here. That claim was
 * driven in a browser instead: the closed panels carry `hidden="until-found"`, and dispatching
 * `beforematch` on one drops the attribute, sets `data-open` and flips its trigger to expanded.
 */

/**
 * An unselected tab panel is gone, which is why the table offers to keep it: a panel that has been
 * unmounted comes back scrolled to the top and holding nothing it held before. The pages do not ask
 * for this — their panels are one line each and would keep nothing worth keeping — so the claim is
 * checked here rather than decorated onto a demo that could not show it.
 */
test("an unselected panel is gone unless it is asked to stay", () => {
  const panels = (props: { readonly keepMounted?: boolean }) =>
    renderToStaticMarkup(
      <kit.Tabs defaultValue="one">
        <kit.Tabs.List>
          <kit.Tabs.Tab value="one">one</kit.Tabs.Tab>
          <kit.Tabs.Tab value="two">two</kit.Tabs.Tab>
        </kit.Tabs.List>
        <kit.Tabs.Panel value="one" {...props}>
          the selected one
        </kit.Tabs.Panel>
        <kit.Tabs.Panel value="two" {...props}>
          the other one
        </kit.Tabs.Panel>
      </kit.Tabs>,
    );

  expect(panels({})).toContain("the selected one");
  expect(panels({})).not.toContain("the other one");
  expect(panels({ keepMounted: true })).toContain("the other one");
});

/**
 * Padding holds the width of a number that falls a place, so the zeros are a width and not part of
 * the value. They were being read out: a padded nine and a half thousand announced as `09562`.
 */
test("a padded number is shown padded and read out plain", () => {
  const padded = renderToStaticMarkup(<kit.NumberTicker value={9562} pad={5} locale />);
  const plain = renderToStaticMarkup(<kit.NumberTicker value={9562} locale />);
  const spoken = (markup: string) => /class="sr-only">([^<]*)</.exec(markup)?.[1];

  const reels = (markup: string) => markup.split("overflow-hidden").length - 1;

  expect(spoken(padded)).toBe("9,562");
  expect(spoken(plain)).toBe("9,562");
  /* Five digits are drawn rather than four, which is the whole point of asking for padding. */
  expect(reels(padded)).toBe(5);
  expect(reels(plain)).toBe(4);
});

/**
 * A running command is drawn in the accent, and that was the whole of how it differed: the state
 * reached the markup as a colour and as nothing else. A reader who cannot see the colour hears the
 * same line whether it is still going or long finished.
 *
 * Said in words beside it, the way the ticker says its whole number beside the digits it rolls.
 */
test("a running command says so rather than only looking so", () => {
  const spoken = (markup: string) => /class="sr-only">([^<]*)</.exec(markup)?.[1];
  const command = (props: { running?: boolean }) =>
    renderToStaticMarkup(<kit.TerminalCommand {...props}>pnpm test</kit.TerminalCommand>);
  const [running, done] = [command({ running: true }), command({})];

  expect(spoken(running)).toBe("running");
  expect(spoken(done)).toBeUndefined();
  /* The colour is what a seeing reader has, so it has to still be the thing that changed. */
  expect(running).toContain("text-pk-accent");
  expect(done).not.toContain("text-pk-accent");
});

/**
 * A reading that is not a number reaches the DOM as geometry or as words. As words it is honest —
 * a ticker handed `NaN` prints `NaN`, which is what it was given. In an attribute it is neither:
 * the browser drops the declaration and the component silently loses whatever it described.
 *
 * So text is stripped and only attributes are read. The sparkline is here because it failed this:
 * one unusable reading made the span `NaN`, which is falsy, so `|| 1` hid it and every coordinate
 * in the path came back `NaN`.
 */
const DAYS = [
  { date: new Date(2026, 8, 1), count: Number.NaN },
  { date: new Date(2026, 8, 2), count: 3 },
];

/*
 * One case per fault, because a guard can hide the next one. Written as a single row, an unusable
 * `weeks` emptied the grid, and the total the summary sums had nothing left to be spoiled by — the
 * count fault passed its own mutation until these were split.
 */
const HOSTILE: readonly { readonly name: string; readonly props: Record<string, unknown> }[] = [
  { name: "ActivityGrid", props: { days: DAYS, weeks: 4 } },
  { name: "ActivityGrid", props: { days: DAYS, weeks: 4, cellSize: Number.NaN } },
  { name: "ActivityGrid", props: { days: DAYS, weeks: Number.NaN } },
  { name: "ActivityGrid", props: { days: DAYS, weeks: 4, thresholds: [Number.NaN, 2] } },
  { name: "Bars", props: { values: [1, Number.NaN, 3] } },
  { name: "Bars", props: { values: [1, 2], max: Number.NaN } },
  { name: "Bars", props: { values: [1, 2], minHeight: Number.NaN } },
  /*
   * The same readings again as endless rather than not a number. NaN fails every comparison, so a
   * guard written as `max > 0` turns it away without ever reaching the finite check beside it;
   * endless passes those comparisons and goes through. It leaves no NaN in the markup either, so
   * the sweep below could not have seen it: every bar drawn at the floor is a silent answer.
   */
  { name: "Bars", props: { values: [1, Number.POSITIVE_INFINITY, 3] } },
  { name: "Bars", props: { values: [1, 2], max: Number.POSITIVE_INFINITY } },
  { name: "Bars", props: { values: [1, 2], minHeight: Number.POSITIVE_INFINITY } },
  { name: "ActivityGrid", props: { days: DAYS, weeks: Number.POSITIVE_INFINITY } },
  { name: "ActivityGrid", props: { days: DAYS, weeks: 4, cellSize: Number.POSITIVE_INFINITY } },
  { name: "NumberTicker", props: { value: Number.POSITIVE_INFINITY } },
  { name: "NumberTicker", props: { value: 4182, duration: Number.POSITIVE_INFINITY } },
  { name: "NumberTicker", props: { value: 4182, stagger: Number.POSITIVE_INFINITY } },
  { name: "Sparkline", props: { values: [1, Number.POSITIVE_INFINITY, 3] } },
  {
    name: "Breakdown",
    props: {
      parts: [
        { name: "a", share: Number.NaN, color: "red" },
        { name: "b", share: 2, color: "blue" },
      ],
    },
  },
  /*
   * One row each. Written as one, the unusable value emptied the ticker of every rolling slot, so
   * the unusable roll time and step had nothing to write themselves into and the row passed.
   */
  { name: "NumberTicker", props: { value: Number.NaN } },
  { name: "NumberTicker", props: { value: 4182, pad: Number.NaN } },
  { name: "NumberTicker", props: { value: 4182, duration: Number.NaN } },
  { name: "NumberTicker", props: { value: 4182, stagger: Number.NaN } },
  { name: "Sparkline", props: { values: [1, Number.NaN, 3] } },
  /*
   * The emptiest series a consumer can pass, and the one the rows above never reach: each of them
   * spoils a reading inside a series that still has days in it. A series with nothing in it takes
   * every first and last away at once.
   */
  { name: "ActivityGrid", props: { days: [] } },
  { name: "Bars", props: { values: [] } },
  { name: "Sparkline", props: { values: [] } },
  { name: "Breakdown", props: { parts: [] } },
  /*
   * A pane is four lengths, each written from the recipe it is given. One row each, because a
   * guard on one says nothing about the other three.
   */
  {
    name: "LayoutPreview",
    props: { panes: [{ left: Number.NaN, top: 0, width: 50, height: 50 }] },
  },
  {
    name: "LayoutPreview",
    props: { panes: [{ left: 0, top: Number.NaN, width: 50, height: 50 }] },
  },
  {
    name: "LayoutPreview",
    props: { panes: [{ left: 0, top: 0, width: Number.POSITIVE_INFINITY, height: 50 }] },
  },
  { name: "LayoutPreview", props: { panes: [{ left: 0, top: 0, width: 50, height: Number.NaN }] } },
];

test("no component writes a reading it cannot use into an attribute", () => {
  const inAttributes = (markup: string) => markup.replace(/>[^<]*</g, "><");

  const leaking = HOSTILE.flatMap(({ name, props }) => {
    const drawn = kit[name as keyof typeof kit] as unknown;
    const markup = inAttributes(renderToStaticMarkup(createElement(drawn as never, props)));

    /* Rows for one component leak the same string, so each says which props drew it. */
    const row = `${name}(${Object.entries(props)
      .map(([key, value]) => `${key}=${Array.isArray(value) ? `[${value.length}]` : String(value)}`)
      .join(" ")})`;

    return [...markup.matchAll(/[\w-]+="[^"]*(?:NaN|Infinity|undefined)[^"]*"/g)].map(
      ([found]) => `${row}: ${found}`,
    );
  });

  /* Read first: the grid's own summary is in reach of these, which is where the count fault was. */
  expect(renderToStaticMarkup(createElement(kit.ActivityGrid, { days: DAYS, weeks: 4 }))).toContain(
    "2 days",
  );
  expect(leaking).toEqual([]);
});

/**
 * The rows above are written by hand, and the preview's four lengths were missing from them: it
 * took a consumer's number straight into a length, spoiled all four, and the sweep stayed green
 * because it had never been asked to draw one.
 *
 * Which values break a component cannot be worked out, so the rows stay written. Which components
 * take a number from a consumer can be, and that is the half that was wrong.
 */
test("every component that takes a number from a consumer is given an unusable one", () => {
  const takesNumbers = readdirSync(new URL("./components/", import.meta.url))
    .filter((name) => name.endsWith(".tsx"))
    .filter((name) =>
      /^\s*(?:readonly\s+)?\w+\??:\s*(?:readonly\s+)?number(?:\[\])?;/m.test(
        readFileSync(new URL(`./components/${name}`, import.meta.url), "utf8"),
      ),
    )
    .map((name) => name.replace(".tsx", ""));

  const spoiled = new Set(
    HOSTILE.map(({ name }) => name.replace(/[a-z\d](?=[A-Z])/g, "$&-").toLowerCase()),
  );

  /* Were the reader to match nothing, the line below would pass by covering nothing. */
  expect(takesNumbers.length).toBeGreaterThan(4);
  expect(takesNumbers.filter((file) => !spoiled.has(file))).toEqual([]);
});

/**
 * The sweep above reads attributes for a reading that is not a number, and a whole class of fault
 * never writes one. An endless ceiling divides every value to nothing, so each bar meets the floor
 * and the series draws flat while its readings differ — measured by taking the finite check off
 * the ceiling, which leaves the entire suite green and every bar the same height.
 *
 * So the drawn heights are read instead of the attribute: three readings that differ have to draw
 * three heights, whatever ceiling they are given.
 */
/**
 * A breakdown draws one segment per part, and the name it is given is the consumer's: two parts
 * may honestly carry one — two rows called `other`, a language counted twice. Keyed by that name,
 * two children would sit under one key, which is the fault the ticker had.
 *
 * React says nothing about it here. A control array with two children deliberately under one key
 * drew no warning at all, so an assertion on the warning would have protected nothing. What can be
 * read is the drawing: two parts, two widths, in the order they were given.
 */
test("two parts sharing a name are still two parts", () => {
  const parts = [
    { name: "other", share: 1, color: "red" },
    { name: "other", share: 3, color: "blue" },
  ];
  const markup = renderToStaticMarkup(createElement(kit.Breakdown, { parts }));

  expect([...markup.matchAll(/width:([\d.]+)%/g)].map(([, width]) => width)).toEqual(["25", "75"]);
});

/**
 * Both of these ask a consumer for an `id`, and both now say in the type what the id is for. What
 * a page draws is readable here: every row and every card is present, whatever the ids say.
 *
 * The deck's real cost is not: it remembers what it has settled by id, so two cards sharing one
 * leave together. That happens on a settle, which is state this suite cannot reach — it is written
 * in the type rather than measured, and the type is the only place a consumer would look.
 */
test("a list with a repeated id still draws every row", () => {
  const entries = [
    { id: "run", name: "first", note: "one" },
    { id: "run", name: "second", note: "two" },
  ];
  const feed = renderToStaticMarkup(createElement(kit.ActivityFeed, { entries }));

  const item = (id: string, title: string) => ({
    id,
    kind: "note",
    title,
    body: "b",
    left: "l",
    right: "r",
  });
  const deck = renderToStaticMarkup(
    createElement(kit.SwipeDeck, { items: [item("card", "first"), item("card", "second")] }),
  );

  expect([...feed.matchAll(/data-slot="activity-entry"/g)]).toHaveLength(2);
  expect(feed).toContain("first");
  expect(feed).toContain("second");
  expect([...deck.matchAll(/data-slot="swipe-card"/g)]).toHaveLength(2);
});

/**
 * A cap draws whatever it is given, and the pages give it four symbols: the command, option and
 * shift keys and the return arrow. A letter reads as itself. A symbol does not — a reader is given
 * the name of the character, or nothing, where a sighted reader sees a key.
 *
 * Left as it stands, and here so it is not left silently. Every way of mending it is a decision
 * about the component's surface rather than a defect to patch: a name on a bare `kbd` is not
 * reliably read, hiding the caps behind spoken words changes what every binding draws, and a
 * spoken form beside each cap changes the shape a consumer passes. The action beside the chord is
 * read either way, so what is lost is which keys, not what they do.
 */
test("a chord of symbols draws the symbols, and says no more than them", () => {
  const markup = renderToStaticMarkup(
    createElement(kit.Binding, { keys: ["⌘", "K"], action: "palette" }),
  );
  const caps = [...markup.matchAll(/<kbd[^>]*>([^<]*)<\/kbd>/g)].map(([, cap]) => cap);

  expect(caps).toEqual(["⌘", "K"]);
  expect(markup).toContain("palette");
  /* No spoken form anywhere: the day one is added, this is the line that has to change. */
  expect(markup).not.toContain("sr-only");
  expect(markup).not.toContain("aria-label");
});

/** A chord may strike one cap twice: `g g` is an ordinary binding, and both caps have to draw. */
test("a binding that repeats a cap still draws both", () => {
  const markup = renderToStaticMarkup(
    createElement(kit.Binding, { keys: ["g", "g"], action: "go to top" }),
  );

  expect([...markup.matchAll(/<kbd[^>]*>([^<]*)<\/kbd>/g)].map(([, cap]) => cap)).toEqual([
    "g",
    "g",
  ]);
});

test("a chart with an unusable ceiling still tells its readings apart", () => {
  const drawn = (max: number | undefined) =>
    [
      ...renderToStaticMarkup(createElement(kit.Bars, { values: [1, 2, 3], max })).matchAll(
        /height:([\d.]+)%/g,
      ),
    ].map(([, height]) => height);

  expect(drawn(undefined)).toHaveLength(3);
  expect(new Set(drawn(undefined)).size).toBe(3);
  expect(new Set(drawn(Number.POSITIVE_INFINITY)).size).toBe(3);
  expect(new Set(drawn(Number.NaN)).size).toBe(3);
  expect(new Set(drawn(0)).size).toBe(3);
});

/**
 * A week that opens mid-week is padded with blank cells, and they sit in the same track as the
 * days. They are what the arrow walk has to stop short of: a blank names no day and takes no mark,
 * so a cursor resting on one reads as an arrow that did nothing.
 *
 * `DAYS` opens on a Tuesday, so two blanks lead the grid. Nothing else in the suite says the pad
 * exists, and the walk's floor was the first cell rather than the first day for as long as both
 * fixtures on the page happened to open on a Sunday.
 */
test("a grid that opens mid-week leads with blank cells", () => {
  const markup = renderToStaticMarkup(createElement(kit.ActivityGrid, { days: DAYS, weeks: 4 }));
  const cells = [...markup.matchAll(/<div (aria-hidden="true"|data-slot="activity-day")/g)].map(
    ([, kind]) => (kind.startsWith("aria-hidden") ? "blank" : "day"),
  );

  expect(DAYS[0]!.date.getDay()).toBe(2);
  expect(cells.slice(0, 4)).toEqual(["blank", "blank", "day", "day"]);
});

/**
 * A name made of nothing is worse than no name: the element is still exposed, and a reader is told
 * `order ` or given a tile called four spaces. The kit says so in words everywhere else — a series
 * of no readings is "no readings", an empty deck is "nothing left" — so the barcode says it too.
 *
 * The avatar cannot: its name is the consumer's to give and there is nothing to fall back on. It
 * drops the attribute instead, which leaves whatever initials were passed to name the tile rather
 * than an empty string overriding them.
 *
 * The icon tile cannot either, and has less to work with: its icon is decoration and its label is
 * the only words it has. This note named it and nothing here read it, so a blank one is pinned
 * below as it stands. Mending it would mean inventing a name for a thing the kit knows nothing
 * about, which is worse than leaving the gap where the consumer can see it.
 */
test("a component given no words does not name itself with them", () => {
  const label = (markup: string) => /aria-label="([^"]*)"/.exec(markup)?.[1];

  expect(label(renderToStaticMarkup(<kit.ReceiptBarcode value="order 42" />))).toBe(
    "order order 42",
  );
  expect(label(renderToStaticMarkup(<kit.ReceiptBarcode value="" />))).toBe("no order");
  expect(label(renderToStaticMarkup(<kit.ReceiptBarcode value="   " />))).toBe("no order");

  /*
   * The tile of spaces the note above names, pinned rather than mended. Its words are its markup
   * and not an attribute, and it has no reading, no order and no queue to fall back on — the same
   * position as the avatar below. So a blank name stays blank and stays the consumer's to fix.
   */
  const tile = (label: string) =>
    renderToStaticMarkup(<kit.IconTile icon={<span>x</span>} label={label} />);

  expect(tile("open")).toContain(">open<");
  expect(tile("   ")).toContain(">   <");
  expect(tile("   ")).not.toContain("aria-label");

  expect(label(renderToStaticMarkup(<kit.Avatar name="Ada Lovelace" />))).toBe("Ada Lovelace");
  expect(label(renderToStaticMarkup(<kit.Avatar name="" />))).toBeUndefined();
  expect(label(renderToStaticMarkup(<kit.Avatar name="   " />))).toBeUndefined();
  /* Initials given without a name still name the tile, so dropping the label loses nothing. */
  expect(renderToStaticMarkup(<kit.Avatar name="" initials="AB" />)).toContain(">AB<");
});

/**
 * `??` catches a label nobody passed and not a label made of nothing, so an empty string reached
 * the attribute and overrode the name each of these works out for itself. The avatar and the
 * barcode were the first two found; these six are the same fault written six more times.
 */
test("a blank label falls back to the name a component gives itself", () => {
  const label = (markup: string) => /aria-label="([^"]*)"/.exec(markup)?.[1];

  expect(label(renderToStaticMarkup(<kit.Sparkline values={[1, 2]} label="" />))).toBe(
    "2 readings, latest 2",
  );
  expect(label(renderToStaticMarkup(<kit.Bars values={[1, 2]} label="  " />))).toBe(
    "2 readings, latest 2",
  );
  expect(
    label(
      renderToStaticMarkup(
        <kit.Breakdown parts={[{ name: "a", share: 1, color: "red" }]} label="" />,
      ),
    ),
  ).toBe("a 100%");
  expect(label(renderToStaticMarkup(<kit.LayoutPreview panes={[]} label="" />))).toBe("0 panes");
  expect(label(renderToStaticMarkup(<kit.ActivityGrid days={[]} label="" />))).toBe("activity");
  expect(label(renderToStaticMarkup(<kit.SwipeDeck items={[]} label="   " />))).toBe("queue");
});

/**
 * A component drawn as one image has one name, and whatever it writes inside is read by nobody.
 * Two rules already say this, one for a tooltip and one for a sparkline's caption. This asks it of
 * every component that draws itself as an image.
 */
const AS_IMAGES = [
  { name: "ActivityGrid", drawn: <kit.ActivityGrid days={DAYS} weeks={4} /> },
  { name: "Bars", drawn: <kit.Bars values={[1, 2, 3]} /> },
  {
    name: "Breakdown",
    drawn: (
      <kit.Breakdown
        parts={[
          { name: "ts", share: 1, color: "red" },
          { name: "css", share: 1, color: "blue" },
        ]}
      />
    ),
  },
  {
    name: "LayoutPreview",
    drawn: <kit.LayoutPreview panes={[{ left: 0, top: 0, width: 1, height: 1 }]} />,
  },
  { name: "ReceiptBarcode", drawn: <kit.ReceiptBarcode value="order 42" /> },
  { name: "Sparkline", drawn: <kit.Sparkline values={[1, 2, 3]} /> },
];

/**
 * A calendar names its own axis for a reader running an eye down it. That reader is the only one
 * who gets it: these sit inside the image and are not exposed, which is right, because the summary
 * already gives the span and the total and there are no rows to scan without eyes.
 */
const CALENDAR = new Set([
  ..."jan feb mar apr may jun jul aug sep oct nov dec".split(" "),
  ..."sun mon tue wed thu fri sat".split(" "),
]);

/**
 * A feed draws a mark before its title and a mark before every entry, both through the same slot.
 * The entry's was hidden and the title's was not, so the one glyph a page passes — a filled block —
 * was announced ahead of the heading as the name of a shape.
 */
test("both marks a feed draws are decoration, not just the one", () => {
  const markup = renderToStaticMarkup(
    <kit.ActivityFeed
      title="runs"
      titleIcon={<span>block</span>}
      entries={[{ id: "a", name: "snap", note: "resolved", icon: <span>dot</span> }]}
    />,
  );

  expect([...markup.matchAll(/aria-hidden="true"/g)]).toHaveLength(2);
  expect(markup).toMatch(/aria-hidden="true"[^>]*><span>block<\/span>/);
});

/**
 * The words an empty series is given. A page tells its reader these exact ones — that what a
 * screen reader hears is "no readings", and never a count of zero followed by a value that is not
 * there — and the note on the rule below reasons from them as the kit's settled habit.
 *
 * Two components return them, a page promises them and a comment cites them. Nothing read them.
 * The half about a value that is not there is caught by the attribute sweep, which reads for the
 * word undefined; the words themselves were free to change under all three.
 */
test("an empty series is given the words a page says it is given", () => {
  const named = (markup: string) => /aria-label="([^"]*)"/.exec(markup)?.[1];

  expect(named(renderToStaticMarkup(<kit.Sparkline values={[]} />))).toBe("no readings");
  expect(named(renderToStaticMarkup(<kit.Bars values={[]} />))).toBe("no readings");
  /* The deck says it in what it draws rather than in its name, which stays what the deck is. */
  const deck = renderToStaticMarkup(<kit.SwipeDeck items={[]} />);

  expect(deck).toContain("nothing left");
  expect(named(deck)).toBe("queue");
});

const unsaidIn = (name: string, markup: string) => {
  const names = [...markup.matchAll(/aria-label="([^"]*)"/g)].map(([, one]) => one!).join(" ");

  return [...markup.matchAll(/>([^<>]+)</g)]
    .map(([, one]) => one!.trim())
    .filter((one) => one.length > 0 && !CALENDAR.has(one))
    .filter((one) => !names.includes(one))
    .map((one) => `${name} draws ${one}`);
};

test("a component drawing what its name leaves out is reported", () => {
  /* The shape the sparkline's caption had: a figure at the head, and a name giving the window. */
  const named = renderToStaticMarkup(
    <kit.Breakdown
      label="language split"
      parts={[
        { name: "ts", share: 1, color: "red" },
        { name: "css", share: 1, color: "blue" },
      ]}
    />,
  );

  expect(unsaidIn("Breakdown", named)).toEqual([
    "Breakdown draws ts 50%",
    "Breakdown draws css 50%",
  ]);
});

test("what a component draws as an image is said in a name it carries", () => {
  /* Read first: a reader finding no drawn words at all agrees with every name it is given. */
  expect(
    AS_IMAGES.filter(({ drawn }) => /aria-label="/.test(renderToStaticMarkup(drawn))).length,
  ).toBe(6);
  expect(
    AS_IMAGES.flatMap(({ name, drawn }) => unsaidIn(name, renderToStaticMarkup(drawn))),
  ).toEqual([]);
});

/**
 * A window longer than a year carries each month twice, and the marks were told apart by the month
 * alone. The second September matched the first and was dropped, so the later half of a long plot
 * drew no months at all while the earlier half drew all twelve.
 */
test("a plot longer than a year marks the months of both years", () => {
  const days = Array.from({ length: 730 }, (_, index) => ({
    date: new Date(2024, 0, 1 + index),
    count: 1,
  }));
  const marks = [
    ...renderToStaticMarkup(<kit.ActivityGrid days={days} weeks={105} />).matchAll(
      /left:(\d+)px[^>]*>([a-z]{3})</g,
    ),
  ].map(([, left, month]) => ({ left: Number(left), month: month! }));

  const lefts = marks.map(({ left }) => left);

  expect(marks.length).toBeGreaterThan(20);
  /* Twelve names across two dozen marks is the property that broke: each name is drawn twice. */
  expect(new Set(marks.map(({ month }) => month)).size).toBe(12);
  /* Read left to right, and no two marks share a column. */
  expect(lefts).toEqual([...lefts].sort((a, b) => a - b));
  expect(new Set(lefts).size).toBe(marks.length);
});
