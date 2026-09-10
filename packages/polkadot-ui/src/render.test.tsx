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
  "PopoverClose",
  "PopoverContent",
  "PopoverDescription",
  "PopoverTitle",
  "PopoverTrigger",
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

/**
 * `label` says "Omit for a bare track", and `showValue` defaults to true, so omitting the label
 * alone leaves a header carrying the value. Both halves have to go for the track to be bare.
 */
test("a track is bare only when neither the label nor the value is asked for", () => {
  const noLabel = renderToStaticMarkup(<kit.Slider defaultValue={40} />);
  const bare = renderToStaticMarkup(<kit.Slider showValue={false} />);
  const labelled = renderToStaticMarkup(<kit.Slider label="zoom" defaultValue={40} />);

  expect(noLabel).toContain("40");
  expect(bare).not.toMatch(/>\d+</);
  expect(labelled).toContain("zoom");
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
