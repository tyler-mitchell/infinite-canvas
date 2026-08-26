import { expect, test } from "vite-plus/test";

import { getTabLabel } from "./group-layer";
import type { InfiniteCanvasGroup } from "./types";

/**
 * What a tab and an accordion header are called.
 *
 * This rendered `node.id` — a UUID — on every tab of every group in every consumer, while the
 * function's own docstring said a tab names its window. It is the first thing anyone sees after
 * docking two windows together, and it is invisible to everything except looking: a UUID in a tab
 * reads as data, nothing errors, and no type is wrong.
 */

const WINDOWS = [
  { id: "note-1", title: "Quarterly notes" },
  { id: "note-2", title: "Untitled 6" },
] as const;

const group = (tree: InfiniteCanvasGroup["tree"]): InfiniteCanvasGroup => ({
  id: "group-1",
  rect: { height: 400, width: 600, x: 0, y: 0 },
  title: "Group title",
  tree,
  zIndex: 0,
});

const tabs = group({
  activeChildId: "note-1",
  axis: "horizontal",
  children: [
    { id: "note-1", kind: "window", weight: 1 },
    { id: "note-2", kind: "window", weight: 1 },
  ],
  id: "container-1",
  kind: "container",
  layout: "tabs",
  weight: 1,
});

test("a tab is named by its window, not by the window's id", () => {
  expect(getTabLabel(tabs, "note-1", WINDOWS)).toBe("Quarterly notes");
  expect(getTabLabel(tabs, "note-2", WINDOWS)).toBe("Untitled 6");
});

test("a nested container borrows the group's title, having none of its own", () => {
  const nested = group({
    activeChildId: "container-2",
    axis: "horizontal",
    children: [
      { id: "note-1", kind: "window", weight: 1 },
      {
        activeChildId: null,
        axis: "vertical",
        children: [{ id: "note-2", kind: "window", weight: 1 }],
        id: "container-2",
        kind: "container",
        layout: "split",
        weight: 1,
      },
    ],
    id: "container-1",
    kind: "container",
    layout: "tabs",
    weight: 1,
  });

  expect(getTabLabel(nested, "container-2", WINDOWS)).toBe("Group title");
});

test("a child no window answers to falls back to its id rather than to nothing", () => {
  // A dangling child, not an untitled one — `title` is required on a window. An empty tab would
  // hide the inconsistency; the id names it.
  expect(getTabLabel(tabs, "note-1", [])).toBe("note-1");
});

test("a child that is in no tree at all takes the group's title", () => {
  expect(getTabLabel(tabs, "not-in-this-group", WINDOWS)).toBe("Group title");
});
