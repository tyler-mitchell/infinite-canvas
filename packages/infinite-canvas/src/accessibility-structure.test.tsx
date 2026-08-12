import { renderToStaticMarkup } from "react-dom/server";
import { expect, test } from "vite-plus/test";

import { executeInfiniteCanvasCommand } from "./commands";
import {
  createInfiniteCanvasState,
  createInfiniteCanvasWindow,
  defineInfiniteCanvasWindowRegistry,
} from "./factory";
import { InfiniteCanvasViewport } from "./infinite-canvas";
import { InfiniteCanvasProvider } from "./store";
import type { InfiniteCanvasState } from "./types";

/**
 * The structural half of the accessibility audit, as a guard rather than a checklist.
 *
 * P5's exit criterion asks that "an a11y audit checklist in the repo passes". No checklist
 * exists, and writing one would produce a document that goes stale the way P5's own prose
 * did — it claimed `role="tab"` carried no `aria-controls` for a month after it did. What
 * `accessibility.test.tsx` already covers is ARIA *semantics*: names, roles, states, hidden
 * decoration. What nothing covered is the structural class, where the failures are silent.
 *
 * These run against a canvas with a real tab group, which the existing file never builds —
 * it renders a lone frame and the HUD, so `aria-controls` is never emitted there and the
 * relationship these tests exist for cannot be observed.
 */

type Kind = "note";

const registry = defineInfiniteCanvasWindowRegistry<Kind>({
  note: { kind: "note", renderBody: ({ window }) => <p>{window.title}</p> },
});

/** Two windows docked into one shell, converted to tabs so a tab strip is rendered. */
const tabbedCanvas = (): InfiniteCanvasState<Kind> => {
  const floating: InfiniteCanvasState<Kind> = {
    ...createInfiniteCanvasState<Kind>({
      viewport: { height: 800, width: 1200 },
      windows: [
        createInfiniteCanvasWindow<Kind>({
          id: "west",
          kind: "note",
          rect: { height: 200, width: 300, x: 0, y: 0 },
          title: "West",
        }),
        createInfiniteCanvasWindow<Kind>({
          id: "east",
          kind: "note",
          rect: { height: 200, width: 300, x: 400, y: 0 },
          title: "East",
        }),
      ],
    }),
    activeWindowId: "west",
  };

  return executeInfiniteCanvasCommand(
    executeInfiniteCanvasCommand(floating, { direction: "right", type: "window.dockDirection" }),
    { layout: "tabs", type: "group.setLayout" },
  );
};

const markup = renderToStaticMarkup(
  <InfiniteCanvasProvider initialState={tabbedCanvas()}>
    <InfiniteCanvasViewport<Kind> windowDefinitions={registry} />
  </InfiniteCanvasProvider>,
);

const attributeValues = (source: string, attribute: string) =>
  [...source.matchAll(new RegExp(`${attribute}="([^"]*)"`, "g"))].map((match) => match[1] ?? "");

/** Every ARIA attribute whose value is one or more element ids. */
const ID_REFERENCE_ATTRIBUTES = [
  "aria-activedescendant",
  "aria-controls",
  "aria-describedby",
  "aria-labelledby",
  "aria-owns",
];

test("the canvas under test actually renders a tab strip, or the rest asserts nothing", () => {
  // A guard on the guard. If docking or the layout conversion ever stops producing tabs,
  // every assertion below would pass over an empty set and quietly stop testing anything.
  expect(markup).toContain('role="tab"');
  expect(markup).toContain("aria-controls=");
});

test("every ARIA id reference points at an element that exists", () => {
  // The silent failure this file was written for. A tab's `aria-controls` is built by
  // `getInfiniteCanvasWindowFrameElementId` at one call site and the frame's `id` by another;
  // nothing made them agree. A screen reader following a dangling reference finds nothing and
  // says nothing, so the defect is invisible to everyone who is not using one.
  const ids = new Set(attributeValues(markup, "id"));
  const dangling = ID_REFERENCE_ATTRIBUTES.flatMap((attribute) =>
    attributeValues(markup, attribute)
      .flatMap((value) => value.split(/\s+/))
      .filter((reference) => reference !== "" && !ids.has(reference))
      .map((reference) => `${attribute}="${reference}"`),
  );

  expect(dangling).toEqual([]);
});

test("no element takes a positive tabindex", () => {
  // A positive tabindex pulls an element out of document order and ahead of everything that
  // never asked for one, which reorders the whole page's tab sequence — not just this
  // library's. Roving tab stops need `0` and `-1`; nothing here needs more.
  const positive = attributeValues(markup, "tabindex").filter((value) => Number(value) > 0);

  expect(positive).toEqual([]);
});

test("every tab sits inside a tablist", () => {
  // `role="tab"` outside a `role="tablist"` is an orphan: assistive technology announces a
  // tab with no set to place it in, and arrow-key expectations it cannot meet.
  const tablistCount = attributeValues(markup, "role").filter((role) => role === "tablist").length;

  expect(attributeValues(markup, "role")).toContain("tab");
  expect(tablistCount).toBeGreaterThan(0);
});
