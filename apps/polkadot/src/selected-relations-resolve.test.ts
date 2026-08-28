import { expect, test } from "vite-plus/test";

import { getSelectedRelations } from "./canvas/connector-geometry";
import type { ContentRelation } from "./database/database.client";

/**
 * A selected edge is resolved against live relations, every time.
 *
 * The framework never prunes `selection.targets` — it cannot, since it has no idea what a
 * consumer's scene objects are — and `selection` is a durable document field, so a target naming a
 * cut edge is written down and restored on every reload. That is pinned upstream in
 * `selection-target-lifetime.test.ts`.
 *
 * **What keeps that harmless here is this function, and nothing else asserted it.** Every reader of
 * edge selection goes through `getSelectedRelations` — the palette's cut row and the keyboard's cut
 * action, deliberately sharing one derivation — and it resolves each target by id against the
 * relations that currently exist. A stale target matches nothing and contributes nothing.
 *
 * So the orphan is inert rather than absent, and the thing to protect is the resolving. Caching the
 * lookup, or trusting `targets` as a list of edges, would turn a dead reference into a phantom
 * connection the app offers to cut.
 */

const relation = (id: string, source: string, target: string): ContentRelation => ({
  id,
  kind: "supports",
  source,
  target,
});

const live = [
  relation("relation:live", "content_item:a", "content_item:b"),
  relation("relation:other", "content_item:c", "content_item:d"),
];

const selecting = (...ids: readonly string[]) => ({
  anchorWindowId: null,
  targets: ids.map((id) => ({ id, kind: "relation", type: "edge" as const })),
  windowIds: [],
});

test("a selected edge that still exists resolves", () => {
  // The premise. Without it every assertion below would pass on a function that returns nothing.
  expect(getSelectedRelations(selecting("relation:live"), live)).toHaveLength(1);
});

test("a target naming a cut edge contributes nothing", () => {
  expect(getSelectedRelations(selecting("relation:cut"), live)).toStrictEqual([]);
});

test("a live target is unaffected by a dead one beside it", () => {
  /*
   * The shape a persisted selection actually takes after a few cuts: one edge the user still has
   * selected, and the accumulated ids of ones they no longer do.
   */
  const resolved = getSelectedRelations(
    selecting("relation:cut", "relation:live", "relation:also-cut"),
    live,
  );

  expect(resolved.map((entry) => entry.id)).toStrictEqual(["relation:live"]);
});

test("a target of another kind is not read as an edge", () => {
  // `selection.targets` also carries scene objects. Only this app's connector targets are edges,
  // and the filter asks for both `type` and `kind` rather than trusting either alone.
  const sceneObject = {
    anchorWindowId: null,
    targets: [{ id: "relation:live", kind: "region", type: "scene-object" as const }],
    windowIds: [],
  };

  expect(getSelectedRelations(sceneObject, live)).toStrictEqual([]);
});
