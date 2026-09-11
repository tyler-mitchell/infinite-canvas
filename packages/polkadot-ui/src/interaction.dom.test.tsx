import { act, createElement } from "react";
import { createRoot } from "react-dom/client";
import { expect, test } from "vite-plus/test";

import { ActivityGrid, dayReadout } from "./components/activity-grid.tsx";
import { NumberTicker } from "./components/number-ticker.tsx";
import { settledAs, SwipeDeck, type SwipeItem } from "./components/swipe-deck.tsx";
import { Readout } from "./components/text.tsx";

/**
 * The first tests in this kit with a document. Every other suite reads source or renders markup on
 * a server, so nothing until now could press a key and see what changed — and the rules that stand
 * in for it say so themselves: one asks only that the spoken words live in an exported function,
 * because it cannot check that they arrive.
 *
 * The environment is scoped to these files in `vite.config.ts` rather than set for the package. A
 * document replaces the global `URL`, and every suite that reads a file builds one from
 * `import.meta.url`: with one set for all of them, eight suites stopped at `readFileSync` before a
 * single rule ran.
 */
const draw = (node: React.ReactNode) => {
  const host = document.createElement("div");
  document.body.append(host);
  const root = createRoot(host);

  act(() => root.render(node));

  return {
    host,
    /** Draws again into the same root, which is what a value changing in place means. */
    redraw: (next: React.ReactNode) => act(() => root.render(next)),
    spoken: () => host.querySelector('[data-slot="text-readout"]')!.textContent,
    /**
     * One `act` for each press. Two dispatched in one of them both read the state of the render
     * they started in, so a deck given two arrows settled the same card twice and reported the
     * first card's name for both — the component was right and the harness was asking wrongly.
     */
    press: (key: string, times = 1) =>
      Array.from({ length: times }).forEach(() =>
        act(() => {
          host.firstElementChild!.dispatchEvent(
            new KeyboardEvent("keydown", { key, bubbles: true }),
          );
        }),
      ),
    /** React listens for `focusout`, so a `blur` event reaches `onBlur` in a browser and not here. */
    leave: () =>
      act(() => {
        host.firstElementChild!.dispatchEvent(new FocusEvent("focusout", { bubbles: true }));
      }),
  };
};

const CARDS: readonly SwipeItem[] = [
  { id: "a", kind: "gist", title: "first", body: "one", left: "l", right: "r" },
  { id: "b", kind: "gist", title: "second", body: "two", left: "l", right: "r" },
];

const deckIn = (host: HTMLElement) => ({
  well: host.querySelector<HTMLElement>('[data-slot="swipe-deck"]')!,
  top: () => host.querySelector('[data-slot="swipe-card"]:last-of-type')?.textContent ?? "",
});

test("a deck says nothing until a card is settled", () => {
  const { host, spoken } = draw(createElement(SwipeDeck, { items: CARDS }));

  expect(spoken()).toBe("");
  expect(deckIn(host).well.getAttribute("aria-keyshortcuts")).toBe("ArrowLeft ArrowRight");
});

/**
 * The words a reader hears, checked by hearing them. `settledAs` is tested on its own elsewhere,
 * which proves the sentence and not that anything ever says it — the deck could build the line and
 * drop it, or put it somewhere with no voice, and every rule in the kit would still pass.
 */
test("a card settled by keyboard is announced with what is now on top", () => {
  const { host, spoken, press } = draw(createElement(SwipeDeck, { items: CARDS }));

  press("ArrowLeft");

  expect(spoken()).toBe(settledAs("skip", "first", "second"));
  expect(deckIn(host).top()).toContain("second");
});

test("a key the deck does not answer decides nothing", () => {
  const { host, spoken, press } = draw(createElement(SwipeDeck, { items: CARDS }));

  press("ArrowUp");

  expect(spoken()).toBe("");
  expect(deckIn(host).top()).toContain("first");
});

/**
 * An empty deck is not a deck with nothing in it: the well leaves the tab order and stops claiming
 * keys, so a reader tabbing through the page does not land on something that answers nothing.
 */
