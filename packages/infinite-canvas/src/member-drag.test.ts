import { expect, test } from "vite-plus/test";
import { createCanvasState } from "./state";
import { worldToScreen } from "@hyphened/math/cpu";

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
    columnSpan: 0.75,
  });
  expect(canvas.state.document.content.windows.b.item.peek()).toEqual({
    column: 1,
    row: 0,
    columnSpan: 0.75,
  });
  expect(canvas.computed.windowRect.a.peek()).toEqual({
    x: 0,
    y: 0,
    width: 143.75,
    height: 143.75,
  });
  expect(canvas.computed.windowRect.b.peek()).toEqual({
    x: 205,
    y: 0,
    width: 143.75,
    height: 143.75,
  });
  expect(canvas.computed.windowRect.board.peek()).toEqual({ x: 0, y: 0, width: 400, height: 400 });
});

test("a grid is resized freely down to its rows", () => {
  const canvas = createState();
  canvas.state.document.content.windows.board.layout.assign({
    breakpoints: [
      { minWidth: 300, columns: 2 },
      { minWidth: 0, columns: 1 },
    ],
  });
  canvas.actions.pressResize.run({ window: "board", pointer, handle: "south", threshold: 0 });
  canvas.actions.updatePointer.run({ ...pointer, point: { x: 600, y: 520 } });
  expect(canvas.computed.windowRect.board.height.peek()).toBe(500);
  canvas.actions.updatePointer.run({ ...pointer, point: { x: 600, y: 0 } });
  expect(canvas.computed.windowRect.board.height.peek()).toBe(143.75);
});

test("grid members use cell increments while free windows move continuously at each zoom", () => {
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
      const origin = {
        ...pointer,
        point: worldToScreen({
          point: { x: start.x + start.width / 2, y: start.y + start.height / 2 },
          camera: canvas.computed.camera.peek(),
          viewport: { width: 1000, height: 800 },
        }),
      };
      expect(
        canvas.actions.pressMove.run({ window, pointer: origin, threshold: 0 }),
      ).toBeUndefined();
      for (const x of [7, 23, 41]) {
        canvas.actions.updatePointer.run({
          ...pointer,
          point: { x: origin.point.x + x, y: origin.point.y + 11 },
        });
        expect(canvas.computed.windowRect[window].peek()).toEqual({
          ...start,
          x: start.x + (window === "a" ? Math.round(x / zoom / 51.25) * 51.25 : x / zoom),
          y: start.y + (window === "a" ? Math.round(11 / zoom / 51.25) * 51.25 : 11 / zoom),
        });
      }
      canvas.actions.cancelPointer.run({ pointerId: pointer.pointerId });
      expect(canvas.computed.windowRect[window].peek()).toEqual(start);
    }
  }
});

test("a grid member commits the displayed placement without a release jump", () => {
  const canvas = createState();
  expect(canvas.actions.pressMove.run({ window: "a", pointer, threshold: 0 })).toBeUndefined();
  const before = canvas.state.document.content.windows.a.item.peek();
  canvas.actions.updatePointer.run({ ...pointer, point: { x: 800, y: 420 } });
  expect(canvas.computed.windowRect.a.peek()?.x).toBe(205);
  expect(canvas.computed.arrangement.board.rects.a.x.peek()).toBe(205);
  expect(canvas.state.document.content.windows.a.item.peek()).toEqual(before);
  canvas.actions.renameWindow.run({ window: "b", title: "Saved during movement" });
  expect(canvas.actions.releasePointer.run({ pointerId: 1 })).toBeUndefined();
  expect(canvas.computed.windowRect.a.peek()?.x).toBe(205);
  expect(canvas.computed.windowRect.b.peek()?.y).toBe(153.75);
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
    width: 143.75,
    height: 143.75,
  });
  expect(canvas.state.document.content.windows.a.item.peek()).toBeUndefined();
  expect(canvas.state.document.content.windows.board.children.peek()).toEqual(["b"]);
  canvas.actions.undo.run({});
  expect(canvas.computed.windowParent.a.peek()).toBe("board");
});

test("a grid resize preserves its origin and commits its displayed spans", () => {
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
  expect(canvas.computed.windowRect.a.peek()).toEqual({
    x: 0,
    y: 0,
    width: 348.75,
    height: 246.25,
  });
  expect(canvas.computed.arrangement.board.rects.a.height.peek()).toBe(246.25);
  canvas.actions.releasePointer.run({ pointerId: 1 });
  expect(canvas.computed.windowRect.a.peek()).toEqual({
    x: 0,
    y: 0,
    width: 348.75,
    height: 246.25,
  });
  expect(canvas.state.document.content.windows.a.item.peek()).toEqual({
    column: 0,
    row: 0,
    columnSpan: 1.75,
    rowSpan: 5,
  });
  canvas.actions.undo.run({});
  expect(canvas.actions.resizeWindow.run({ window: "a", width: 400, height: 240 })).toBeUndefined();
  expect(canvas.computed.windowRect.a.peek()).toEqual({ x: 0, y: 0, width: 400, height: 246.25 });
});

test("a layout change cancels a member gesture that the new layout does not accept", () => {
  const canvas = createState();
  canvas.actions.pressMove.run({ window: "a", pointer, threshold: 0 });
  canvas.actions.updatePointer.run({ ...pointer, point: { x: 800, y: 420 } });
  canvas.actions.setWindowLayout.run({ window: "board", layout: { type: "tabs" } });
  expect(canvas.state.session.drag.peek()).toBeNull();
  expect(canvas.computed.capturedPointerId.peek()).toBeNull();
});
