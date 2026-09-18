import { expect, test } from "vite-plus/test";
import { createCanvasState } from "./state";

function createState() {
  const canvas = createCanvasState({
    windowDefinitions: { card: { size: { width: 160, height: 100 } } },
    snapping: { enabled: false },
    viewport: { width: 1000, height: 800 },
  });
  canvas.actions.openWindow.run({
    id: "a",
    kind: "card",
    title: "A",
    rect: { x: 0, y: 0, width: 160, height: 100 },
  });
  canvas.actions.openWindow.run({
    id: "b",
    kind: "card",
    title: "B",
    rect: { x: 220, y: 0, width: 160, height: 100 },
  });
  canvas.actions.groupWindows.run({
    id: "board",
    windows: ["a", "b"],
    layout: { type: "grid", columns: 2, rowHeight: 40, gap: 10 },
    rect: { x: 0, y: 0, width: 400, height: 400 },
  });
  return canvas;
}

const pointer = {
  pointerId: 1,
  point: { x: 600, y: 420 },
  altKey: false,
  ctrlKey: false,
  metaKey: false,
  shiftKey: false,
};

test("grouping places each window in the grid cell under it", () => {
  const canvas = createState();
  expect(canvas.state.document.content.windows.board.children.peek()).toEqual(["a", "b"]);
  expect(canvas.state.document.content.windows.a.item.peek()).toEqual({
    column: 0,
    row: 0,
    columnSpan: 1,
  });
  expect(canvas.state.document.content.windows.b.item.peek()).toEqual({
    column: 1,
    row: 0,
    columnSpan: 1,
  });
  expect(canvas.computed.windowRect.a.peek()).toEqual({ x: 0, y: 0, width: 195, height: 140 });
  expect(canvas.computed.windowRect.b.peek()).toEqual({ x: 205, y: 0, width: 195, height: 140 });
  expect(canvas.computed.windowRect.board.peek()).toEqual({ x: 0, y: 0, width: 400, height: 140 });
});

test("docked and free windows use the same continuous movement at each zoom", () => {
  for (const zoom of [0.5, 1, 2]) {
    const canvas = createState();
    canvas.state.document.canvasView.camera.zoom.set(zoom);
    canvas.actions.openWindow.run({
      id: "free",
      kind: "card",
      title: "Free",
      rect: { x: 0, y: 500, width: 160, height: 100 },
    });
    for (const window of ["a", "free"]) {
      const start = canvas.computed.windowRect[window].peek()!;
      expect(canvas.actions.pressMove.run({ window, pointer, threshold: 0 })).toBeUndefined();
      for (const x of [7, 23, 41]) {
        canvas.actions.updatePointer.run({
          ...pointer,
          point: { x: pointer.point.x + x, y: pointer.point.y + 11 },
        });
        expect(canvas.computed.windowRect[window].peek()).toEqual({
          ...start,
          x: start.x + x / zoom,
          y: start.y + 11 / zoom,
        });
      }
      canvas.actions.cancelPointer.run({ pointerId: pointer.pointerId });
      expect(canvas.computed.windowRect[window].peek()).toEqual(start);
    }
  }
});

test("a grid member follows the pointer and commits to the grid", () => {
  const canvas = createState();
  expect(canvas.actions.pressMove.run({ window: "a", pointer, threshold: 0 })).toBeUndefined();
  const before = canvas.state.document.content.windows.a.item.peek();
  canvas.actions.updatePointer.run({ ...pointer, point: { x: 800, y: 420 } });
  expect(canvas.computed.windowRect.a.peek()?.x).toBe(200);
  expect(canvas.computed.arrangement.board.rects.a.x.peek()).toBe(205);
  expect(canvas.state.document.content.windows.a.item.peek()).toEqual(before);
  canvas.actions.renameWindow.run({ window: "b", title: "Saved during movement" });
  expect(canvas.actions.releasePointer.run({ pointerId: 1 })).toBeUndefined();
  expect(canvas.computed.windowRect.a.peek()?.x).toBe(205);
  expect(canvas.computed.windowRect.b.peek()?.y).toBe(150);
  canvas.actions.undo.run({});
  expect(canvas.computed.windowRect.a.peek()?.x).toBe(0);
  expect(canvas.state.document.content.windows.b.title.peek()).toBe("Saved during movement");
});

