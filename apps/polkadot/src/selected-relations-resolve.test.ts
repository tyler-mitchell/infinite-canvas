import { expect, test } from "vite-plus/test";

import { getSelectedRelations } from "./canvas/connector-geometry";
import type { ContentRelation } from "./database/database.client";

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
  expect(getSelectedRelations(selecting("relation:live"), live)).toHaveLength(1);
});

test("a target naming a cut edge contributes nothing", () => {
  expect(getSelectedRelations(selecting("relation:cut"), live)).toStrictEqual([]);
});

test("a live target is unaffected by a dead one beside it", () => {
  const resolved = getSelectedRelations(
    selecting("relation:cut", "relation:live", "relation:also-cut"),
    live,
  );

  expect(resolved.map((entry) => entry.id)).toStrictEqual(["relation:live"]);
});

test("a target of another kind is not read as an edge", () => {
  const sceneObject = {
    anchorWindowId: null,
    targets: [{ id: "relation:live", kind: "region", type: "scene-object" as const }],
    windowIds: [],
  };

  expect(getSelectedRelations(sceneObject, live)).toStrictEqual([]);
});
