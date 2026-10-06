import { expect, test } from "vite-plus/test";
import { act } from "react";
import { createRoot } from "react-dom/client";
import { createCanvasState } from "../state";
import { CanvasViewport } from "./viewport";

Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true });

const canvas = createCanvasState({
  windowDefinitions: { card: { size: { width: 200, height: 100 } } },
  snapping: { enabled: false },
  document: {
    content: {
      windows: {
        board: {
          title: "Board",
          rect: { x: 100, y: 100, width: 400, height: 300 },
          layout: { type: "grid", columns: 2, rowHeight: 40, gap: 10 },
          children: ["a"],
        },
        a: {
          kind: "card",
          title: "A",
          item: { column: 0, columnSpan: 1 },
          rect: { x: 100, y: 100, width: 195, height: 100 },
        },
      },
    },
    canvasView: { camera: { center: { x: 400, y: 300 }, zoom: 1 } },
  },
});

const host = document.createElement("div");
host.style.cssText = "position:fixed;left:0;top:0;width:800px;height:600px";
document.body.append(host);

const settle = (change?: () => unknown) =>
  act(async () => {
    change?.();
    await new Promise((resolve) => requestAnimationFrame(() => resolve(undefined)));
  });

const hit = (point: { x: number; y: number }) => {
  const element = document.elementFromPoint(point.x, point.y);
  const handle = element?.closest("[data-slot='canvas-resize-handle']");
  if (handle !== null && handle !== undefined)
    return `handle:${handle.getAttribute("data-handle")}`;
  return `window:${element?.closest("[data-window-id]")?.getAttribute("data-window-id")}`;
};

test("at a shared edge the selected window's handle is hit; with no selection the card is", async () => {
  await act(async () => {
    createRoot(host).render(
      <CanvasViewport canvas={canvas} renderWindow={(window) => window.title.get()} />,
    );
  });
  await settle();
  const boardLeft = canvas.computed.windowRect.board.peek()!;
  const cardRect = canvas.computed.windowRect.a.peek()!;
  expect(cardRect.x).toBe(boardLeft.x);
  const edge = { x: 800 / 2 + (cardRect.x - 400) + 3, y: 600 / 2 + (cardRect.y - 300) + 40 };

  expect(hit(edge)).toBe("window:a");

  await settle(() => canvas.actions.selectWindow.run({ window: "a" }));
  expect(hit(edge)).toBe("handle:west");

  await settle(() => canvas.actions.selectWindow.run({ window: "board" }));
  expect(hit(edge)).toBe("handle:west");
  expect(document.querySelectorAll("[data-slot='canvas-resize-handle']").length).toBe(8);

  await settle(() => canvas.actions.selectTargets.run({ targets: [] }));
  expect(document.querySelectorAll("[data-slot='canvas-resize-handle']").length).toBe(0);
});
