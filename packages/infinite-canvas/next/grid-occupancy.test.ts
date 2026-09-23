import { expect, test } from "vite-plus/test";
import { createCanvasState } from "./state";

test.each([
  { columns: 12 },
  { columns: 24 },
  { columns: 24, breakpoints: [{ minWidth: 640, columns: 12 }] },
])("a small square moves through consecutive visible cells with $columns columns and $breakpoints", (configuration) => {
  const canvas = createCanvasState({
    windowDefinitions: {
      icon: {
        size: { width: 80, height: 80 },
        minSize: { width: 1, height: 1 },
        maxSize: { width: 96, height: 96 },
        aspectRatio: 1,
      },
    },
    snapping: { enabled: false },
    viewport: { width: 1000, height: 800 },
  });
  canvas.actions.openWindow.run({
    id: "icon", kind: "icon", title: "Icon",
    rect: { x: 0, y: 0, width: 80, height: 80 },
  });
  canvas.actions.openWindow.run({
    id: "neighbour", kind: "icon", title: "Neighbour",
    rect: { x: 650, y: 0, width: 80, height: 80 },
  });
  canvas.actions.groupWindows.run({
    id: "board", windows: ["icon", "neighbour"],
    layout: { type: "grid", ...configuration, rowHeight: 25.17, gap: 12 },
    rect: { x: 0, y: 0, width: 880, height: 400 },
  });
  canvas.state.document.content.windows.icon.item.set({
    column: 0, row: 0, columnSpan: 1, rowSpan: 1,
  });
  canvas.state.document.content.windows.neighbour.item.set({
    column: 9, row: 0, columnSpan: 2, rowSpan: 2,
  });
  const start = canvas.computed.windowRect.icon.peek()!;
  const neighbour = canvas.computed.windowRect.neighbour.peek()!;
  const pitch = start.width + 12;
  const pointer = {
    pointerId: 1, point: { x: 500, y: 400 },
    altKey: false, ctrlKey: false, metaKey: false, shiftKey: false,
  };
  canvas.actions.pressMove.run({ window: "icon", pointer, threshold: 0 });
  const steps = [1, 2, 3, 4, 3, 2, 1, 0];
  const positions = steps.map((step) => {
    canvas.actions.updatePointer.run({
      ...pointer, point: { x: 500 + step * pitch, y: 400 },
    });
    const moved = canvas.computed.windowRect.icon.peek()!;
    expect(moved.y).toBeCloseTo(start.y);
    expect(moved.width).toBeCloseTo(start.width);
    expect(moved.height).toBeCloseTo(start.height);
    expect(canvas.computed.windowRect.neighbour.peek()).toEqual(neighbour);
    return Math.round((moved.x - start.x) / pitch);
  });
  const preview = canvas.computed.windowRect.icon.peek()!;
  canvas.actions.releasePointer.run({
    ...pointer, point: { x: 500, y: 400 },
  });
  expect(canvas.computed.windowRect.icon.peek()).toEqual(preview);
  expect(positions, "successive visible-cell positions").toEqual(steps);
});

