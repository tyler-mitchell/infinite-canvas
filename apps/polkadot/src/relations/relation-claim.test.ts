import { expect, test } from "vite-plus/test";

import type { ContentRelation } from "../database/database.client";
import { DEFAULT_RELATION_KIND, getRelationLabel, RELATION_KINDS } from "./relation-store";

/**
 * One question, asked by three surfaces, and this is where they are held to the same answer.
 *
 * "Does this edge claim anything beyond the pairing?" decides three separate things: whether the
 * connector draws a word on the line, whether the library rail confirms before cutting, and whether
 * `relation.disconnect` tells a caller what it destroyed. All three read `getRelationLabel`, and
 * nothing until now said they must.
 *
 * That coupling is deliberate rather than convenient. The rail confirms a cut precisely when there
 * is something to lose, and what there is to lose is what the connector shows — so if the drawn
 * label and the confirmation ever answered differently, one of them would be lying. The failure
 * would be silent in both directions: a dialog guarding an edge that says nothing trains the answer
 * "yes", and no dialog on an edge carrying a sentence destroys it without asking.
 *
 * Written as a test of the predicate rather than of the rail because this app has no component
 * tests — every suite here covers a pure function or an invariant — and the predicate is the whole
 * of the decision. The rail's use of it is a single visible line.
 */

const edge = (kind: string, label: string | null): ContentRelation =>
  ({ id: "rel-1", kind, label, source: "item-1", target: "item-2" }) as unknown as ContentRelation;

test("the default kind with no label claims nothing, so nothing guards it", () => {
  /*
   * `relates` is the claim the row already makes by existing, which is why the connector draws no
   * word for it — and therefore why cutting it needs no dialog. This is the case a confirmation
   * would be worst for: common, harmless, and the thing that teaches a person to click through.
   */
  expect(getRelationLabel(edge(DEFAULT_RELATION_KIND, null))).toBeUndefined();
  expect(getRelationLabel(edge(DEFAULT_RELATION_KIND, ""))).toBeUndefined();
  expect(getRelationLabel(edge(DEFAULT_RELATION_KIND, "   "))).toBeUndefined();
});

test("every kind that is not the default claims something on its own", () => {
  // Four of the five. Choosing one of these was an act; losing it silently is a loss.
  const claiming = RELATION_KINDS.filter((kind) => kind !== DEFAULT_RELATION_KIND);

  expect(claiming.length).toBe(4);

  for (const kind of claiming) {
    expect(getRelationLabel(edge(kind, null)), `${kind} claims nothing`).toBe(kind);
  }
});

test("a written label claims something even on the default kind", () => {
  /*
   * The case that makes the rule worth having. A dragged connector stores `relates`, so an edge
   * someone then typed a sentence onto still carries the default kind — keying the guard on kind
   * alone would destroy exactly the authored text it exists to protect.
   */
  expect(getRelationLabel(edge(DEFAULT_RELATION_KIND, "supersedes the draft"))).toBe(
    "supersedes the draft",
  );
});

test("a written label wins over the kind, so the guard quotes what was actually written", () => {
  // Someone who typed a sentence was being more specific than the five verbs allow, and that
  // sentence is what a confirmation has to show them.
  expect(getRelationLabel(edge("contradicts", "blocks the review"))).toBe("blocks the review");
});

test("surrounding whitespace is not a claim", () => {
  // `" "` is not a sentence. Without the trim it would read as one, and put a dialog in front of a
  // cut that loses nothing.
  expect(getRelationLabel(edge(DEFAULT_RELATION_KIND, "  "))).toBeUndefined();
  expect(getRelationLabel(edge("refines", "  "))).toBe("refines");
});
