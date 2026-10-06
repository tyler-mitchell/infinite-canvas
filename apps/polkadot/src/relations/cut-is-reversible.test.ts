import { expect, test } from "vite-plus/test";

import { undoableAction$ } from "../content/undoable-action";
import { DEFAULT_RELATION_KIND, describeCut } from "./relation-store";
import type { ContentRelation } from "../database/database.client";

const edge = (
  kind: string,
  label: string | null,
  ends: Readonly<{ source: string; target: string }> = { source: "item-1", target: "item-2" },
): ContentRelation =>
  ({ id: `rel-${ends.source}`, kind, label, ...ends }) as unknown as ContentRelation;

const describeOne = (relation: ContentRelation) => describeCut([relation]);

test("the offer quotes the claim, because one connection is every connection otherwise", () => {
  expect(describeOne(edge(DEFAULT_RELATION_KIND, "load-bearing evidence"))).toBe(
    "Undo cutting “load-bearing evidence”",
  );
  expect(describeOne(edge("contradicts", "blocks the review"))).toBe(
    "Undo cutting “blocks the review”",
  );
});

test("an edge that says only what its kind says is named by the kind", () => {
  expect(describeOne(edge("supports", null))).toBe("Undo cutting “supports”");
});

test("cutting several is one offer that covers all of them, not one per edge", () => {
  const cuts = [
    edge("supports", "load-bearing evidence"),
    edge("contradicts", "blocks the review", { source: "item-3", target: "item-4" }),
    edge(DEFAULT_RELATION_KIND, null, { source: "item-5", target: "item-6" }),
  ];

  expect(describeCut(cuts)).toBe("Undo cutting 3 connections");
});

test("cutting nothing says nothing", () => {
  expect(describeCut([])).toBe("");
});

test("a bare edge is still offered, without inventing a claim for it", () => {
  expect(describeOne(edge(DEFAULT_RELATION_KIND, null))).toBe("Undo cutting the connection");
  expect(describeOne(edge(DEFAULT_RELATION_KIND, "   "))).toBe("Undo cutting the connection");
});

test("the palette shows one offer at a time, so a cut replaces what was there", () => {
  undoableAction$.set({ describe: "Undo archiving “Quarterly”", undo: async () => undefined });
  expect(undoableAction$.peek()?.describe).toBe("Undo archiving “Quarterly”");

  undoableAction$.set({
    describe: describeOne(edge("supports", null)),
    undo: async () => undefined,
  });
  expect(undoableAction$.peek()?.describe).toBe("Undo cutting “supports”");

  undoableAction$.set(null);
});
