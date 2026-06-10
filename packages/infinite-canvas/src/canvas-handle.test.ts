import { expect, test } from "vite-plus/test";

import { createInfiniteCanvasHandle } from "./canvas-handle";
import { createInfiniteCanvasState, createInfiniteCanvasWindow } from "./factory";
import { createInfiniteCanvasStore } from "./store";

function createTestStore() {
  return createInfiniteCanvasStore(
    createInfiniteCanvasState({
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
  );
}

test("handle commands drive the same mutation path as the store", () => {
  const store = createTestStore();
  const handle = createInfiniteCanvasHandle(store);

  handle.commands.selectWindow("note-2");
  handle.commands.focusWindow("note-2");

  const state = handle.getState();
  expect(state.activeWindowId).toBe("note-2");
  expect(state.selection.windowIds).toEqual(["note-2"]);
});

test("handle snapshots are JSON-safe and strip transient interaction", () => {
  const store = createTestStore();
  const handle = createInfiniteCanvasHandle(store);

  const snapshot = handle.snapshot();
  expect(() => JSON.stringify(snapshot)).not.toThrow();
  expect(JSON.parse(JSON.stringify(snapshot))).toEqual(snapshot);
  expect("interaction" in snapshot).toBe(false);
});

test("handle lists enabled contextual commands with descriptors", () => {
  const store = createTestStore();
  const handle = createInfiniteCanvasHandle(store);

  // Fit commands require a usable viewport; a headless store starts at 0x0.
  handle.commands.setViewport({ height: 800, width: 1200 });

  const commands = handle.getContextualCommands();
  expect(commands.length).toBeGreaterThan(0);
  for (const command of commands) {
    expect(command.enabled).toBe(true);
    expect(typeof command.id).toBe("string");
    expect(typeof command.label).toBe("string");
  }

  const fitAll = commands.find((command) => command.id === "view.fitAll");
  expect(fitAll).toBeDefined();
});

test("handle executes contextual command descriptors", () => {
  const store = createTestStore();
  const handle = createInfiniteCanvasHandle(store);
  handle.commands.setViewport({ height: 800, width: 1200 });
  const before = handle.getState().camera;

  handle.commands.executeCommand({ type: "view.fitAll" });

  expect(handle.getState().camera).not.toEqual(before);
});
