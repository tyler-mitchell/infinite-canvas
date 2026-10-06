import { DEFAULT_INFINITE_CANVAS_COMMAND_DESCRIPTORS } from "@hyphened/infinite-canvas/legacy";
import { expect, test } from "vite-plus/test";

import { APP_ACTIONS } from "./app-actions";

const FRAMEWORK_DESCRIPTIONS = new Map<string, string>(
  DEFAULT_INFINITE_CANVAS_COMMAND_DESCRIPTORS.map((descriptor) => [
    descriptor.id,
    descriptor.description,
  ]),
);

const COLLIDING_IDS = new Set(["group.dissolve"]);

const findAction = (id: string) => APP_ACTIONS.find((action) => action.id === id);

const wrappedActions = APP_ACTIONS.filter(
  (action) => FRAMEWORK_DESCRIPTIONS.has(action.id) && !COLLIDING_IDS.has(action.id),
);

test("this app re-declares the framework verbs that take an argument", () => {
  expect(wrappedActions.map((action) => action.id).sort()).toEqual([
    "window.reveal",
    "workspace.close",
    "workspace.create",
    "workspace.enter",
    "workspace.moveActiveWindow",
  ]);
});

test("a re-declared verb opens with the framework's own sentence", () => {
  for (const action of wrappedActions) {
    const framework = FRAMEWORK_DESCRIPTIONS.get(action.id) ?? "";

    expect(framework).not.toBe("");
    expect(action.description.startsWith(framework)).toBe(true);
  }
});

test("what a re-declared verb adds is about its argument, not about the verb", () => {
  for (const action of wrappedActions) {
    const added = action.description.slice((FRAMEWORK_DESCRIPTIONS.get(action.id) ?? "").length);

    expect(added.startsWith(" ")).toBe(true);
    expect(added.trim().length).toBeGreaterThan(0);
  }
});

test("a verb that only shares an id with a framework command keeps its own sentence", () => {
  const dissolve = findAction("group.dissolve");

  expect(dissolve).toBeDefined();
  expect(FRAMEWORK_DESCRIPTIONS.has("group.dissolve")).toBe(true);
  expect(dissolve?.description.startsWith(FRAMEWORK_DESCRIPTIONS.get("group.dissolve") ?? "")).toBe(
    false,
  );
  expect(dissolve?.input).toBeDefined();
});
