import { expect, test } from "vite-plus/test";
import { alignRect } from "./alignment";
import { createCanvasState } from "./state";

test("alignment chooses the closest edge and exposes its guide", () => {
  const result = alignRect({
    rect: { x: 0, y: 0, width: 100, height: 80 },
    delta: { x: 196, y: 20 },
    targets: [{ x: 300, y: 200, width: 100, height: 80 }],
    threshold: 6,
    edges: true,
    centers: true,
  });
  expect(result.delta).toEqual({ x: 200, y: 20 });
  expect(result.guides).toEqual([{ axis: "x", position: 300, start: 20, end: 280 }]);
});

test("alignment snaps a top or bottom edge and exposes a horizontal guide", () => {
  const target = { x: 300, y: 200, width: 100, height: 80 };
  const top = alignRect({
    rect: { x: 0, y: 0, width: 100, height: 80 },
    delta: { x: 150, y: 196 },
    targets: [target],
    threshold: 6,
    edges: true,
    centers: false,
  });
  expect(top.delta).toEqual({ x: 150, y: 200 });
  expect(top.guides.map((guide) => [guide.axis, guide.position])).toEqual([["y", 200]]);
  const bottom = alignRect({
    rect: { x: 0, y: 0, width: 100, height: 40 },
    delta: { x: 150, y: 243 },
    targets: [target],
    threshold: 6,
    edges: true,
    centers: false,
  });
  expect(bottom.delta.y).toBe(240);
  expect(bottom.guides.map((guide) => [guide.axis, guide.position])).toEqual([["y", 280]]);
});

test("alignment can disable centers and rejects targets beyond its threshold", () => {
  const input = {
    rect: { x: 0, y: 0, width: 40, height: 40 },
    delta: { x: 80, y: 80 },
    targets: [{ x: 100, y: 100, width: 100, height: 100 }],
    threshold: 6,
    edges: true,
    centers: false,
  };
  expect(alignRect(input)).toEqual({ delta: input.delta, guides: [] });
  expect(alignRect({ ...input, centers: true }).delta).toEqual(input.delta);
});

test("snapping uses screen distance and commits the visible position", () => {
  for (const zoom of [0.5, 1, 2]) {
    const canvas = createCanvasState({
      windowDefinitions: { card: { size: { width: 100, height: 80 } } },
      viewport: { width: 1000, height: 800 },
      document: { canvasView: { camera: { center: { x: 0, y: 0 }, zoom } } },
    });
    for (const [id, x] of [
      ["a", 0],
      ["b", 300],
    ] as const) {
      canvas.actions.openWindow.run({
        id,
        kind: "card",
        title: id,
        rect: { x, y: 0, width: 100, height: 80 },
      });
    }
    const pointer = {
      pointerId: 1,
      point: { x: 500, y: 400 },
      altKey: false,
      ctrlKey: false,
      metaKey: false,
      shiftKey: false,
    };
    canvas.actions.pressMove.run({ window: "a", pointer, threshold: 0 });
    canvas.actions.updatePointer.run({ ...pointer, point: { x: 500 + 200 * zoom - 4, y: 400 } });
    expect(canvas.computed.windowRect.a.x.peek()).toBe(200);
    expect(
      canvas.computed.alignmentGuides
        .peek()
        .some((guide) => guide.axis === "x" && guide.position === 300),
    ).toBe(true);
    canvas.actions.releasePointer.run({ pointerId: 1 });
    expect(canvas.state.document.content.windows.a.rect.x.peek()).toBe(200);
    expect(canvas.computed.alignmentGuides.peek()).toEqual([]);
    canvas.actions.undo.run({});
    expect(canvas.state.document.content.windows.a.rect.x.peek()).toBe(0);
  }
});
