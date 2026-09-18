import { getSelectedWindowIds } from "./selection";
import { expect, test } from "vite-plus/test";

import { createInfiniteCanvasState, createInfiniteCanvasWindow } from "./factory";
import { createInfiniteCanvasStore } from "./store";

function createTestStore() {
  return createInfiniteCanvasStore({
    initialState: createInfiniteCanvasState({
      windows: [
        createInfiniteCanvasWindow({
          id: "note-1",
          kind: "note",
          rect: { height: 200, width: 300, x: 0, y: 0 },
          title: "First note",
        }),
        createInfiniteCanvasWindow({
          id: "note-2",
          kind: "note",
          rect: { height: 200, width: 300, x: 400, y: 0 },
          title: "Second note",
        }),
      ],
    }),
  });
}

test("store dispatch drives the mutation path", () => {
  const store = createTestStore();

  store.dispatch({
    type: "selection.replace",
    targets: [{ type: "window" as const, id: "note-2" }],
  });
  store.dispatch({ type: "window.focus", windowId: "note-2" });

  const state = store.getState();
  expect(state.activeWindowId).toBe("note-2");
  expect(getSelectedWindowIds(state.selection)).toEqual(["note-2"]);
});

test("store snapshots are JSON-safe and strip transient interaction", () => {
  const store = createTestStore();

  const snapshot = store.snapshot();
  expect(() => JSON.stringify(snapshot)).not.toThrow();
  expect(JSON.parse(JSON.stringify(snapshot))).toStrictEqual(snapshot);
  expect(createInfiniteCanvasStore({ document: snapshot }).getState()?.windows).toEqual(
    snapshot.windows,
  );
  expect("interaction" in snapshot).toBe(false);
});

test("store lists enabled contextual commands with descriptors", () => {
  const store = createTestStore();

  store.dispatch({ type: "viewport.set", viewport: { height: 800, width: 1200 } });

  const commands = store.getContextualCommands();
  expect(commands.length).toBeGreaterThan(0);
  for (const command of commands) {
    expect(command.enabled).toBe(true);
    expect(typeof command.id).toBe("string");
    expect(typeof command.label).toBe("string");
  }

  const fitAll = commands.find((command) => command.id === "view.fitAll");
  expect(fitAll).toBeDefined();
});

test("store executes contextual command descriptors", () => {
  const store = createTestStore();
  store.dispatch({ type: "viewport.set", viewport: { height: 800, width: 1200 } });
  const before = store.getState().camera;

  store.dispatch({ type: "view.fitAll" });

  expect(store.getState().camera).not.toEqual(before);
});
