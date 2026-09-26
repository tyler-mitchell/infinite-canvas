import { type } from "arktype";
import { hydrateRoot } from "react-dom/client";
import { renderToString } from "react-dom/server";
import { expect, test } from "vite-plus/test";
import { createCanvasState } from "../state";
import { CanvasViewport } from "./viewport";

test("server-rendered windows hydrate without replacing their content", async () => {
  const createCanvas = () =>
    createCanvasState({
      windowDefinitions: { profile: { schema: type({}) } },
      document: {
        content: {
          windows: {
            profile: {
              kind: "profile",
              data: {},
              title: "Profile",
              rect: { x: 0, y: 0, width: 320, height: 180 },
            },
          },
        },
      },
    });
  const renderWindow = () => <a href="https://example.com">Project details</a>;
  const host = document.createElement("div");
  host.style.cssText = "width:800px;height:600px";
  host.innerHTML = renderToString(
    <CanvasViewport canvas={createCanvas()} renderWindow={renderWindow} />,
  );
  document.body.append(host);
  const link = host.querySelector("a");
  expect(link?.textContent).toBe("Project details");
  const errors: unknown[] = [];
  const canvas = createCanvas();
  const root = hydrateRoot(host, <CanvasViewport canvas={canvas} renderWindow={renderWindow} />, {
    onRecoverableError: (error) => errors.push(error),
  });
  try {
    await expect.poll(() => canvas.state.input.viewport.width.peek()).toBe(800);
    expect(host.querySelector("a")).toBe(link);
    expect(errors).toEqual([]);
    expect(host.querySelector("[data-slot=canvas-window]")?.hasAttribute("hidden")).toBe(false);
  } finally {
    root.unmount();
    host.remove();
  }
});
