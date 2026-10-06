import { renderToStaticMarkup } from "react-dom/server";
import { expect, test } from "vite-plus/test";

import { createInfiniteCanvasState, createInfiniteCanvasWindow } from "./factory";
import { defineInfiniteCanvasWindowRegistry } from "./factory";
import { InfiniteCanvasViewport } from "./infinite-canvas";
import { InfiniteCanvasProvider } from "./react/store";
import { createInfiniteCanvasStore } from "./store";

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
  const store = createInfiniteCanvasStore({
    initialState: seedState(),
    windowDefinitions: registry,
  });

  store.dispatch({
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
      <InfiniteCanvasViewport<Kind> />
    </InfiniteCanvasProvider>,
  );

  expect(markup).toContain("Added by the parent");
  expect(markup).toContain("Owned");
});

test("a parent-held store reads and drives the same canvas", () => {
  const store = createInfiniteCanvasStore({
    initialState: seedState(),
    windowDefinitions: registry,
  });

  expect(store.getState().windows).toHaveLength(1);

  store.dispatch({ type: "activeWindow.close" });

  expect(store.getState().windows).toHaveLength(0);
  expect(store.state$.peek().windows).toHaveLength(0);

  const markup = renderToStaticMarkup(
    <InfiniteCanvasProvider store={store}>
      <InfiniteCanvasViewport<Kind> />
    </InfiniteCanvasProvider>,
  );

  expect(markup).not.toContain("Owned");
});

test("a parent-held store sees the contextual commands the canvas would offer", () => {
  const store = createInfiniteCanvasStore({ initialState: seedState() });
  const commands = new Map(
    store.getContextualCommands().map((command) => [command.id, command.enabled]),
  );

  expect(commands.get("activeWindow.close")).toBe(true);
  expect(commands.has("group.equalizeChildren")).toBe(false);
});

test("a snapshot taken through the store round-trips the parent's own state", () => {
  const store = createInfiniteCanvasStore({ initialState: seedState() });

  expect(store.snapshot().windows.map((window) => window.id)).toEqual(["note-1"]);
});

test("unavailable renderers preserve window data and undo history", () => {
  const store = createInfiniteCanvasStore<string>({
    initialState: {
      ...seedState(),
      windows: [
        createInfiniteCanvasWindow({
          id: "retained",
          kind: "unavailable",
          title: "Retained content",
          data: { text: "Keep this content" },
          rect: { x: 0, y: 0, width: 320, height: 200 },
        }),
      ],
    },
  });
  store.dispatch({ type: "window.setTitle", windowId: "retained", title: "Still retained" });
  const document = store.snapshot();
  const history = store.history.getHistory();
  const unavailable = renderToStaticMarkup(
    <InfiniteCanvasProvider store={store}>
      <InfiniteCanvasViewport<string> />
    </InfiniteCanvasProvider>,
  );
  expect(unavailable).toContain("Content unavailable");
  expect(store.snapshot()).toEqual(document);
  expect(store.history.getHistory()).toBe(history);

  store.windowDefinitions$.set({
    unavailable: { kind: "unavailable", renderBody: () => <p>Renderer restored</p> },
  });
  const restored = renderToStaticMarkup(
    <InfiniteCanvasProvider store={store}>
      <InfiniteCanvasViewport<string> />
    </InfiniteCanvasProvider>,
  );
  expect(restored).toContain("Renderer restored");
  expect(store.snapshot()).toEqual(document);
  expect(store.history.getHistory()).toBe(history);
});