test("a deck that runs out stops taking the focus and stops claiming its keys", () => {
  const { host, spoken, press } = draw(createElement(SwipeDeck, { items: CARDS }));

  press("ArrowRight", 2);

  expect(spoken()).toBe(settledAs("pin", "second", "nothing left"));
  expect(deckIn(host).well.tabIndex).toBe(-1);
  expect(deckIn(host).well.getAttribute("aria-keyshortcuts")).toBeNull();
});

/**
 * Four whole weeks ending on a Saturday, so every column is full and no cell is a pad. Built from
 * local parts rather than a timestamp: read back as a local date, a UTC one lands on the day before
 * and every name in these tests moves with it.
 */
const LAST = new Date(2026, 0, 3);
const DAYS = Array.from({ length: 28 }, (_, index) => ({
  date: new Date(2026, 0, LAST.getDate() - 27 + index),
  count: index,
}));

const grid = () => createElement(ActivityGrid, { days: DAYS, label: "commits" });

const hotCells = (host: HTMLElement) => host.querySelectorAll("[data-hot]").length;

test("a grid names its series until an arrow walks it", () => {
  const { spoken } = draw(grid());

  expect(spoken()).toBe("commits");
});

/**
 * The plot says which arrows walk it, so pressing one owes the reader the day it landed on. Up and
 * down step a day, and the cell under the cursor is marked — one of them, never two.
 */
test("an arrow walks the grid and the line names the day it reached", () => {
  const { host, spoken, press } = draw(grid());

  press("ArrowUp");

  expect(spoken()).toBe(dayReadout(DAYS[26], "commits"));
  expect(hotCells(host)).toBe(1);

  press("ArrowDown");

  expect(spoken()).toBe(dayReadout(DAYS[27], "commits"));
  expect(hotCells(host)).toBe(1);
});

test("a week is one arrow sideways", () => {
  const { spoken, press } = draw(grid());

  press("ArrowLeft");

  expect(spoken()).toBe(dayReadout(DAYS[20], "commits"));
});

/**
 * Walking off the end stops on the first day rather than on a blank. A column that opens mid-week
 * is padded, and a cursor resting on a pad names no day and marks no cell, which reads as the arrow
 * having broken.
 */
test("a walk past the first day stops on it, still naming a day", () => {
  const { host, spoken, press } = draw(grid());

  press("ArrowUp", 60);

  expect(spoken()).toBe(dayReadout(DAYS[0], "commits"));
  expect(hotCells(host)).toBe(1);
});

/**
 * The ticker's documentation says it replaces its figure in silence and has to be drawn through
 * `Readout` when the value moves. Both halves are claims about a change over time, so nothing that
 * renders once could check either: markup on a server shows the figure, never the replacing.
 */
const ticker = (value: number) => createElement(NumberTicker, { value });

test("a ticker changes its figure in the element that already held one", () => {
  const { host, redraw } = draw(ticker(41));
  const before = host.querySelector('[data-slot="number-ticker-value"]')!;

  expect(before.textContent).toBe("41");

  redraw(ticker(42));

  expect(host.querySelector('[data-slot="number-ticker-value"]')).toBe(before);
  expect(before.textContent).toBe("42");
});

test("a ticker on its own carries nothing that would announce the change", () => {
  const { host } = draw(ticker(41));

  expect(host.querySelector("[aria-live]")).toBeNull();
  expect(host.querySelector('[role="status"]')).toBeNull();
});

test("a ticker drawn through a readout changes inside the region that speaks", () => {
  const { host, spoken, redraw } = draw(createElement(Readout, { render: ticker(41) }));
  const region = host.querySelector('[data-slot="text-readout"]')!;

  expect(region.getAttribute("aria-live")).toBe("polite");
  expect(spoken()).toContain("41");

  redraw(createElement(Readout, { render: ticker(42) }));

  expect(host.querySelector('[data-slot="text-readout"]')).toBe(region);
  expect(spoken()).toContain("42");
});

test("a grid that loses the focus goes back to naming the series", () => {
  const { host, spoken, press, leave } = draw(grid());

  press("ArrowUp");
  leave();

  expect(spoken()).toBe("commits");
  expect(hotCells(host)).toBe(0);
});
