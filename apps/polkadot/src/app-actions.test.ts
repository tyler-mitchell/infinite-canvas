import {
  createInfiniteCanvasState,
  createInfiniteCanvasWindow,
  type InfiniteCanvasCommand,
  type InfiniteCanvasCommands,
} from "@hyphened/infinite-canvas";
import { expect, test } from "vite-plus/test";

import { getAppAction } from "./app-actions";
import type { WindowKind } from "./canvas/window-registry";

/**
 * The vocabulary's parameterized half.
 *
 * Every other entry is callable with nothing, so "does it run" and "does it accept the right
 * shape" were the same question. `window.reveal` separates them, and the thing worth pinning is
 * that its published schema and its validation are the same declaration — a caller offered
 * `{ title: string }` and a verb that quietly accepted something else is the failure this shape
 * exists to prevent, and nothing about it shows in a typecheck.
 */

const state = createInfiniteCanvasState<WindowKind>({
  viewport: { height: 800, width: 1200 },
  windows: [
    createInfiniteCanvasWindow<WindowKind>({
      id: "note-1",
      kind: "note",
      rect: { height: 200, width: 320, x: 0, y: 0 },
      title: "Quarterly notes",
    }),
    createInfiniteCanvasWindow<WindowKind>({
      id: "note-2",
      kind: "note",
      rect: { height: 200, width: 320, x: 400, y: 0 },
      title: "Untitled",
    }),
  ],
});

const runReveal = (input: unknown) => {
  const commands: InfiniteCanvasCommand[] = [];
  const actions = {
    executeCommand: (command: InfiniteCanvasCommand) => {
      commands.push(command);
    },
  } as unknown as InfiniteCanvasCommands<WindowKind>;

  getAppAction("window.reveal")?.run({ actions, projectId: "project-1", state }, input);

  return commands;
};

test("a window is reached by the title a caller can actually see", () => {
  expect(runReveal({ title: "Quarterly notes" })).toStrictEqual([
    { type: "window.reveal", windowId: "note-1" },
  ]);
});

test("reveal, not focus, so a minimized or tabbed window is actually shown", () => {
  // Focusing alone leaves a window behind a tab exactly where it was. The command matters.
  expect(runReveal({ title: "Untitled" })[0]?.type).toBe("window.reveal");
});

test("a title no window answers to does nothing rather than reaching for the wrong one", () => {
  expect(runReveal({ title: "Nothing is called this" })).toStrictEqual([]);
});

test("input that does not match the published schema is refused", () => {
  // The point of one declaration serving both halves: these are exactly the shapes
  // `toJsonSchema()` tells a caller are unacceptable, and the verb has to agree.
  expect(runReveal({})).toStrictEqual([]);
  expect(runReveal({ title: 7 })).toStrictEqual([]);
  expect(runReveal(undefined)).toStrictEqual([]);
  expect(runReveal("Quarterly notes")).toStrictEqual([]);
});

test("the published schema is the one the verb validates against", () => {
  const schema = getAppAction("window.reveal")?.input?.toJsonSchema() as
    | Readonly<{ properties: Readonly<{ title: Readonly<{ type: string }> }>; required: string[] }>
    | undefined;

  expect(schema?.properties.title.type).toBe("string");
  expect(schema?.required).toStrictEqual(["title"]);
});

test("the verbs that take nothing publish no input, so they stay palette rows", () => {
  expect(getAppAction("note.create")?.input).toBeUndefined();
  expect(getAppAction("group.createFromSelection")?.input).toBeUndefined();
});
