import { expect, test } from "vite-plus/test";

import { getInfiniteCanvasGroupTabLabel } from "./group-state";
import type { InfiniteCanvasGroup } from "./types";

/**
 * What a tab and an accordion header are called.
 *
 * This rendered `node.id` — a UUID — on every tab of every group in every consumer. Invisible to
 * everything except looking: nothing errors and no type is wrong.
 */

const windows = [
  { id: "note-1", title: "Quarterly notes" },
  { id: "note-2", title: "Untitled 6" },
] as unknown as Parameters<typeof getInfiniteCanvasGroupTabLabel>[0]["windows"];

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
  expect(getInfiniteCanvasGroupTabLabel({ childId: "note-1", group: tabs, windows })).toBe(
    "Quarterly notes",
  );
  expect(getInfiniteCanvasGroupTabLabel({ childId: "note-2", group: tabs, windows })).toBe(
    "Untitled 6",
  );
});

test("a nested tabs container is named by what it is showing", () => {
  // Docking onto a tab's occupant nests a container inside that tab. Naming it after the group
  // gave two identical tabs, neither saying what was in it.
  const nested = group({
    activeChildId: "container-2",
    axis: "horizontal",
    children: [
      { id: "note-1", kind: "window", weight: 1 },
      {
        activeChildId: "note-2",
        axis: "horizontal",
        children: [{ id: "note-2", kind: "window", weight: 1 }],
        id: "container-2",
        kind: "container",
        layout: "tabs",
        weight: 1,
      },
    ],
    id: "container-1",
    kind: "container",
    layout: "tabs",
    weight: 1,
  });

  expect(getInfiniteCanvasGroupTabLabel({ childId: "container-2", group: nested, windows })).toBe(
    "Untitled 6",
  );
});

test("a split has no single occupant, so it takes the group's title", () => {
  const split = group({
    activeChildId: "container-2",
    axis: "horizontal",
    children: [
      {
        activeChildId: null,
        axis: "vertical",
        children: [
          { id: "note-1", kind: "window", weight: 1 },
          { id: "note-2", kind: "window", weight: 1 },
        ],
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

  expect(getInfiniteCanvasGroupTabLabel({ childId: "container-2", group: split, windows })).toBe(
    "Group title",
  );
});

test("a child no window answers to falls back to its id rather than to nothing", () => {
  expect(getInfiniteCanvasGroupTabLabel({ childId: "note-1", group: tabs, windows: [] })).toBe(
    "note-1",
  );
});

test("a child that is in no tree at all takes the group's title", () => {
  expect(getInfiniteCanvasGroupTabLabel({ childId: "elsewhere", group: tabs, windows })).toBe(
    "Group title",
  );
});
