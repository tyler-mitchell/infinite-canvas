import { expect, test } from "vite-plus/test";
import { act } from "react";
import { createRoot } from "react-dom/client";
import { createCanvasState } from "../state";
import { CanvasPortal } from "./context";
import { CanvasViewport } from "./viewport";

Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true });

const canvas = createCanvasState({
  windowDefinitions: { card: { size: { width: 200, height: 100 } } },
  document: {
    content: {
      windows: {
        a: { kind: "card", title: "A", rect: { x: 300, y: 250, width: 200, height: 100 } },
        b: { kind: "card", title: "B", rect: { x: 300, y: 450, width: 200, height: 100 } },
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

const rectOf = (selector: string) => document.querySelector(selector)!.getBoundingClientRect();
const bar = () => rectOf("[data-testid='bar']");
const box = () => rectOf("[data-slot='canvas-selection-portal']");
const above = () => expect(bar().bottom).toBeCloseTo(box().top - 12, 1);
const below = () => expect(bar().top).toBeCloseTo(box().bottom + 12, 1);

test("a portal with a side sits beside the selection, flips at the usable edge, and shifts inside it", async () => {
  await act(async () => {
    createRoot(host).render(
      <CanvasViewport canvas={canvas} renderWindow={(window) => window.title.get()}>
        <CanvasPortal scope="selection" side="top" sideOffset={12}>
          <div data-testid="bar" style={{ width: 120, height: 40 }} />
        </CanvasPortal>
      </CanvasViewport>,
    );
  });
  await settle(() => canvas.actions.selectWindow.run({ window: "a" }));
  above();
  expect(bar().left + bar().width / 2).toBeCloseTo(box().left + box().width / 2, 1);

  await settle(() => canvas.actions.setCamera.run({ center: { x: 400, y: 530 } }));
  expect(box().top).toBeCloseTo(20, 1);
  below();

  await settle(() => canvas.actions.selectWindow.run({ window: "b" }));
  expect(box().top).toBeCloseTo(220, 1);
  above();

  await settle(() => canvas.actions.clearSelection.run({}));
  await settle(() => {
    canvas.actions.setCamera.run({ center: { x: 400, y: 380 } });
    canvas.actions.setViewportInsets.run({ top: 150 });
  });
  await settle(() => canvas.actions.selectWindow.run({ window: "a" }));
  expect(box().top).toBeCloseTo(170, 1);
  below();

  await settle(() => canvas.actions.clearSelection.run({}));
  await settle(() => {
    canvas.actions.setCamera.run({ center: { x: 780, y: 300 } });
    canvas.actions.setViewportInsets.run({ top: 0 });
  });
  await settle(() => canvas.actions.selectWindow.run({ window: "a" }));
  above();
  expect(bar().left).toBeCloseTo(0, 1);

  await settle(() => {
    canvas.actions.setCamera.run({ center: { x: 400, y: 300 } });
    canvas.actions.setViewportInsets.run({ top: 260, bottom: 260 });
  });
  expect(box().top).toBeCloseTo(250, 1);
  expect(bar().top).toBeCloseTo(260, 1);

  await settle(() => {
    canvas.actions.setCamera.run({ center: { x: 400, y: 2000 } });
    canvas.actions.setViewportInsets.run({ top: 0, bottom: 0 });
  });
  expect(document.querySelector("[data-testid='bar']")).toBeNull();
});