test("tear-out remains a preview until commit and cancellation restores membership", () => {
  const canvas = createState();
  canvas.actions.pressMove.run({ window: "a", pointer, threshold: 0 });
  canvas.actions.updatePointer.run({ ...pointer, point: { x: 480, y: 420 } });
  expect(canvas.computed.windowVisible.a.peek()).toBe(true);
  expect(canvas.computed.windowRect.a.peek()?.x).toBe(-120);
  expect(canvas.computed.arrangement.board.rects.a.peek()).toBeUndefined();
  expect(canvas.computed.windowParent.a.peek()).toBe("board");
  canvas.actions.cancelPointer.run({ pointerId: 1 });
  expect(canvas.computed.windowRect.a.peek()?.x).toBe(0);
  expect(canvas.computed.windowParent.a.peek()).toBe("board");
  canvas.actions.pressMove.run({ window: "a", pointer, threshold: 0 });
  canvas.actions.updatePointer.run({ ...pointer, point: { x: 480, y: 420 } });
  canvas.actions.updatePointer.run({ ...pointer, point: { x: 600, y: 900 } });
  canvas.actions.releasePointer.run({ pointerId: 1 });
  expect(canvas.computed.windowParent.a.peek()).toBeUndefined();
  expect(canvas.state.document.content.windows.a.rect.peek()).toEqual({
    x: 0,
    y: 480,
    width: 195,
    height: 140,
  });
  expect(canvas.state.document.content.windows.a.item.peek()).toBeUndefined();
  expect(canvas.state.document.content.windows.board.children.peek()).toEqual(["b"]);
  canvas.actions.undo.run({});
  expect(canvas.computed.windowParent.a.peek()).toBe("board");
});

test("a grid resize follows the pointer before it commits its spans", () => {
  const canvas = createState();
  const resizePointer = { ...pointer, point: { x: 695, y: 490 } };
  expect(
    canvas.actions.pressResize.run({
      window: "a",
      pointer: resizePointer,
      handle: "south-east",
      threshold: 0,
    }),
  ).toBeUndefined();
  canvas.actions.updatePointer.run({ ...pointer, point: { x: 900, y: 580 } });
  expect(canvas.computed.windowRect.a.peek()).toEqual({ x: 0, y: 0, width: 400, height: 230 });
  expect(canvas.computed.arrangement.board.rects.a.height.peek()).toBe(240);
  canvas.actions.releasePointer.run({ pointerId: 1 });
  expect(canvas.computed.windowRect.a.peek()).toEqual({ x: 0, y: 0, width: 400, height: 240 });
  expect(canvas.state.document.content.windows.a.item.peek()).toEqual({
    column: 0,
    row: 0,
    columnSpan: 2,
    rowSpan: 5,
  });
  canvas.actions.undo.run({});
  expect(canvas.actions.resizeWindow.run({ window: "a", width: 400, height: 240 })).toBeUndefined();
  expect(canvas.computed.windowRect.a.peek()).toEqual({ x: 0, y: 0, width: 400, height: 240 });
});

test("a layout change cancels a member gesture that the new layout does not accept", () => {
  const canvas = createState();
  canvas.actions.pressMove.run({ window: "a", pointer, threshold: 0 });
  canvas.actions.updatePointer.run({ ...pointer, point: { x: 800, y: 420 } });
  canvas.actions.setWindowLayout.run({ window: "board", layout: { type: "tabs" } });
  expect(canvas.state.session.drag.peek()).toBeNull();
  expect(canvas.computed.capturedPointerId.peek()).toBeNull();
});
