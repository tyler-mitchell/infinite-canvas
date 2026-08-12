import { renderToStaticMarkup } from "react-dom/server";
import { expect, test } from "vite-plus/test";

import { createInfiniteCanvasHandle } from "./canvas-handle";
import { createInfiniteCanvasState, createInfiniteCanvasWindow } from "./factory";
import { defineInfiniteCanvasWindowRegistry } from "./factory";
import { InfiniteCanvasViewport } from "./infinite-canvas";
import { createInfiniteCanvasStore, InfiniteCanvasProvider } from "./store";

/**
 * A parent that owns the canvas can now read it, drive it, and hold a handle to it.
 *
 * `createInfiniteCanvasStore` and `createInfiniteCanvasHandle` were public exports that no
 * consumer could reach. The provider minted its own store internally and accepted no
 * `store` prop, so the only way to obtain one was `useInfiniteCanvasStore` from *inside*
 * the tree — which means the handle's stated audience, "agents, E2E drivers, and command
 * palettes", could not obtain the handle, because all three are parent-side. The playground
 * shows the forced workaround: components that only exist to reach down for state a parent
 * already wanted.
 *
 * Injecting the store is the whole fix, and it needs no companion `handleRef` prop: a
 * parent holding the store calls `createInfiniteCanvasHandle(store)` on it directly.
 */

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
  // The load-bearing assertion: the parent mutates its store *before* the canvas exists, and
  // the canvas comes up showing that mutation. A provider that ignored the prop would render
  // the seed title instead, and every other test here would still pass.
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

  // Driving through the handle — the path an agent or E2E driver takes — reaches the store
  // the canvas is rendering from, not a copy of it.
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
  // The handle's whole reason to exist. A palette living outside the canvas needs the same
  // enablement the canvas computes, or it offers verbs that do nothing.
  const handle = createInfiniteCanvasHandle(createInfiniteCanvasStore(seedState()));
  const commands = new Map(
    handle.getContextualCommands().map((command) => [command.id, command.enabled]),
  );

  expect(commands.get("activeWindow.close")).toBe(true);
  // Nothing is docked, so there is no container to equalize.
  expect(commands.has("group.equalizeChildren")).toBe(false);
});

test("a snapshot taken through the handle round-trips the parent's own state", () => {
  const store = createInfiniteCanvasStore(seedState());
  const handle = createInfiniteCanvasHandle(store);

  expect(handle.snapshot().windows.map((window) => window.id)).toEqual(["note-1"]);
});
