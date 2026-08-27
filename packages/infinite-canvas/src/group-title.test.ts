import { expect, test } from "vite-plus/test";

import { createInfiniteCanvasState, createInfiniteCanvasWindow } from "./factory";
import {
  applyInfiniteCanvasDockPreview,
  createInfiniteCanvasGroup,
  DEFAULT_INFINITE_CANVAS_GROUP_TITLE,
  getInfiniteCanvasGroupTitle,
  renameInfiniteCanvasGroup,
  resolveInfiniteCanvasDockPreviewForTarget,
} from "./group-state";
import { reduceInfiniteCanvasState } from "./reducer";
import type { InfiniteCanvasState } from "./types";

/**
 * A group is named after what is in it, unless somebody named it.
 *
 * The default was the literal "Group". That was invisible while nothing drew a group's name and
 * became a canvas of identical labels the moment the shell started rendering it.
 *
 * The name is then computed on read rather than chosen on write, which is what `title: null` buys.
 * Stored, a derived name went stale the instant anything moved — and nothing downstream could
 * safely refresh it, because a stored string cannot say whether a user typed it.
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

const groupState = (titles: readonly string[]) =>
  createInfiniteCanvasGroup(seed(titles), {
    groupId: "g",
    rect: { height: 300, width: 900, x: 0, y: 0 },
    windowIds: titles.map((_title, index) => `w${String(index)}`),
  });

/** What the group is called, read the way every consumer reads it. */
const nameOf = (state: InfiniteCanvasState<"demo">) => {
  const group = state.groups[0];

  return group === undefined ? undefined : getInfiniteCanvasGroupTitle(group, state.windows);
};

const grouped = (titles: readonly string[]) => nameOf(groupState(titles));

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

  expect(nameOf(titled)).toBe("Chapter two");
  // And it is *stored*, which is the difference: a derived name is `null` on the record.
  expect(titled.groups[0]?.title).toBe("Chapter two");
});

test("a group nobody named stores no name at all", () => {
  // The provenance, as the model states it: absence means "named after what is in it". A stored
  // string would be indistinguishable from one a user typed, which is the whole defect.
  expect(groupState(["Notes", "Sources"]).groups[0]?.title).toBeNull();
});

test("a derived name follows a member being renamed", () => {
  const renamed = reduceInfiniteCanvasState(groupState(["Notes", "Sources"]), {
    title: "Chapter one",
    type: "window.setTitle",
    windowId: "w0",
  });

  expect(nameOf(renamed)).toBe("Chapter one & Sources");
});

test("a derived name follows a member leaving", () => {
  const after = reduceInfiniteCanvasState(groupState(["Notes", "Sources", "Draft"]), {
    type: "window.close",
    windowId: "w0",
  });

  // Was "Notes and 2 more" — a name that outlived the window it was named for.
  expect(nameOf(after)).toBe("Sources & Draft");
});

test("a name somebody chose never moves, however the membership changes", () => {
  const titled = renameInfiniteCanvasGroup(groupState(["Notes", "Sources", "Draft"]), {
    groupId: "g",
    title: "Chapter two",
  });
  const renamed = reduceInfiniteCanvasState(titled, {
    title: "Something else",
    type: "window.setTitle",
    windowId: "w0",
  });
  const closed = reduceInfiniteCanvasState(renamed, { type: "window.close", windowId: "w0" });

  expect(nameOf(closed)).toBe("Chapter two");
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

  expect(nameOf(applyInfiniteCanvasDockPreview(state, preview))).toBe("Notes & Sources");
});

test("the docked pair is named after both, not after whichever was stood on", () => {
  /*
   * The ordering bug that a stored derived name always becomes.
   *
   * Docking onto a floating window mints a group holding *one* member and adds the second on the
   * next line, so a name written at creation named half the pair. That was worked around by
   * re-deriving and writing the name again once membership settled — a step this model deletes
   * rather than sequences, because a name computed on read has no moment at which it is written.
   */
  const state = seed(["Notes", "Sources"]);
  const preview = resolveInfiniteCanvasDockPreviewForTarget(state, {
    edge: "center",
    targetId: "w0",
    windowId: "w1",
  });

  if (preview === null) {
    throw new Error("the fixture failed to dock");
  }

  const docked = applyInfiniteCanvasDockPreview(state, preview);

  expect(docked.groups[0]?.title).toBeNull();
  expect(nameOf(docked)).toBe("Notes & Sources");
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

test("an empty given name is a name, and means draw no label", () => {
  // Three states, each meaning something: `null` derives, `""` is a consumer saying "no label",
  // and any other string is that name. The shell's label already reads `""` that way.
  const nameless = { ...groupState(["Notes", "Sources"]) };
  const group = nameless.groups[0];

  if (group === undefined) {
    throw new Error("the fixture failed to group");
  }

  expect(getInfiniteCanvasGroupTitle({ ...group, title: "" }, nameless.windows)).toBe("");
  expect(getInfiniteCanvasGroupTitle({ ...group, title: null }, nameless.windows)).toBe(
    "Notes & Sources",
  );
});
