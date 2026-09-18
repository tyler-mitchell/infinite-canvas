import { type } from "arktype";
import { expect, test } from "vite-plus/test";
import { canvasSnapshot } from "./state.schema";
import { createCanvasState } from "./state";

test("document decoding rejects cycles before layout traversal", () => {
  const canvas = createCanvasState({ windowDefinitions: {} });
  const snapshot = canvas.state.document.peek();
  expect(canvasSnapshot(snapshot)).not.toBeInstanceOf(type.errors);
  const rect = { x: 0, y: 0, width: 100, height: 100 };
  const container = (children: string[]) => ({ rect, layout: { type: "split" }, children });
  const decode = (windows: Record<string, unknown>) =>
    canvasSnapshot({ ...snapshot, content: { ...snapshot.content, windows } });
  expect(
    decode({ a: container(["b"]), b: container(["c"]), c: { kind: "note", title: "C", rect } }),
  ).not.toBeInstanceOf(type.errors);
  expect(decode({ loop: container(["loop"]) })).toBeInstanceOf(type.errors);
  expect(decode({ a: container(["b"]), b: container(["a"]) })).toBeInstanceOf(type.errors);
  expect(
    decode({ a: container(["c"]), b: container(["c"]), c: { kind: "note", title: "C", rect } }),
  ).toBeInstanceOf(type.errors);
  expect(decode({ a: container(["missing"]) })).toBeInstanceOf(type.errors);
});

test("entity records take their ID from the key and default their state", () => {
  const canvas = createCanvasState({
    windowDefinitions: { note: {} },
    document: {
      content: {
        windows: { a: { kind: "note", title: "A", rect: { x: 0, y: 0, width: 100, height: 80 } } },
        workspaces: { research: { title: "Research", windowIds: ["a"] } },
      },
    },
  });
  expect(canvas.state.document.content.windows.a.peek()).toEqual({
    id: "a",
    kind: "note",
    title: "A",
    mode: "normal",
    isPinned: false,
    heightMode: "content",
    rect: { x: 0, y: 0, width: 100, height: 80 },
  });
  expect(canvas.state.document.content.workspaces.research.id.peek()).toBe("research");
  expect(
    canvasSnapshot({
      content: {
        windows: {
          a: { id: "b", kind: "note", title: "A", rect: { x: 0, y: 0, width: 100, height: 80 } },
        },
      },
    }),
  ).toBeInstanceOf(type.errors);
});

test("document restoration preserves viewport input and is undoable", () => {
  const canvas = createCanvasState({
    windowDefinitions: {},
    viewport: { width: 900, height: 600 },
  });
  canvas.actions.createWorkspace.run({ id: "research", title: "Research" });
  const restored = {
    ...canvas.state.document.peek(),
    content: { windows: {}, connections: {}, workspaces: {}, workspaceOrder: [] },
    activeWorkspaceId: null,
    workspaceViews: {},
  };
  expect(canvas.actions.restoreDocument.run(restored)).toBeUndefined();
  expect(canvas.state.document.content.workspaces.peek()).toEqual({});
  expect(canvas.state.input.viewport.peek()).toEqual({ width: 900, height: 600 });
  canvas.actions.undo.run({});
  expect(canvas.state.document.content.workspaces.research.title.peek()).toBe("Research");
});
