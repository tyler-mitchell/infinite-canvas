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
  "PopoverPopup",
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

test("the parts that need a root say so rather than drawing wrongly", () => {
  const quiet = [...NEEDS_ITS_ROOT].filter((name) => {
    const value = (kit as Record<string, unknown>)[name];
    if (typeof value !== "function") return false;
    try {
      renderToStaticMarkup(createElement(value as never, {}, "x"));
      return true;
    } catch {
      return false;
    }
  });

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
  expect(html).toContain("aria-keyshortcuts");
});
