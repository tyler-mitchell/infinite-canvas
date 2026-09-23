import { expect, test } from "vite-plus/test";
import { act } from "react";
import { createRoot } from "react-dom/client";
import { createCanvasState } from "../state";
import { CanvasViewport } from "./viewport";

Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true });

test("a rendered small square reaches the adjacent visible cell", async ({ onTestFinished }) => {
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
    document: {
      content: {
        windows: {
          board: {
            rect: { x: 0, y: 0, width: 880, height: 400 },
            layout: { type: "grid", columns: 12, rowHeight: 25.17, gap: 12 },
            children: ["small", "large"],
          },
          small: {
            kind: "icon",
            title: "Small",
            rect: { x: 0, y: 0, width: 80, height: 80 },
            item: { column: 0, row: 0, columnSpan: 1, rowSpan: 1 },
          },
          large: {
            kind: "icon",
            title: "Large",
            rect: { x: 650, y: 0, width: 80, height: 80 },
            item: { column: 9, row: 0, columnSpan: 2, rowSpan: 2 },
          },
        },
      },
    },
  });
  const host = document.createElement("div");
  host.style.cssText = "position:fixed;left:0;top:0;width:1000px;height:800px";
  document.body.append(host);
  const root = createRoot(host);
  onTestFinished(async () => {
    await act(async () => root.unmount());
    host.remove();
  });
  await act(async () => {
    root.render(<CanvasViewport canvas={canvas} renderWindow={(window) => window.title.get()} />);
  });
  const small = host.querySelector<HTMLElement>('[data-window-id="small"]')!;
  const large = host.querySelector<HTMLElement>('[data-window-id="large"]')!;
  const start = small.getBoundingClientRect();
  const startWorld = canvas.computed.windowRect.small.peek()!;
  const neighbour = large.getBoundingClientRect();
  expect(start.width).toBeCloseTo(25.17, 1);
  expect(start.height).toBeCloseTo(start.width, 1);
  const pitch = start.width + 12;
  const pointer = {
    pointerId: 1,
    point: { x: 500, y: 400 },
    altKey: false,
    ctrlKey: false,
    metaKey: false,
    shiftKey: false,
  };
  await act(async () => {
    canvas.actions.pressMove.run({ window: "small", pointer, threshold: 0 });
  });
  const positions: number[] = [];
  for (const step of [1, 2, 3, 4]) {
    await act(async () => {
      canvas.actions.updatePointer.run({
        ...pointer,
        point: { x: 500 + step * pitch, y: 400 },
      });
    });
    const offset = canvas.computed.windowRect.small.peek()!.x - startWorld.x;
    await expect.poll(() => small.getBoundingClientRect().x - start.x).toBeCloseTo(offset, 1);
    positions.push(Math.round((small.getBoundingClientRect().x - start.x) / pitch));
    expect(large.getBoundingClientRect().x).toBeCloseTo(neighbour.x, 1);
  }
  await act(async () => {
    canvas.actions.releasePointer.run({
      ...pointer,
      point: { x: 500 + 4 * pitch, y: 400 },
    });
  });
  expect(positions, "rendered positions in small-icon units").toEqual([1, 2, 3, 4]);
  await expect.poll(() => small.getBoundingClientRect().x - start.x).toBeCloseTo(4 * pitch, 1);
  expect(small.getBoundingClientRect().width).toBeCloseTo(start.width, 1);
  expect(small.getBoundingClientRect().height).toBeCloseTo(start.height, 1);
  expect(large.getBoundingClientRect().x).toBeCloseTo(neighbour.x, 1);
});
