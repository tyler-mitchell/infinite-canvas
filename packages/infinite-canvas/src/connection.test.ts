import { expect, test } from "vite-plus/test";

import { createInfiniteCanvasState } from "./factory";
import { parseInfiniteCanvasStateJson, stringifyInfiniteCanvasState } from "./persistence";
import { reduceInfiniteCanvasState } from "./reducer";
import type { InfiniteCanvasConnection, InfiniteCanvasState } from "./types";

type Kind = "demo";

const window = (id: string) => ({
  id,
  isPinned: false,
  kind: "demo" as const,
  minSize: { height: 120, width: 160 },
  mode: "normal" as const,
  rect: { height: 240, width: 320, x: 0, y: 0 },
  title: id,
  zIndex: 0,
});

const edge: InfiniteCanvasConnection = {
  from: "alpha",
  id: "edge-1",
  kind: "relates",
  to: "bravo",
};

const baseState = (): InfiniteCanvasState<Kind> =>
  createInfiniteCanvasState<Kind>({
    viewport: { height: 600, width: 800 },
    windows: [window("alpha"), window("bravo")],
  });

const open = (state: InfiniteCanvasState<Kind>, connection = edge) =>
  reduceInfiniteCanvasState(state, { connection, type: "connection.open" });

test("a canvas starts with no connections", () => {
  expect(baseState().connections).toStrictEqual([]);
});

test("opening adds one edge and a second open of the same id changes nothing", () => {
  const opened = open(baseState());

  expect(opened.connections).toStrictEqual([edge]);

  // The same state object, so the reducer records no history checkpoint for a no-op.
  const again = open(opened, { ...edge, kind: "supersedes" });

  expect(again.connections).toStrictEqual([edge]);
  expect(again.connections).toBe(opened.connections);
});

test("closing removes the edge, and an unknown id leaves the list untouched", () => {
  const opened = open(baseState());
  const closed = reduceInfiniteCanvasState(opened, {
    connectionId: "edge-1",
    type: "connection.close",
  });

  expect(closed.connections).toStrictEqual([]);

  const missing = reduceInfiniteCanvasState(closed, {
    connectionId: "edge-1",
    type: "connection.close",
  });

  expect(missing.connections).toBe(closed.connections);
});

test("updating merges a patch and cannot move the record to another id", () => {
  const updated = reduceInfiniteCanvasState(open(baseState()), {
    connectionId: "edge-1",
    patch: { id: "hijacked", kind: "supersedes" },
    type: "connection.update",
  });

  expect(updated.connections).toStrictEqual([{ ...edge, kind: "supersedes" }]);
});

test("closing a window drops the edges that touch it", () => {
  const opened = open(baseState());
  const closed = reduceInfiniteCanvasState(opened, {
    type: "window.close",
    windowId: "bravo",
  });

  expect(closed.connections).toStrictEqual([]);
});

test("undo restores a connection that closing a window removed", () => {
  const opened = open(baseState());
  const closed = reduceInfiniteCanvasState(opened, {
    type: "window.close",
    windowId: "bravo",
  });
  const undone = reduceInfiniteCanvasState(closed, {
    command: { type: "history.undo" },
    type: "command.execute",
  });

  expect(undone.connections).toStrictEqual([edge]);
  expect(undone.windows.map((entry) => entry.id)).toContain("bravo");
});

test("a connection survives a serialize and hydrate round trip", () => {
  const hydrated = parseInfiniteCanvasStateJson<Kind>(
    stringifyInfiniteCanvasState(open(baseState())),
    baseState(),
  );

  expect(hydrated?.connections).toStrictEqual([edge]);
});

test("a document written before connections existed hydrates with an empty list", () => {
  const legacy = JSON.stringify({
    activeWindowId: null,
    camera: { center: { x: 0, y: 0 }, zoom: 1 },
    version: 3,
    windows: [window("alpha")],
  });

  expect(parseInfiniteCanvasStateJson<Kind>(legacy, baseState())?.connections).toStrictEqual([]);
});
