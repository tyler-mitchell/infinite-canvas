import { createInfiniteCanvasState, type InfiniteCanvasCommands } from "@hyphened/infinite-canvas";
import { expect, test } from "vite-plus/test";

import type { AppActionContext } from "./app-actions";
import { createAppHandle } from "./app-handle";
import type { WindowKind } from "./canvas/window-registry";

const createContext = (): AppActionContext => ({
  actions: { executeCommand: () => undefined } as unknown as InfiniteCanvasCommands<WindowKind>,
  canvasId: "canvas_document:test",
  canvasTitle: "Test",
  goToCanvas: () => undefined,
  projectId: "project:test",
  refreshRoute: () => undefined,
  state: createInfiniteCanvasState<WindowKind>({ windows: [] }),
});

const handle = () => createAppHandle({ createContext, projectId: "project:test" });

test("the handle offers the same vocabulary WebMCP registers", () => {
  const names = handle()
    .list()
    .map((tool) => tool.name);

  expect(names).toContain("canvas.describe");
  expect(names).toContain("note.create");
  expect(names).toContain("view.fitAll");
  expect(new Set(names).size).toBe(names.length);
});

test("a verb taking an argument says so, and publishes its schema", () => {
  const rename = handle()
    .list()
    .find((tool) => tool.name === "content.rename");

  expect(rename?.takesInput).toBe(true);
  expect(handle().schema("content.rename")).toMatchObject({
    properties: { itemId: { type: "string" }, title: { type: "string" } },
  });
});

test("a verb taking nothing has no schema to offer", () => {
  expect(handle().schema("canvas.describe")).toBeNull();
});

test("an unknown name says how to find the real ones", async () => {
  await expect(handle().run("not.a.verb")).resolves.toContain("window.__app.list()");
});

test("a refusal reaches the caller rather than a success", async () => {
  await expect(handle().run("window.reveal", { windowId: "nope" })).resolves.toContain("Refused:");
});

test("a reporter answers with its report", async () => {
  await expect(handle().run("canvas.describe")).resolves.toContain("Zoom");
});
