import {
  DEFAULT_INFINITE_CANVAS_DETAIL_POLICY,
  getInfiniteCanvasWindowDetailLevel,
} from "@hyphened/infinite-canvas/legacy";
import { expect, test } from "vite-plus/test";

import { COLLECTION_MINIMUM_SIZE } from "../collections/open-collection";
import { NOTE_MINIMUM_SIZE } from "../notes/open-note";
import { SUMMARY_MINIMUM_SHORT_AXIS, withSummaryMinimum } from "./open-window";

/*
 * A kind that draws a summary must be able to stop drawing one.
 *
 * Detail restores only above `fullAbovePx`, so a window sitting at exactly that size enters summary
 * and stays there at 100% zoom. Nothing reports it: the window still moves, still saves, and simply
 * never shows its body again. This is the failure this project keeps finding, where a wrong value
 * produces a result that does not look broken.
 */
const SUMMARY_KINDS = [
  ["note", NOTE_MINIMUM_SIZE],
  ["collection", COLLECTION_MINIMUM_SIZE],
] as const;

test.each(SUMMARY_KINDS)("a %s at its minimum can still restore to full detail", (_kind, size) => {
  const atMinimum = { ...size, x: 0, y: 0 };

  expect(getInfiniteCanvasWindowDetailLevel(atMinimum, 1, "summary")).toBe("full");
});

test("the floor comes from the policy, so it follows if the policy moves", () => {
  expect(SUMMARY_MINIMUM_SHORT_AXIS).toBeGreaterThan(
    DEFAULT_INFINITE_CANVAS_DETAIL_POLICY.fullAbovePx,
  );
});

test("a kind written below the floor is raised, rather than shipping stuck in summary", () => {
  const raised = withSummaryMinimum({ height: 120, width: 120 });

  expect(getInfiniteCanvasWindowDetailLevel({ ...raised, x: 0, y: 0 }, 1, "summary")).toBe("full");
});

test("the check bites on the value the roadmap warns about", () => {
  const atThreshold = {
    height: DEFAULT_INFINITE_CANVAS_DETAIL_POLICY.fullAbovePx,
    width: 240,
    x: 0,
    y: 0,
  };

  // Exactly at the threshold, restore never happens, which is the trap being guarded.
  expect(getInfiniteCanvasWindowDetailLevel(atThreshold, 1, "summary")).toBe("summary");
});
