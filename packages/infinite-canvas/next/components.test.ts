import { type } from "arktype";
import { expect, test, vi } from "vite-plus/test";
import { getComponentPlacement } from "./components";
import { createCanvasState, documentTransform } from "./state";

function createState() {
  return createCanvasState({
    viewport: { width: 1000, height: 800 },
    windowDefinitions: {
      card: {
        size: { width: 160, height: 100 },
        schema: type({ title: "string = 'Untitled'", count: "number = 0" }),
      },
    },
  });
}

test("component insertion persists decoded defaults and rejects invalid updates", () => {
  const canvas = createState();
  expect(canvas.actions.insertComponent.run({ kind: "card", id: "a" })).toBeUndefined();
  expect(canvas.state.document.content.windows.a.data.peek()).toEqual({
    title: "Untitled",
    count: 0,
  });
  expect(
    canvas.actions.setWindowData.run({ window: "a", data: { title: 42, count: 0 } }),
  ).toBeInstanceOf(type.errors);
  expect(canvas.state.document.content.windows.a.data.peek()).toEqual({
    title: "Untitled",
    count: 0,
  });
  expect(
    canvas.actions.openWindow.run({
      id: "bad",
      kind: "card",
      title: "Bad",
      target: { window: "missing" },
    }),
  ).toBeInstanceOf(type.errors);
  expect(canvas.state.document.content.windows.bad.peek()).toBeUndefined();
});

test("initial and restored documents decode window data and keep invalid data", () => {
  const rect = { x: 0, y: 0, width: 160, height: 100 };
  const content = {
    windows: {
      a: { kind: "card", title: "A", rect },
      b: { kind: "card", title: "B", rect, data: { title: 42 } },
      c: { kind: "unregistered", title: "C", rect, data: { kept: true } },
    },
  };
  const canvas = createCanvasState({
    windowDefinitions: {
      card: { schema: type({ title: "string = 'Untitled'", count: "number = 0" }) },
    },
    document: { content },
  });
  const data = () =>
    Object.values(canvas.state.document.content.windows.peek()).map((window) => window.data);
  expect(data()).toEqual([{ title: "Untitled", count: 0 }, { title: 42 }, { kept: true }]);
  canvas.state.document.content.windows.a.data.set({ title: "Edited", count: 3 });
  expect(canvas.actions.restoreDocument.run({ content })).toBeUndefined();
  expect(data()).toEqual([{ title: "Untitled", count: 0 }, { title: 42 }, { kept: true }]);
});

test("the persist transform decodes a valid document and keeps the current one otherwise", () => {
  const canvas = createState();
  canvas.actions.insertComponent.run({ kind: "card", id: "a" });
  const rect = { x: 0, y: 0, width: 160, height: 100 };
  const { load } = documentTransform(canvas);
  expect(
    load({ content: { windows: { b: { kind: "card", title: "B", rect } } } }).content.windows.b
      .data,
  ).toEqual({ title: "Untitled", count: 0 });
  const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
  expect(
    load({
      content: { windows: { b: { kind: "card", title: "B", rect: { ...rect, width: "wide" } } } },
    }),
  ).toBe(canvas.state.document.peek());
  expect(warn).toHaveBeenCalledTimes(1);
  warn.mockRestore();
});

test.each([{ type: "split" }, { type: "tabs" }, { type: "grid", columns: 3, rowHeight: 40 }])(
  "insertion into a selected $type container commits the geometry shown by the placement query",
  (layout) => {
    const canvas = createState();
    canvas.actions.insertComponent.run({ kind: "card", id: "a" });
    canvas.actions.insertComponent.run({ kind: "card", id: "b" });
    canvas.actions.groupWindows.run({ id: "container", windows: ["a", "b"], layout });
    const insertion = { kind: "card", id: "c" };
    const preview = getComponentPlacement({ canvas, insertion });
    expect(preview).not.toBeInstanceOf(Error);
    expect(preview).not.toBeInstanceOf(type.errors);
    if (preview instanceof Error || preview instanceof type.errors) return;
    expect(canvas.actions.insertComponent.run(insertion)).toBeUndefined();
    expect(canvas.computed.windowRect.c.peek()).toEqual(preview.rect);
    expect(canvas.computed.windowVisible.c.peek()).toBe(true);
    expect(canvas.computed.windowParent.c.peek()).toBe("container");
    canvas.actions.undo.run({});
    expect(canvas.state.document.content.windows.c.peek()).toBeUndefined();
    expect(canvas.computed.windowParent.a.peek()).toBe("container");
  },
);

test("drop cancellation preserves unrelated content and an outside drop inserts nothing", () => {
  const canvas = createState();
  canvas.actions.insertComponent.run({ kind: "card", id: "a" });
  const pointer = {
    pointerId: 1,
    point: { x: 500, y: 400 },
    altKey: false,
    ctrlKey: false,
    metaKey: false,
    shiftKey: false,
  };
  canvas.actions.beginDrop.run({
    insertion: { kind: "card", id: "b" },
    point: { x: 20, y: 20 },
    pointerId: 1,
  });
  canvas.actions.updatePointer.run(pointer);
  expect(canvas.computed.dropPlacement.peek()?.error).toBeNull();
  canvas.actions.setWindowData.run({ window: "a", data: { title: "Saved during drop", count: 1 } });
  canvas.actions.cancelPointer.run({ pointerId: 1 });
  expect(canvas.state.document.content.windows.b.peek()).toBeUndefined();
  expect(canvas.state.document.content.windows.a.data.peek()).toEqual({
    title: "Saved during drop",
    count: 1,
  });
  canvas.actions.beginDrop.run({
    insertion: { kind: "card", id: "b" },
    point: { x: 20, y: 20 },
    pointerId: 1,
  });
  canvas.actions.updatePointer.run({ ...pointer, point: { x: -10, y: -10 } });
  canvas.actions.releasePointer.run({ pointerId: 1 });
  expect(canvas.state.document.content.windows.b.peek()).toBeUndefined();
  expect(canvas.state.session.drop.peek()).toBeNull();
});

test("measured grid content reflows without document edits", () => {
  const canvas = createState();
  canvas.actions.insertComponent.run({ kind: "card", id: "a" });
  canvas.actions.insertComponent.run({ kind: "card", id: "b" });
  canvas.actions.groupWindows.run({
    id: "board",
    windows: ["a", "b"],
    layout: { type: "grid", columns: 2, rowHeight: 40, gap: 10 },
    rect: { x: 0, y: 0, width: 400, height: 240 },
  });
  canvas.actions.setWindowItem.run({ window: "b", item: { column: 0, row: 3 } });
  const history = canvas.history.undos$.peek();
  expect(canvas.computed.windowRect.a.peek()?.width).toBe(195);
  expect(canvas.computed.windowRect.b.peek()?.y).toBe(150);
  canvas.actions.setContentSize.run({ windowId: "a", size: { width: 195, height: 165 } });
  expect(canvas.computed.windowRect.a.peek()?.height).toBe(190);
  expect(canvas.computed.windowRect.b.peek()?.y).toBe(200);
  expect(canvas.history.undos$.peek()).toBe(history);
  canvas.actions.setContentSize.run({ windowId: "a", size: { width: 194, height: 165 } });
  expect(canvas.computed.windowRect.a.peek()?.height).toBe(140);
});
