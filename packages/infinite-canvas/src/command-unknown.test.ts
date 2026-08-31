import { expect, test } from "vite-plus/test";

import { executeInfiniteCanvasCommand } from "./commands";
import { createInfiniteCanvasState, createInfiniteCanvasWindow } from "./factory";
import { reduceInfiniteCanvasState } from "./reducer";
import type { InfiniteCanvasCommand, InfiniteCanvasState } from "./types";

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
  const after = executeInfiniteCanvasCommand(
    { ...state(), activeWindowId: "only" },
    { type: "window.reveal", windowId: "only" },
  );

  expect(after.activeWindowId).toBe("only");
});
