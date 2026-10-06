import { observable, when } from "@legendapp/state";
import { afterEach, expect, test, vi } from "vite-plus/test";

import { initialLayout } from "./canvas/canvas-document";
import * as database from "./database/operations";
import { namingQueue } from "./naming-queue";
import { createCanvas } from "./workspace/create-canvas";
import { createProject } from "./workspace/create-project";
import { duplicateCanvas } from "./workspace/duplicate-canvas";
import { forkCanvas } from "./workspace/fork-canvas";

afterEach(() => vi.restoreAllMocks());

test.each([
  { name: "project", run: () => createProject(), writer: "project" as const, title: "Project 1" },
  {
    name: "canvas",
    run: () => createCanvas({ projectId: "project:naming" }),
    writer: "canvas" as const,
    title: "Canvas 1",
  },
  {
    name: "duplicate",
    writer: "duplicate" as const,
    title: "Main copy",
    run: () =>
      duplicateCanvas({
        canvasId: "canvas_document:original",
        canvasTitle: "Main",
        projectId: "project:naming",
      }),
  },
  {
    name: "recovery",
    writer: "canvas" as const,
    title: "Main (recovered)",
    run: () =>
      forkCanvas({ canvasTitle: "Main", layout: initialLayout, projectId: "project:naming" }),
  },
])(
  "$name creation selects and writes its title inside the naming queue",
  async ({ run, writer, title }) => {
    const error = new Error("Write failed");
    const writes = {
      project: vi.spyOn(database.projects, "create").mockRejectedValue(error),
      canvas: vi.spyOn(database.canvases, "create").mockRejectedValue(error),
      duplicate: vi.spyOn(database.canvases, "duplicate").mockRejectedValue(error),
    };
    const reads = [
      vi.spyOn(database.projects, "list").mockResolvedValue([]),
      vi.spyOn(database.projects, "listArchived").mockResolvedValue([]),
      vi.spyOn(database.canvases, "list").mockResolvedValue([]),
      vi.spyOn(database.canvases, "listArchived").mockResolvedValue([]),
      vi.spyOn(database.projects, "titles").mockResolvedValue([]),
      vi.spyOn(database.canvases, "titles").mockResolvedValue([]),
    ];
    const released$ = observable(false);
    const blocker = namingQueue.add(() => when(released$));
    const result = expect(run()).rejects.toBe(error);
    try {
      await Promise.resolve();
      for (const read of reads) expect(read).not.toHaveBeenCalled();
      expect(writes[writer]).not.toHaveBeenCalled();
    } finally {
      released$.set(true);
      await Promise.all([blocker, result]);
    }
    expect(writes[writer]).toHaveBeenCalledExactlyOnceWith(expect.objectContaining({ title }));
    for (const read of reads.slice(0, 4)) expect(read).not.toHaveBeenCalled();
  },
);
