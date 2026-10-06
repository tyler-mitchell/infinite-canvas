import { expect, test } from "vite-plus/test";

import { createInfiniteCanvasState, createInfiniteCanvasWindow } from "./factory";
import { createInfiniteCanvasStore } from "./store";
import { reduceInfiniteCanvasState } from "./operations";
import { getSelectedWindowIds, normalizeSelection } from "./selection";
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

  return reduceInfiniteCanvasState(base, { targets: [orphan], type: "selection.add" });
};

test("a scene object can be selected at all", () => {
  const selected = withSelectedOrphan();

  expect(selected.selection.targets).toStrictEqual([{ type: "window", id: "a" }, orphan]);
});

test("normalizing does not prune a target naming nothing", () => {
  const selected = withSelectedOrphan();

  expect(normalizeSelection(selected, selected.selection).targets).toStrictEqual([
    { type: "window", id: "a" },
    orphan,
  ]);
});

test("a dead target survives a serialize and hydrate round trip", () => {
  const selected = withSelectedOrphan();
  const restored = createInfiniteCanvasStore({
    document: JSON.parse(
      JSON.stringify(createInfiniteCanvasStore({ initialState: selected }).snapshot()),
    ),
  }).getState();

  expect(restored).not.toBeNull();
  expect(restored.selection.targets).toStrictEqual([{ type: "window", id: "a" }, orphan]);
});

test("a window id in the same selection is pruned, which is the contrast", () => {
  const selected = {
    ...withSelectedOrphan(),
    selection: {
      anchorTarget: { type: "window" as const, id: "a" },
      targets: [
        { type: "window" as const, id: "a" },
        { type: "window" as const, id: "window-that-was-closed" },
        orphan,
      ],
    },
  };
  const normalized = normalizeSelection(selected, selected.selection);

  expect(getSelectedWindowIds(normalized)).toStrictEqual(["a"]);
  expect(normalized.targets).toStrictEqual([{ type: "window", id: "a" }, orphan]);
});
