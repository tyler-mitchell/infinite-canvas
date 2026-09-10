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
