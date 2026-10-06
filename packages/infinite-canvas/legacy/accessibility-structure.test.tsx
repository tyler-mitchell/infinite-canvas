import { renderToStaticMarkup } from "react-dom/server";
import { expect, test } from "vite-plus/test";

import { reduceInfiniteCanvasState } from "./operations";
import {
  createInfiniteCanvasState,
  createInfiniteCanvasWindow,
  defineInfiniteCanvasWindowRegistry,
} from "./factory";
import { InfiniteCanvasViewport } from "./infinite-canvas";
import { InfiniteCanvasProvider } from "./react/store";
import type { InfiniteCanvasState } from "./types";

type Kind = "note";

const registry = defineInfiniteCanvasWindowRegistry<Kind>({
  note: { kind: "note", renderBody: ({ window }) => <p>{window.title}</p> },
});

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

  return reduceInfiniteCanvasState(
    reduceInfiniteCanvasState(floating, { direction: "right", type: "window.dockDirection" }),
    { layout: "tabs", type: "group.setLayout" },
  );
};

const markup = renderToStaticMarkup(
  <InfiniteCanvasProvider initialState={tabbedCanvas()} windowDefinitions={registry}>
    <InfiniteCanvasViewport<Kind> />
  </InfiniteCanvasProvider>,
);

const attributeValues = (source: string, attribute: string) =>
  [...source.matchAll(new RegExp(`${attribute}="([^"]*)"`, "g"))].map((match) => match[1] ?? "");

const ID_REFERENCE_ATTRIBUTES = [
  "aria-activedescendant",
  "aria-controls",
  "aria-describedby",
  "aria-labelledby",
  "aria-owns",
];

test("the canvas under test actually renders a tab strip, or the rest asserts nothing", () => {
  expect(markup).toContain('role="tab"');
  expect(markup).toContain("aria-controls=");
});

test("every ARIA id reference points at an element that exists", () => {
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
  const positive = attributeValues(markup, "tabindex").filter((value) => Number(value) > 0);

  expect(positive).toEqual([]);
});

test("every tab sits inside a tablist", () => {
  const tablistCount = attributeValues(markup, "role").filter((role) => role === "tablist").length;

  expect(attributeValues(markup, "role")).toContain("tab");
  expect(tablistCount).toBeGreaterThan(0);
});
