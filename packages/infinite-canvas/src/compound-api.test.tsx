import { renderToStaticMarkup } from "react-dom/server";
import { expect, test } from "vite-plus/test";

import {
  createInfiniteCanvasState,
  createInfiniteCanvasWindow,
  defineInfiniteCanvasWindowRegistry,
} from "./factory";
import { InfiniteCanvas, InfiniteCanvasViewport } from "./infinite-canvas";
import { InfiniteCanvasProvider } from "./store";

type Kind = "note";

const registry = defineInfiniteCanvasWindowRegistry<Kind>({
  note: { kind: "note", renderBody: ({ window }) => <p>{window.title}</p> },
});

const state = createInfiniteCanvasState<Kind>({
  viewport: { height: 600, width: 900 },
  windows: [
    createInfiniteCanvasWindow<Kind>({
      id: "note-1",
      kind: "note",
      rect: { height: 200, width: 320, x: 0, y: 0 },
      title: "Composed",
    }),
  ],
});

test("a viewport mounts inside a provider with only a window registry", () => {
  const markup = renderToStaticMarkup(
    <InfiniteCanvasProvider initialState={state}>
      <InfiniteCanvasViewport<Kind> windowDefinitions={registry} />
    </InfiniteCanvasProvider>,
  );

  expect(markup).toContain('data-slot="viewport"');
});

test("the composed canvas renders its windows and their bodies", () => {
  const markup = renderToStaticMarkup(
    <InfiniteCanvasProvider initialState={state}>
      <InfiniteCanvasViewport<Kind> windowDefinitions={registry} />
    </InfiniteCanvasProvider>,
  );

  expect(markup).toContain('data-slot="window"');
  expect(markup).toContain("Composed");
});

test("the namespace object exposes the same parts", () => {
  expect(InfiniteCanvas.Viewport).toBe(InfiniteCanvasViewport);
  expect(InfiniteCanvas.Provider).toBe(InfiniteCanvasProvider);
});
