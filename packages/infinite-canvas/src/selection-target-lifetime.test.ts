import { expect, test } from "vite-plus/test";

import { createInfiniteCanvasState, createInfiniteCanvasWindow } from "./factory";
import { parseInfiniteCanvasStateJson, stringifyInfiniteCanvasState } from "./persistence";
import { reduceInfiniteCanvasState } from "./reducer";
import { normalizeSelection } from "./selection";
import type { InfiniteCanvasState } from "./types";

type Kind = "note";

const orphan = { id: "region-that-was-deleted", kind: "region", type: "scene-object" } as const;

const withSelectedOrphan = (): InfiniteCanvasState<Kind> => {
  const base = {
    ...createInfiniteCanvasState<Kind>({
      windows: [
        createInfiniteCanvasWindow<Kind>({
          id: "a",
          kind: "note",
          rect: { height: 200, width: 300, x: 0, y: 0 },
          title: "a",
        }),
      ],
    }),
    viewport: { height: 800, width: 1200 },
  };

  return reduceInfiniteCanvasState(base, { targets: [orphan], type: "selection.targets.add" });
};

test("a scene object can be selected at all", () => {
  const selected = withSelectedOrphan();

  expect(selected.selection.targets ?? []).toHaveLength(1);
  expect(selected.selection.targets?.[0]?.id).toBe(orphan.id);
});

test("normalizing does not prune a target naming nothing", () => {
  const selected = withSelectedOrphan();

  expect(normalizeSelection(selected, selected.selection).targets ?? []).toHaveLength(1);
});

test("a dead target survives a serialize and hydrate round trip", () => {
  const selected = withSelectedOrphan();
  const restored = parseInfiniteCanvasStateJson(stringifyInfiniteCanvasState(selected), selected);

  expect(restored).not.toBeNull();
  expect(restored?.selection.targets ?? []).toHaveLength(1);
  expect(restored?.selection.targets?.[0]?.id).toBe(orphan.id);
});

test("a window id in the same selection is pruned, which is the contrast", () => {
  const selected = {
    ...withSelectedOrphan(),
    selection: {
      anchorWindowId: "a",
      targets: [orphan],
      windowIds: ["a", "window-that-was-closed"],
    },
  };
  const normalized = normalizeSelection(selected, selected.selection);

  expect(normalized.windowIds).toStrictEqual(["a"]);
  expect(normalized.targets ?? []).toHaveLength(1);
});
