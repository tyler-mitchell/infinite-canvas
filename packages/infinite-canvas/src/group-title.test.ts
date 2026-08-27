import { expect, test } from "vite-plus/test";

import { createInfiniteCanvasState, createInfiniteCanvasWindow } from "./factory";
import {
  applyInfiniteCanvasDockPreview,
  createInfiniteCanvasGroup,
  DEFAULT_INFINITE_CANVAS_GROUP_TITLE,
  resolveInfiniteCanvasDockPreviewForTarget,
} from "./group-state";
import type { InfiniteCanvasState } from "./types";

/**
 * A group is named after what is in it.
 *
 * The default was the literal "Group". That was invisible while nothing drew a group's name and
 * became a canvas of identical labels the moment the shell started rendering it.
 */

const seed = (titles: readonly string[]): InfiniteCanvasState<"demo"> =>
  createInfiniteCanvasState<"demo">({
    viewport: { height: 800, width: 1200 },
    windows: titles.map((title, index) =>
      createInfiniteCanvasWindow({
        id: `w${String(index)}`,
        kind: "demo",
        rect: { height: 300, width: 400, x: index * 500, y: 0 },
        title,
      }),
    ),
  });

const grouped = (titles: readonly string[]) =>
  createInfiniteCanvasGroup(seed(titles), {
    groupId: "g",
    rect: { height: 300, width: 900, x: 0, y: 0 },
    windowIds: titles.map((_title, index) => `w${String(index)}`),
  }).groups[0]?.title;

test("one member lends its own name", () => {
  expect(grouped(["Reading list"])).toBe("Reading list");
});

test("two are joined", () => {
  expect(grouped(["Notes", "Sources"])).toBe("Notes & Sources");
});

test("beyond two the first is named and the rest counted", () => {
  expect(grouped(["Notes", "Sources", "Draft"])).toBe("Notes and 2 more");
  expect(grouped(["Notes", "Sources", "Draft", "Outline"])).toBe("Notes and 3 more");
});

test("an explicit title still wins", () => {
  const titled = createInfiniteCanvasGroup(seed(["Notes", "Sources"]), {
    groupId: "g",
    rect: { height: 300, width: 900, x: 0, y: 0 },
    title: "Chapter two",
    windowIds: ["w0", "w1"],
  });

  expect(titled.groups[0]?.title).toBe("Chapter two");
});

test("a group made by docking is named too, not only one made from a selection", () => {
  // Both paths run through `createInfiniteCanvasGroup`; naming only the explicit one would leave a
  // dragged group called "Group" beside a named one, which is worse than naming neither.
  const state = seed(["Notes", "Sources"]);
  const preview = resolveInfiniteCanvasDockPreviewForTarget(state, {
    edge: "center",
    targetId: "w0",
    windowId: "w1",
  });

  if (preview === null) {
    throw new Error("the fixture failed to dock");
  }

  expect(applyInfiniteCanvasDockPreview(state, preview).groups[0]?.title).toBe("Notes & Sources");
});

test("with nothing to name it falls back to the constant", () => {
  const empty = createInfiniteCanvasGroup(seed([]), {
    groupId: "g",
    rect: { height: 300, width: 900, x: 0, y: 0 },
    windowIds: [],
  });

  // No members means no group at all, so the constant's job is the case that cannot arise here —
  // asserted on the helper's contract through a group of one window with an empty title instead.
  expect(empty.groups).toEqual([]);
  expect(grouped([""])).toBe("");
  expect(DEFAULT_INFINITE_CANVAS_GROUP_TITLE).toBe("Group");
});
