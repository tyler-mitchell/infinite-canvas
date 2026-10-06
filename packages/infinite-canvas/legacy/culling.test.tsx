import { renderToStaticMarkup } from "react-dom/server";
import { expect, test } from "vite-plus/test";

import {
  createInfiniteCanvasState,
  createInfiniteCanvasWindow,
  defineInfiniteCanvasWindowRegistry,
} from "./factory";
import { InfiniteCanvasViewport } from "./infinite-canvas";
import { InfiniteCanvasProvider } from "./react/store";

type Kind = "note";

const registry = defineInfiniteCanvasWindowRegistry<Kind>({
  note: { kind: "note", renderBody: ({ window }) => <p>{window.title}</p> },
});

const canvas = () => ({
  ...createInfiniteCanvasState<Kind>({
    windows: [
      createInfiniteCanvasWindow<Kind>({
        id: "near",
        kind: "note",
        rect: { height: 200, width: 300, x: 0, y: 0 },
        title: "near",
      }),
      createInfiniteCanvasWindow<Kind>({
        id: "far",
        kind: "note",
        rect: { height: 200, width: 300, x: 40_000, y: 40_000 },
        title: "far",
      }),
    ],
  }),
  viewport: { height: 800, width: 1200 },
});

const markup = () =>
  renderToStaticMarkup(
    <InfiniteCanvasProvider initialState={canvas()} windowDefinitions={registry}>
      <InfiniteCanvasViewport<Kind> />
    </InfiniteCanvasProvider>,
  );

test("an offscreen window is still in the document", () => {
  const rendered = markup();

  expect(rendered).toContain('data-infinite-canvas-window-id="far"');
  expect(rendered).toContain("far</p>");
  expect(rendered).not.toContain("content-visibility");
});
