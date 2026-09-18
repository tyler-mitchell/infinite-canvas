import { DEFAULT_INFINITE_CANVAS_COMMAND_DESCRIPTORS } from "@hyphened/infinite-canvas";
import { expect, test } from "vite-plus/test";

import { APP_ACTIONS } from "../app-actions";
import { CONTEXT_MENU_RINGS, getRing } from "./context-menu-rings";
import { getSpoke, ITEM_SIZE } from "./radial-geometry";

const RING_NAMES = ["canvas", "group", "window"] as const;

test("every framework verb on a ring is a command the framework still publishes", () => {
  const known = new Set(DEFAULT_INFINITE_CANVAS_COMMAND_DESCRIPTORS.map((entry) => entry.id));
  const missing = RING_NAMES.flatMap((name) =>
    CONTEXT_MENU_RINGS[name]
      .filter((entry) => entry.source === "canvas" && !known.has(entry.id))
      .map((entry) => `${name}: ${entry.id}`),
  );

  expect(missing).toStrictEqual([]);
});

test("every app verb on a ring is one this app still defines", () => {
  const known = new Set(APP_ACTIONS.map((action) => action.id));
  const missing = RING_NAMES.flatMap((name) =>
    CONTEXT_MENU_RINGS[name]
      .filter((entry) => entry.source === "app" && !known.has(entry.id))
      .map((entry) => `${name}: ${entry.id}`),
  );

  expect(missing).toStrictEqual([]);
});

test("a ring carries at least one verb whose id is not its command type", () => {
  const byId = new Map(
    DEFAULT_INFINITE_CANVAS_COMMAND_DESCRIPTORS.map((entry) => [entry.id, entry]),
  );
  const encodesAnArgument = RING_NAMES.flatMap((name) =>
    CONTEXT_MENU_RINGS[name].filter(
      (entry) => entry.source === "canvas" && byId.get(entry.id)?.command.type !== entry.id,
    ),
  );

  expect(encodesAnArgument.length).toBeGreaterThan(0);
});

test.each(RING_NAMES)("the %s ring gives every action a separate hit target", (name) => {
  const ring = CONTEXT_MENU_RINGS[name];
  const positions = ring.map((_, index) => getSpoke(index, ring.length));
  for (const [index, position] of positions.entries()) {
    for (const other of positions.slice(index + 1)) {
      expect(Math.hypot(position.x - other.x, position.y - other.y)).toBeGreaterThanOrEqual(
        ITEM_SIZE,
      );
    }
  }
});

test("a press on a window opens the window ring even when that window is in a group", () => {
  expect(getRing({ groupId: "g1", windowId: "w1" })).toBe(CONTEXT_MENU_RINGS.window);
  expect(getRing({ groupId: "g1", windowId: null })).toBe(CONTEXT_MENU_RINGS.group);
  expect(getRing({ groupId: null, windowId: null })).toBe(CONTEXT_MENU_RINGS.canvas);
});
