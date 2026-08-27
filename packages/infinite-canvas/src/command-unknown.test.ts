import { expect, test } from "vite-plus/test";

import { executeInfiniteCanvasCommand } from "./commands";
import { createInfiniteCanvasState, createInfiniteCanvasWindow } from "./factory";
import { reduceInfiniteCanvasState } from "./reducer";
import type { InfiniteCanvasCommand, InfiniteCanvasState } from "./types";

/**
 * A command name that no longer exists says so.
 *
 * Type exhaustiveness is a compile-time promise and commands are invoked *by id* at runtime — from
 * a palette, a hotkey table, a console, and per this repo's WebMCP requirement from an agent handed
 * a list of names. Any of those can supply a name that has been renamed or removed.
 *
 * Before the guard, an unrecognised command fell out of the switch and returned `undefined`; the
 * reducer then read `.groups` off it, so the message was "Cannot read properties of undefined
 * (reading 'groups')" — a field with nothing to do with the mistake, three layers below it.
 */

const state = (): InfiniteCanvasState<"demo"> =>
  createInfiniteCanvasState<"demo">({
    viewport: { height: 800, width: 1200 },
    windows: [
      createInfiniteCanvasWindow({
        id: "only",
        kind: "demo",
        rect: { height: 200, width: 300, x: 0, y: 0 },
        title: "Only",
      }),
    ],
  });

const unknown = { direction: "out", type: "view.zoom" } as unknown as InfiniteCanvasCommand;

test("an unknown command names itself rather than failing three layers down", () => {
  // `view.zoom` is the real mistake that found this: a plausible id nobody registered.
  expect(() => executeInfiniteCanvasCommand(state(), unknown)).toThrow(/view\.zoom/);
});

test("the message says it was the command, not a missing property", () => {
  expect(() => executeInfiniteCanvasCommand(state(), unknown)).toThrow(/[Uu]nknown.*command/);
  expect(() => executeInfiniteCanvasCommand(state(), unknown)).not.toThrow(/groups/);
});

test("it surfaces the same way through the reducer, which is how a consumer reaches it", () => {
  expect(() =>
    reduceInfiniteCanvasState(state(), { command: unknown, type: "command.execute" }),
  ).toThrow(/view\.zoom/);
});

test("a real command still runs", () => {
  // The guard must be unreachable for everything the union actually contains.
  //
  // This control was first written with `{ type: "window.minimize" }`, which is a descriptor *id*
  // and not a command type, and the guard caught it on its first run — naming the exact string. It
  // is kept as a control rather than deleted because that is the whole case for the guard: the
  // mistake it exists to report is the one it made visible in its own test.
  const after = executeInfiniteCanvasCommand(
    { ...state(), activeWindowId: "only" },
    { type: "window.reveal", windowId: "only" },
  );

  expect(after.activeWindowId).toBe("only");
});
