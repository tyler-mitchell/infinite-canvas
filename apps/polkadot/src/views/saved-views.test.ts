import { afterEach, expect, test, vi } from "vite-plus/test";

import { savedViews as viewGateway } from "../database/operations";
import {
  getSavedViews,
  loadSavedViews,
  reframeView,
  removeSavedView,
  savedViews$,
  saveView,
} from "./saved-views";

afterEach(() => vi.restoreAllMocks());

test("refreshing one canvas preserves another canvas's saved views", async () => {
  const first = {
    id: "saved_view:first",
    title: "First",
    rect: { x: 0, y: 0, width: 320, height: 240 },
  };
  const second = {
    id: "saved_view:second",
    title: "Second",
    rect: { x: 640, y: 0, width: 300, height: 200 },
  };
  const updated = { ...first, rect: { ...first.rect, x: 80 } };
  vi.spyOn(viewGateway, "list")
    .mockResolvedValueOnce(structuredClone([first]))
    .mockResolvedValueOnce(structuredClone([second]))
    .mockResolvedValueOnce(structuredClone([updated]));
  await Promise.all([
    loadSavedViews("canvas_document:first"),
    loadSavedViews("canvas_document:second"),
  ]);
  expect(
    getSavedViews(savedViews$["canvas_document:first"].peek(), "canvas_document:first"),
  ).toEqual([first]);
  await loadSavedViews("canvas_document:first");
  expect(
    getSavedViews(savedViews$["canvas_document:first"].peek(), "canvas_document:first"),
  ).toEqual([updated]);
  expect(
    getSavedViews(savedViews$["canvas_document:second"].peek(), "canvas_document:second"),
  ).toEqual([second]);
  expect(
    getSavedViews(savedViews$["canvas_document:unloaded"].peek(), "canvas_document:unloaded"),
  ).toBeNull();
});

test("saving uses the returned view without a post-write reload", async () => {
  const canvasId = "canvas_document:save";
  const previous = {
    id: "saved_view:previous",
    title: "Zeta",
    rect: { x: 0, y: 0, width: 100, height: 100 },
  };
  const saved = {
    id: "saved_view:created",
    title: "Alpha",
    rect: { x: 20, y: 30, width: 200, height: 150 },
  };
  savedViews$[canvasId].set({ canvasId, views: [structuredClone(previous)] });
  const create = vi.spyOn(viewGateway, "create").mockResolvedValue(structuredClone(saved));
  const list = vi.spyOn(viewGateway, "list").mockRejectedValue(new Error("Reload unavailable"));
  await saveView({ canvasId, title: saved.title, rect: saved.rect });
  expect(create).toHaveBeenCalledExactlyOnceWith({
    canvasId,
    title: saved.title,
    rect: saved.rect,
  });
  expect(list).not.toHaveBeenCalled();
  expect(savedViews$[canvasId].peek()?.views).toEqual([saved, previous]);
});

test("an unloaded list is read before creating a view", async () => {
  const canvasId = "canvas_document:cold_save";
  const previous = {
    id: "saved_view:existing",
    title: "Alpha",
    rect: { x: 0, y: 0, width: 100, height: 100 },
  };
  const saved = {
    id: "saved_view:new",
    title: "Beta",
    rect: { x: 20, y: 30, width: 200, height: 150 },
  };
  vi.spyOn(viewGateway, "list").mockResolvedValue(structuredClone([previous]));
  vi.spyOn(viewGateway, "create").mockResolvedValue(structuredClone(saved));
  await saveView({ canvasId, title: saved.title, rect: saved.rect });
  expect(savedViews$[canvasId].peek()?.views).toEqual([previous, saved]);
});

test("a failed initial read prevents creation", async () => {
  const error = new Error("Views unavailable");
  vi.spyOn(viewGateway, "list").mockRejectedValue(error);
  const create = vi.spyOn(viewGateway, "create");
  await expect(
    saveView({
      canvasId: "canvas_document:unavailable",
      title: "View",
      rect: { x: 0, y: 0, width: 100, height: 100 },
    }),
  ).rejects.toBe(error);
  expect(create).not.toHaveBeenCalled();
});

test("unnamed saves derive unique titles from the loaded list in order", async () => {
  const canvasId = "canvas_document:default_titles";
  const rect = { x: 0, y: 0, width: 320, height: 240 };
  vi.spyOn(viewGateway, "list").mockResolvedValue([
    { id: "saved_view:existing", title: "View 7", rect },
  ]);
  const create = vi.spyOn(viewGateway, "create").mockImplementation(async (input) => ({
    id: `saved_view:${input.title.replaceAll(" ", "_")}`,
    title: input.title,
    rect: input.rect,
  }));
  await Promise.all([saveView({ canvasId, rect }), saveView({ canvasId, rect })]);
  expect(create.mock.calls.map(([input]) => input.title)).toEqual(["View 8", "View 9"]);
  expect(savedViews$[canvasId].peek()?.views.map((view) => view.title)).toEqual([
    "View 7",
    "View 8",
    "View 9",
  ]);
});

test("reframe and removal update known views without a reload", async () => {
  const canvasId = "canvas_document:mutations";
  const first = {
    id: "saved_view:reframe",
    title: "First",
    rect: { x: 0, y: 0, width: 320, height: 240 },
  };
  const second = {
    id: "saved_view:remove",
    title: "Second",
    rect: { x: 100, y: 50, width: 400, height: 300 },
  };
  const rect = { x: 20, y: 30, width: 500, height: 400 };
  savedViews$[canvasId].set({ canvasId, views: structuredClone([first, second]) });
  const list = vi.spyOn(viewGateway, "list").mockRejectedValue(new Error("Reload unavailable"));
  const reframe = vi.spyOn(viewGateway, "reframe").mockResolvedValue(undefined);
  const remove = vi.spyOn(viewGateway, "remove").mockResolvedValue(undefined);

  await reframeView({ canvasId, viewId: first.id, rect });
  expect(reframe).toHaveBeenCalledExactlyOnceWith({ viewId: first.id, rect });
  expect(savedViews$[canvasId].peek()?.views).toEqual([{ ...first, rect }, second]);
  await removeSavedView({ canvasId, viewId: second.id });
  expect(remove).toHaveBeenCalledExactlyOnceWith(second.id);
  expect(savedViews$[canvasId].peek()?.views).toEqual([{ ...first, rect }]);
  expect(list).not.toHaveBeenCalled();
});

test("failed mutations preserve the cached view", async () => {
  const canvasId = "canvas_document:failed_mutation";
  const view = {
    id: "saved_view:retained",
    title: "Retained",
    rect: { x: 0, y: 0, width: 320, height: 240 },
  };
  savedViews$[canvasId].set({ canvasId, views: [structuredClone(view)] });
  const error = new Error("Write rejected");
  vi.spyOn(viewGateway, "remove").mockRejectedValue(error);
  vi.spyOn(viewGateway, "reframe").mockRejectedValue(error);
  await expect(removeSavedView({ canvasId, viewId: view.id })).rejects.toBe(error);
  await expect(
    reframeView({ canvasId, viewId: view.id, rect: { ...view.rect, x: 100 } }),
  ).rejects.toBe(error);
  expect(savedViews$[canvasId].peek()?.views).toEqual([view]);
});
