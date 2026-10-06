import { afterEach, expect, test, vi } from "vite-plus/test";

import { undoableAction$, undoLastAction } from "../content/undoable-action";
import * as database from "../database/operations";
import type { ContentRelation } from "../database/database.client";
import { disconnectRelations, relations$ } from "./relation-store";

const cuts = [
  {
    id: "relates_to:ab",
    source: "content_item:a",
    target: "content_item:b",
    kind: "supports",
    label: "Supports finding",
  },
  {
    id: "relates_to:bc",
    source: "content_item:b",
    target: "content_item:c",
    kind: "custom",
    label: null,
  },
] satisfies readonly ContentRelation[];

afterEach(() => {
  undoableAction$.set(null);
  vi.restoreAllMocks();
});

test("removal sends one batch and undo restores labels through returned ids", async () => {
  const disconnect = vi.spyOn(database.relations, "disconnect").mockResolvedValue(undefined);
  const connect = vi
    .spyOn(database.relations, "connect")
    .mockResolvedValueOnce("relates_to:restored_ab")
    .mockResolvedValueOnce("relates_to:restored_bc");
  const setLabel = vi.spyOn(database.relations, "setLabel").mockResolvedValue(undefined);
  const restored = [
    { ...cuts[0], id: "relates_to:restored_ab" },
    { ...cuts[1], id: "relates_to:restored_bc" },
  ];
  const list = vi
    .spyOn(database.relations, "list")
    .mockResolvedValueOnce([])
    .mockResolvedValueOnce(structuredClone(restored));

  await disconnectRelations({ projectId: "project:batch", relations: cuts });
  expect(disconnect).toHaveBeenCalledExactlyOnceWith(cuts);
  await undoLastAction();
  expect(connect.mock.calls).toEqual([
    [{ source: "content_item:a", target: "content_item:b", kind: "supports" }],
    [{ source: "content_item:b", target: "content_item:c", kind: "custom" }],
  ]);
  expect(setLabel).toHaveBeenCalledExactlyOnceWith({
    label: "Supports finding",
    relationId: "relates_to:restored_ab",
  });
  expect(list.mock.calls).toEqual([["project:batch"], ["project:batch"]]);
  expect(relations$["project:batch"].peek()).toEqual(restored);
});

test("a rejected removal batch leaves undo and refresh untouched", async () => {
  const error = new Error("Removal rejected");
  const disconnect = vi.spyOn(database.relations, "disconnect").mockRejectedValue(error);
  const list = vi.spyOn(database.relations, "list");
  undoableAction$.set(null);
  await expect(disconnectRelations({ projectId: "project:batch", relations: cuts })).rejects.toBe(
    error,
  );
  expect(disconnect).toHaveBeenCalledExactlyOnceWith(cuts);
  expect(list).not.toHaveBeenCalled();
  expect(undoableAction$.peek()).toBeNull();
});
