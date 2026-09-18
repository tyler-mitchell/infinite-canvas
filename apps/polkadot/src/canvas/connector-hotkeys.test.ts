import {
  createInfiniteCanvasStore,
  getInfiniteCanvasContextualEntries,
  type InfiniteCanvasDispatch,
} from "@hyphened/infinite-canvas";
import { expect, test } from "vite-plus/test";

import { getConnectorHotkeyActions } from "./connector-hotkeys";
import type { WindowKind } from "./window-registry";

const dispatched: unknown[] = [];
const dispatch: InfiniteCanvasDispatch<WindowKind> = (action) => {
  dispatched.push(action);
};

const store = createInfiniteCanvasStore<WindowKind>({ initialState: { windows: [] } });
const entries = () =>
  getInfiniteCanvasContextualEntries(store.getState(), {
    commands: store.getContextualCommands({ includeDisabled: true }),
    dispatch,
    hotkeyActions: getConnectorHotkeyActions("project:test"),
  });

const cut = () => entries().find((entry) => entry.id === "connection.cut");

test("cutting a connection is discoverable, not only bindable", () => {
  expect(cut()?.label).toBe("Cut Connection");
});

test("the palette shows both chords the action declares", () => {
  expect(cut()?.hotkeys).toEqual(["Backspace", "Delete"]);
});

test("it carries no framework group, so this app supplies the glyph", () => {
  expect(cut()?.group).toBeUndefined();
});

test("it is offered as unavailable with nothing selected", () => {
  expect(cut()?.enabled).toBe(false);
});

test("it does not displace a framework verb", () => {
  const ids = entries().map((entry) => entry.id);

  expect(ids).toContain("view.fitAll");
  expect(new Set(ids).size).toBe(ids.length);
});
