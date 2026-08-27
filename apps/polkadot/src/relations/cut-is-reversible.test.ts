import { expect, test } from "vite-plus/test";

import { undoableAction$ } from "../content/undoable-action";
import { DEFAULT_RELATION_KIND, getRelationLabel } from "./relation-store";
import type { ContentRelation } from "../database/database.client";

/**
 * Cutting a connection offers to put it back, and the offer names what it would restore.
 *
 * This was the one removal in the app that destroyed something, which contradicted the app's own
 * rule: removal is archiving *because* nothing is destroyed, and that is why archiving needs no
 * confirmation. `fn::unrelate_content_items` deletes the row and the canvas's `history.undo` does
 * not reach the database, so a kind someone chose and a sentence someone typed left for good.
 *
 * What closed it is an inverse rather than a schema change. An edge is entirely described by its two
 * ends, its kind and its label, so reconnecting with all four restores everything a reader can
 * observe — ROADMAP scoped this as a stored flag every read filters, and that turned out to buy only
 * the row's identity, which nothing addresses across a cut.
 *
 * **The database half cannot be tested here**, since `disconnectItems` writes through the gateway and
 * this app has no database tests. That half was driven: a `supports` edge labelled "load-bearing
 * evidence" was cut and restored with both intact, through the palette's undo row. What is pinned
 * here is the part that decides whether the offer is right — how it is described, and that the
 * description survives the reasons an edge might carry nothing.
 */

const edge = (kind: string, label: string | null): ContentRelation =>
  ({ id: "rel-1", kind, label, source: "item-1", target: "item-2" }) as unknown as ContentRelation;

/** The sentence `disconnectItems` puts on the undo row, from the edge it just read. */
const describeCut = (relation: ContentRelation) => {
  const claim = getRelationLabel(relation);

  return claim === undefined ? "Undo cutting the connection" : `Undo cutting “${claim}”`;
};

test("the offer quotes the claim, because one connection is every connection otherwise", () => {
  // Named for the same reason the removal dialog quotes it: "the connection" does not say which.
  expect(describeCut(edge(DEFAULT_RELATION_KIND, "load-bearing evidence"))).toBe(
    "Undo cutting “load-bearing evidence”",
  );
  expect(describeCut(edge("contradicts", "blocks the review"))).toBe(
    "Undo cutting “blocks the review”",
  );
});

test("an edge that says only what its kind says is named by the kind", () => {
  expect(describeCut(edge("supports", null))).toBe("Undo cutting “supports”");
});

test("a bare edge is still offered, without inventing a claim for it", () => {
  /*
   * Offered even though it says nothing beyond existing. The report to a *caller* stays quiet for
   * this case, deliberately — a sentence about losing nothing trains a reader to skip the one that
   * matters — but undo is not a report. Someone who cut the wrong line wants it back whether or not
   * it carried a word.
   */
  expect(describeCut(edge(DEFAULT_RELATION_KIND, null))).toBe("Undo cutting the connection");
  expect(describeCut(edge(DEFAULT_RELATION_KIND, "   "))).toBe("Undo cutting the connection");
});

test("the palette shows one offer at a time, so a cut replaces what was there", () => {
  /*
   * `undoableAction$` holds one entry rather than a stack, which is the peer's claim on that file
   * and not something this cut gets to opt out of. It matters here because it bounds the promise:
   * the dialog says undo brings the connection back "until the next thing you undo takes its
   * place", and that sentence is only true while this holds one.
   */
  undoableAction$.set({ describe: "Undo archiving “Quarterly”", undo: async () => undefined });
  expect(undoableAction$.peek()?.describe).toBe("Undo archiving “Quarterly”");

  undoableAction$.set({
    describe: describeCut(edge("supports", null)),
    undo: async () => undefined,
  });
  expect(undoableAction$.peek()?.describe).toBe("Undo cutting “supports”");

  undoableAction$.set(null);
});
