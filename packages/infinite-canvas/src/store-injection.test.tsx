import { renderToStaticMarkup } from "react-dom/server";
import { expect, test } from "vite-plus/test";

import { createInfiniteCanvasHandle } from "./canvas-handle";
import { createInfiniteCanvasState, createInfiniteCanvasWindow } from "./factory";
import { defineInfiniteCanvasWindowRegistry } from "./factory";
import { InfiniteCanvasViewport } from "./infinite-canvas";
import { createInfiniteCanvasStore, InfiniteCanvasProvider } from "./store";

type Kind = "note";

const registry = defineInfiniteCanvasWindowRegistry<Kind>({
  note: { kind: "note", renderBody: ({ window }) => <p>{window.title}</p> },
});

const seedState = () =>
  createInfiniteCanvasState<Kind>({
    viewport: { height: 600, width: 900 },
    windows: [
      createInfiniteCanvasWindow<Kind>({
        id: "note-1",
        kind: "note",
        rect: { height: 200, width: 320, x: 0, y: 0 },
        title: "Owned",
      }),
    ],
  });

test("the provider renders an injected store rather than minting its own", () => {
  const store = createInfiniteCanvasStore(seedState());

  store.commands.dispatch({
    type: "window.open",
    window: createInfiniteCanvasWindow<Kind>({
      id: "note-2",
      kind: "note",
      rect: { height: 200, width: 320, x: 400, y: 0 },
      title: "Added by the parent",
    }),
  });

  const markup = renderToStaticMarkup(
    <InfiniteCanvasProvider store={store}>
      <InfiniteCanvasViewport<Kind> windowDefinitions={registry} />
    </InfiniteCanvasProvider>,
  );

  expect(markup).toContain("Added by the parent");
  expect(markup).toContain("Owned");
});

test("a parent-held handle reads and drives the same canvas", () => {
  const store = createInfiniteCanvasStore(seedState());
  const handle = createInfiniteCanvasHandle(store);

  expect(handle.getState().windows).toHaveLength(1);

  handle.commands.executeCommand({ type: "activeWindow.close" });

  expect(handle.getState().windows).toHaveLength(0);
  expect(store.state$.peek().windows).toHaveLength(0);

  const markup = renderToStaticMarkup(
    <InfiniteCanvasProvider store={store}>
      <InfiniteCanvasViewport<Kind> windowDefinitions={registry} />
    </InfiniteCanvasProvider>,
  );

  expect(markup).not.toContain("Owned");
});

test("a parent-held handle sees the contextual commands the canvas would offer", () => {
  const handle = createInfiniteCanvasHandle(createInfiniteCanvasStore(seedState()));
  const commands = new Map(
    handle.getContextualCommands().map((command) => [command.id, command.enabled]),
  );

  expect(commands.get("activeWindow.close")).toBe(true);
  expect(commands.has("group.equalizeChildren")).toBe(false);
});

test("a snapshot taken through the handle round-trips the parent's own state", () => {
  const store = createInfiniteCanvasStore(seedState());
  const handle = createInfiniteCanvasHandle(store);

  expect(handle.snapshot().windows.map((window) => window.id)).toEqual(["note-1"]);
});
