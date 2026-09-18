import {
  createInfiniteCanvasStore,
  createInfiniteCanvasWindow,
  DEFAULT_INFINITE_CANVAS_COMMAND_DESCRIPTORS,
} from "@hyphened/infinite-canvas";
import { expect, test } from "vite-plus/test";

import { APP_ACTIONS } from "./app-actions";
import type { WindowKind } from "./canvas/window-registry";
import { getPublishedCanvasCommands } from "./published-commands";

const store = createInfiniteCanvasStore<WindowKind>({
  initialState: {
    viewport: { height: 800, width: 1200 },
    windows: [
      createInfiniteCanvasWindow<WindowKind>({
        id: "note-1",
        kind: "note",
        rect: { height: 200, width: 320, x: 0, y: 0 },
        title: "Sources",
      }),
    ],
  },
});

const published = () =>
  getPublishedCanvasCommands({
    dispatch: store.dispatch,
    commands: store.getContextualCommands({ includeDisabled: true }),
    projectId: "project:test",
    state: store.getState(),
  });

test("the canvas's own verbs are published, not just this app's", () => {
  const entries = published();

  expect(entries.length).toBeGreaterThan(50);
  expect(entries.map((entry) => entry.id)).toContain("view.fitAll");
  expect(entries.map((entry) => entry.id)).toContain("history.undo");
});

test("a consumer verb reaches a caller, not only the palette", () => {
  expect(published().map((entry) => entry.id)).toContain("connection.cut");
});

test("a verb whose command is a template is held back", () => {
  const ids = published().map((entry) => entry.id);

  for (const id of [
    "workspace.create",
    "workspace.enter",
    "workspace.close",
    "workspace.moveActiveWindow",
  ]) {
    expect(ids).not.toContain(id);
  }
});

test("the held-back list is derived, not written down", () => {
  const publishedIds = new Set(published().map((entry) => entry.id));
  const appIds = new Set(APP_ACTIONS.map((action) => action.id));
  const unexplained = DEFAULT_INFINITE_CANVAS_COMMAND_DESCRIPTORS.filter(
    (descriptor) =>
      !publishedIds.has(descriptor.id) &&
      !appIds.has(descriptor.id) &&
      !Object.values(descriptor.command).some((value) => value === ""),
  ).map((descriptor) => descriptor.id);

  expect(unexplained).toStrictEqual([]);
});

test("a framework id this app has already wrapped stays the app's", () => {
  expect(APP_ACTIONS.some((action) => action.id === "window.reveal")).toBe(true);
  expect(published().map((entry) => entry.id)).not.toContain("window.reveal");
});

test("no published canvas verb shares a name with an app verb", () => {
  const appIds = new Set(APP_ACTIONS.map((action) => action.id));
  const collisions = published()
    .map((command) => command.id)
    .filter((id) => appIds.has(id));

  expect(collisions).toStrictEqual([]);
});
