import {
  createInfiniteCanvasState,
  getInfiniteCanvasContextualEntries,
} from "@hyphened/infinite-canvas";
import { expect, test } from "vite-plus/test";

import { getConnectorHotkeyActions } from "./connector-hotkeys";
import type { WindowKind } from "./window-registry";

const entries = () =>
  getInfiniteCanvasContextualEntries(createInfiniteCanvasState<WindowKind>({ windows: [] }), {
    actions: getConnectorHotkeyActions("project:test"),
  });

test("cutting a connection is discoverable, not only bindable", () => {
  const cut = entries().find((entry) => entry.id === "connection.cut");

  expect(cut?.source).toBe("consumer");
  expect(cut?.label).toBe("Cut Connection");
});

test("the palette shows both chords the action declares", () => {
  // The hand-built row this replaced showed only ⌫.
  const cut = entries().find((entry) => entry.id === "connection.cut");

  expect(cut?.hotkeys).toEqual(["Backspace", "Delete"]);
});

test("it is offered as unavailable with nothing selected", () => {
  expect(entries().find((entry) => entry.id === "connection.cut")?.enabled).toBe(false);
});

test("it does not displace a framework verb", () => {
  const ids = entries().map((entry) => entry.id);

  expect(ids).toContain("view.fitAll");
  expect(new Set(ids).size).toBe(ids.length);
});
