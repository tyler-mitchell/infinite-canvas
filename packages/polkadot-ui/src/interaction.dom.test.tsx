import { act, createElement } from "react";
import { createRoot } from "react-dom/client";
import { expect, test } from "vite-plus/test";

import { settledAs, SwipeDeck, type SwipeItem } from "./components/swipe-deck.tsx";

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
const CARDS: readonly SwipeItem[] = [
  { id: "a", kind: "gist", title: "first", body: "one", left: "l", right: "r" },
  { id: "b", kind: "gist", title: "second", body: "two", left: "l", right: "r" },
];

const mount = (items: readonly SwipeItem[]) => {
  const host = document.createElement("div");
  document.body.append(host);
  const root = createRoot(host);

  act(() => root.render(createElement(SwipeDeck, { items })));

  const well = host.querySelector<HTMLElement>('[data-slot="swipe-deck"]')!;

  return {
    well,
    spoken: () => host.querySelector('[data-slot="text-readout"]')!.textContent,
    top: () => host.querySelector('[data-slot="swipe-card"]:last-of-type')?.textContent ?? "",
    press: (key: string) =>
      act(() => {
        well.dispatchEvent(new KeyboardEvent("keydown", { key, bubbles: true }));
      }),
  };
};

test("a deck says nothing until a card is settled", () => {
  const deck = mount(CARDS);

  expect(deck.spoken()).toBe("");
  expect(deck.well.getAttribute("aria-keyshortcuts")).toBe("ArrowLeft ArrowRight");
});

/**
 * The words a reader hears, checked by hearing them. `settledAs` is tested on its own elsewhere,
 * which proves the sentence and not that anything ever says it — the deck could build the line and
 * drop it, or put it somewhere with no voice, and every rule in the kit would still pass.
 */
test("a card settled by keyboard is announced with what is now on top", () => {
  const deck = mount(CARDS);

  deck.press("ArrowLeft");

  expect(deck.spoken()).toBe(settledAs("skip", "first", "second"));
  expect(deck.top()).toContain("second");
});

test("a key the deck does not answer decides nothing", () => {
  const deck = mount(CARDS);

  deck.press("ArrowUp");

  expect(deck.spoken()).toBe("");
  expect(deck.top()).toContain("first");
});

/**
 * An empty deck is not a deck with nothing in it: the well leaves the tab order and stops claiming
 * keys, so a reader tabbing through the page does not land on something that answers nothing.
 */
test("a deck that runs out stops taking the focus and stops claiming its keys", () => {
  const deck = mount(CARDS);

  deck.press("ArrowRight");
  deck.press("ArrowRight");

  expect(deck.spoken()).toBe(settledAs("pin", "second", "nothing left"));
  expect(deck.well.tabIndex).toBe(-1);
  expect(deck.well.getAttribute("aria-keyshortcuts")).toBeNull();
});
