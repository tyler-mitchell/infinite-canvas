import { expect, test } from "vite-plus/test";

import { createInfiniteCanvasState, createInfiniteCanvasWindow } from "./factory";
import { parseInfiniteCanvasStateJson, stringifyInfiniteCanvasState } from "./persistence";
import { reduceInfiniteCanvasState } from "./reducer";
import { normalizeSelection } from "./selection";
import type { InfiniteCanvasState } from "./types";

/**
 * How long a selected scene object outlives the object.
 *
 * The framework prunes a selection's `windowIds` — `normalizeSelectionWindowIds` drops ids naming
 * no live window, and `reconcileInfiniteCanvasWorkspaces` cleans a *stored* workspace selection for
 * the reason written there: "a window closed once leaves its name in a document forever".
 *
 * It cannot do the same for `targets`, and this pins how far that goes rather than arguing about
 * it. `selection` is in `INFINITE_CANVAS_DOCUMENT_FIELDS`, so targets are written down and restored;
 * `normalizeSelectionTargets` only deduplicates. A scene object the consumer has deleted stays
 * selected across every reload.
 *
 * **This is a contract, not a bug to fix here.** The framework has no idea what a consumer's scene
 * objects are — that is the whole point of `spatialTargetResolvers` — so it cannot know which
 * targets are dead. What these assert is that the consumer owns the pruning, and what a
 * consumer-knowledge surface would have to answer if the framework is ever to own it. They should
 * be rewritten, not deleted, on the day it lands.
 */

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
  // The premise. Without this every assertion below would pass on an empty target list.
  const selected = withSelectedOrphan();

  expect(selected.selection.targets ?? []).toHaveLength(1);
  expect(selected.selection.targets?.[0]?.id).toBe(orphan.id);
});

test("normalizing does not prune a target naming nothing", () => {
  // It cannot: nothing in `state` says which scene objects exist.
  const selected = withSelectedOrphan();

  expect(normalizeSelection(selected, selected.selection).targets ?? []).toHaveLength(1);
});

test("a dead target survives a serialize and hydrate round trip", () => {
  /*
   * The half that makes it permanent rather than session-local. A window id in the same position is
   * dropped on the way back in, because the framework can check it against `windows`.
   */
  const selected = withSelectedOrphan();
  const restored = parseInfiniteCanvasStateJson(stringifyInfiniteCanvasState(selected), selected);

  expect(restored).not.toBeNull();
  expect(restored?.selection.targets ?? []).toHaveLength(1);
  expect(restored?.selection.targets?.[0]?.id).toBe(orphan.id);
});

test("a window id in the same selection is pruned, which is the contrast", () => {
  /*
   * Stated as one comparison, because the asymmetry is the finding: the framework prunes exactly
   * what it can verify and keeps exactly what it cannot. A consumer reading only the target half
   * would reasonably assume selection is cleaned uniformly.
   */
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
