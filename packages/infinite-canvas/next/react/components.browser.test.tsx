import { expect, test } from "vite-plus/test";
import { type } from "arktype";
import { act } from "react";
import { createRoot } from "react-dom/client";
import { createCanvasState } from "../state";
import { ComponentView, defineComponents, WindowContent } from "./components";
import { CanvasViewport } from "./viewport";

Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true });

const components = defineComponents({
  components: {
    tall: {
      schema: type({}),
      render: () => <div style={{ height: 300 }} />,
    },
  },
});

const mount = (canvas: ReturnType<typeof createCanvasState>) => {
  const host = document.createElement("div");
  host.style.cssText = "position:fixed;left:0;top:0;width:800px;height:600px";
  document.body.append(host);
  return act(async () =>
    createRoot(host).render(
      <CanvasViewport
        canvas={canvas}
        renderWindow={(window) => (
          <WindowContent>
            <ComponentView canvas={canvas} window={window} components={components} />
          </WindowContent>
        )}
      />,
    ),
  );
};

const settle = () =>
  act(() => new Promise((resolve) => requestAnimationFrame(() => resolve(undefined))));

test("a grid child that fits its content takes the content's height at a fractional width", async () => {
  const canvas = createCanvasState({
    windowDefinitions: components,
    document: {
      content: {
        windows: {
          grid: {
            rect: { x: 0, y: 0, width: 880, height: 400 },
            layout: { type: "grid", columns: 12, rowHeight: 40, gap: 12, compact: true },
            children: ["a"],
          },
          a: {
            kind: "tall",
            heightMode: "content",
            item: { column: 0, columnSpan: 6 },
            rect: { x: 0, y: 0, width: 434, height: 100 },
            data: {},
          },
        },
      },
    },
  });
  await mount(canvas);
  await settle();
  await settle();
  expect(canvas.computed.windowRect.a.peek()?.height).toBeCloseTo(300, 0);
});