test.each([false, true])("square fitting does not retain two-column occupancy with compact=%s", (compact) => {
  const canvas = createCanvasState({
    windowDefinitions: {
      icon: {
        size: { width: 80, height: 80 },
        minSize: { width: 1, height: 1 },
        maxSize: { width: 96, height: 96 },
        aspectRatio: 1,
      },
    },
    snapping: { enabled: false },
    viewport: { width: 1000, height: 800 },
  });
  for (const [index, id] of ["a", "b"].entries()) {
    canvas.actions.openWindow.run({
      id, kind: "icon", title: id,
      rect: { x: index * 150, y: 0, width: 80, height: 80 },
    });
  }
  canvas.actions.groupWindows.run({
    id: "board", windows: ["a", "b"],
    layout: {
      type: "grid", columns: 24, spanColumns: 24, rowHeight: 25.17, gap: 12, compact,
    },
    rect: { x: 0, y: 0, width: 880, height: 400 },
  });
  canvas.state.document.content.windows.a.item.set({
    column: 0, row: 0, columnSpan: 2, rowSpan: 1,
  });
  canvas.state.document.content.windows.b.item.set({
    column: 4, row: 0, columnSpan: 2, rowSpan: 1,
  });
  const a = canvas.computed.windowRect.a.peek()!;
  const b = canvas.computed.windowRect.b.peek()!;
  const pointer = {
    pointerId: 1, point: { x: 500, y: 400 },
    altKey: false, ctrlKey: false, metaKey: false, shiftKey: false,
  };
  expect(a.width).toBeCloseTo(25.166666666666668);
  expect(a.height).toBeCloseTo(a.width);
  canvas.actions.pressMove.run({ window: "b", pointer, threshold: 0 });
  const destination = {
    ...pointer,
    point: { x: 500 + a.x + a.width + 12 - b.x, y: 400 + a.y - b.y },
  };
  canvas.actions.updatePointer.run(destination);
  const preview = canvas.computed.windowRect.b.peek()!;
  expect(preview.x).toBeCloseTo(a.x + a.width + 12);
  expect(preview.y).toBeCloseTo(a.y);
  expect(canvas.computed.windowRect.a.peek()).toEqual(a);
  expect(canvas.computed.baseArrangement.board.changes.board.items.b.peek()).toMatchObject({
    column: 1, row: 0, columnSpan: 1,
  });
  canvas.actions.releasePointer.run(destination);
  expect(canvas.computed.windowRect.b.peek()).toEqual(preview);
  expect(canvas.computed.windowRect.a.peek()).toEqual(a);
  expect(canvas.state.document.content.windows.b.item.peek()).toMatchObject({
    column: 1, row: 0, columnSpan: 1, rowSpan: 1,
  });
});

test("resized square windows occupy adjacent single cells", () => {
  const canvas = createCanvasState({
    windowDefinitions: {
      icon: {
        size: { width: 80, height: 80 },
        minSize: { width: 1, height: 1 },
        maxSize: { width: 96, height: 96 },
        aspectRatio: 1,
      },
    },
    snapping: { enabled: false },
    viewport: { width: 1000, height: 800 },
  });
  for (const [index, id] of ["a", "b"].entries()) {
    canvas.actions.openWindow.run({
      id, kind: "icon", title: id,
      rect: { x: index * 100, y: 0, width: 80, height: 80 },
    });
  }
  canvas.actions.groupWindows.run({
    id: "board", windows: ["a", "b"],
    layout: { type: "grid", columns: 24, spanColumns: 24, rowHeight: "square", gap: 12 },
    rect: { x: 0, y: 0, width: 880, height: 400 },
  });
  for (const id of ["a", "b"]) {
    canvas.actions.resizeWindow.run({ window: id, width: 25.166666666666668, height: 25.166666666666668 });
    expect(canvas.state.document.content.windows[id].item.peek()).toMatchObject({
      columnSpan: 1, rowSpan: 1,
    });
  }
  const a = canvas.computed.windowRect.a.peek()!;
  const b = canvas.computed.windowRect.b.peek()!;
  const pointer = {
    pointerId: 1, point: { x: 500, y: 400 },
    altKey: false, ctrlKey: false, metaKey: false, shiftKey: false,
  };
  canvas.actions.pressMove.run({ window: "b", pointer, threshold: 0 });
  canvas.actions.updatePointer.run({
    ...pointer, point: { x: 500 + a.x + a.width + 12 - b.x, y: 400 + a.y - b.y },
  });
  canvas.actions.releasePointer.run(pointer);
  const placed = canvas.computed.windowRect.b.peek()!;
  expect(placed.x).toBeCloseTo(a.x + a.width + 12);
  expect(placed.y).toBeCloseTo(a.y);
  expect(placed.width).toBeCloseTo(a.width);
  expect(placed.height).toBeCloseTo(placed.width);
  expect(canvas.computed.windowRect.a.peek()).toEqual(a);
});
