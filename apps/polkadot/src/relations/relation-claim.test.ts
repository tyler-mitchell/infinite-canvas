import { expect, test } from "vite-plus/test";

import type { ContentRelation } from "../database/database.client";
import { DEFAULT_RELATION_KIND, getRelationLabel, RELATION_KINDS } from "./relation-store";

const edge = (kind: string, label: string | null): ContentRelation =>
  ({ id: "rel-1", kind, label, source: "item-1", target: "item-2" }) as unknown as ContentRelation;

test("the default kind with no label claims nothing, so nothing guards it", () => {
  expect(getRelationLabel(edge(DEFAULT_RELATION_KIND, null))).toBeUndefined();
  expect(getRelationLabel(edge(DEFAULT_RELATION_KIND, ""))).toBeUndefined();
  expect(getRelationLabel(edge(DEFAULT_RELATION_KIND, "   "))).toBeUndefined();
});

test("every kind that is not the default claims something on its own", () => {
  const claiming = RELATION_KINDS.filter((kind) => kind !== DEFAULT_RELATION_KIND);

  expect(claiming.length).toBe(4);

  for (const kind of claiming) {
    expect(getRelationLabel(edge(kind, null)), `${kind} claims nothing`).toBe(kind);
  }
});

test("a written label claims something even on the default kind", () => {
  expect(getRelationLabel(edge(DEFAULT_RELATION_KIND, "supersedes the draft"))).toBe(
    "supersedes the draft",
  );
});

test("a written label wins over the kind, so the guard quotes what was actually written", () => {
  expect(getRelationLabel(edge("contradicts", "blocks the review"))).toBe("blocks the review");
});

test("surrounding whitespace is not a claim", () => {
  expect(getRelationLabel(edge(DEFAULT_RELATION_KIND, "  "))).toBeUndefined();
  expect(getRelationLabel(edge("refines", "  "))).toBe("refines");
});
