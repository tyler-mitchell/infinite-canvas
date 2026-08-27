import {
  createInfiniteCanvasState,
  createInfiniteCanvasWindow,
  DEFAULT_INFINITE_CANVAS_COMMAND_DESCRIPTORS,
} from "@hyphened/infinite-canvas";
import { expect, test } from "vite-plus/test";

import { APP_ACTIONS } from "./app-actions";
import type { WindowKind } from "./canvas/window-registry";
import { getPublishedCanvasCommands } from "./published-commands";

/**
 * What a caller that cannot see the screen is allowed to do with the canvas itself.
 *
 * This app published its own verbs and stopped, so fitting the view, undoing, clearing a selection
 * and moving between desktops were reachable by a keystroke and by nothing else. The list is now
 * the framework's own, which means the thing worth guarding is not its contents — those are not
 * this app's to choose — but the two exclusions, because each one silently offering a broken tool
 * is exactly the failure the exclusion exists to prevent.
 */

const state = createInfiniteCanvasState<WindowKind>({
  viewport: { height: 800, width: 1200 },
  windows: [
    createInfiniteCanvasWindow<WindowKind>({
      id: "note-1",
      kind: "note",
      rect: { height: 200, width: 320, x: 0, y: 0 },
      title: "Sources",
    }),
  ],
});

test("the canvas's own verbs are published, not just this app's", () => {
  const published = getPublishedCanvasCommands(state);

  // The specific ids matter less than the fact that the canvas vocabulary is offered at all: a
  // caller could previously make a note and not fit the view.
  expect(published.length).toBeGreaterThan(50);
  expect(published.map((command) => command.id)).toContain("view.fitAll");
  expect(published.map((command) => command.id)).toContain("history.undo");
});

test("a verb whose command is a template is held back", () => {
  /*
   * `{ type: "workspace.enter", workspaceId: "" }` published as it stands would act on a workspace
   * called "". These need an `AppAction` with an `input`, the way `window.reveal` already has one.
   */
  const published = getPublishedCanvasCommands(state).map((command) => command.id);

  for (const id of [
    "workspace.create",
    "workspace.enter",
    "workspace.close",
    "workspace.moveActiveWindow",
  ]) {
    expect(published).not.toContain(id);
  }
});

test("the held-back list is derived, not written down", () => {
  // If the framework fills in one of those templates, or adds another, this follows without an
  // edit here. The check is that every excluded descriptor is excluded *for a stated reason*.
  const publishedIds = new Set(getPublishedCanvasCommands(state).map((command) => command.id));
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
  // `window.reveal` is both a framework command taking a window id and an app verb that resolves
  // one against live state. Publishing both would put two different tools under one name.
  expect(APP_ACTIONS.some((action) => action.id === "window.reveal")).toBe(true);
  expect(getPublishedCanvasCommands(state).map((command) => command.id)).not.toContain(
    "window.reveal",
  );
});

test("no published canvas verb shares a name with an app verb", () => {
  const appIds = new Set(APP_ACTIONS.map((action) => action.id));
  const collisions = getPublishedCanvasCommands(state)
    .map((command) => command.id)
    .filter((id) => appIds.has(id));

  expect(collisions).toStrictEqual([]);
});
