import { DEFAULT_INFINITE_CANVAS_COMMAND_DESCRIPTORS } from "@hyphened/infinite-canvas";
import { expect, test } from "vite-plus/test";

import { APP_ACTIONS } from "../app-actions";
import { CONTEXT_MENU_RINGS, getRing } from "./context-menu-rings";

/**
 * The wheel's spokes name verbs in two vocabularies, and a name that stops resolving fails quietly.
 *
 * A spoke whose id no longer exists still draws, still animates into place, and labels itself with
 * the raw id — there is no crash and no warning. These tests are the noise that failure never makes
 * on its own.
 */

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

/**
 * The regression this file exists for.
 *
 * The ring used to build `{ type: id }` and cast it to a command. That works for most verbs and
 * throws for the ones whose id encodes an argument — `group.setLayout.split` is the id of
 * `{ type: "group.setLayout", layout: "split" }` — so three spokes threw on click while the rest
 * looked fine, and the cast silenced the type error that said so.
 *
 * Asserting that such a verb is *on* a ring keeps the trap live. If it ever stops being true, the
 * shortcut becomes safe and someone will take it; this test failing is the prompt to check whether
 * it is still a shortcut before allowing it.
 */
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

test("a ring offers six verbs, because the wheel is six fixed positions", () => {
  expect(RING_NAMES.map((name) => CONTEXT_MENU_RINGS[name].length)).toStrictEqual([6, 6, 6]);
});

test("a press on a window opens the window ring even when that window is in a group", () => {
  expect(getRing({ groupId: "g1", windowId: "w1" })).toBe(CONTEXT_MENU_RINGS.window);
  expect(getRing({ groupId: "g1", windowId: null })).toBe(CONTEXT_MENU_RINGS.group);
  expect(getRing({ groupId: null, windowId: null })).toBe(CONTEXT_MENU_RINGS.canvas);
});
