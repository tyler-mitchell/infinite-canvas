import { getSelectedWindowIds } from "./selection";
import { expect, test } from "vite-plus/test";

import { createInfiniteCanvasState, createInfiniteCanvasWindow } from "./factory";
import { isInfiniteCanvasCommandEnabled, reduceInfiniteCanvasState } from "./operations";
import { getInfiniteCanvasGroupWindowIds } from "./group-tree";
import type { InfiniteCanvasState } from "./types";
import { canvasModel } from "./schema";

type Kind = "note";

test("grouping a maximized window produces a valid normal window", () => {
  const state = withShell();
  const maximized = {
    ...state,
    windows: state.windows.map((window) =>
      window.id === "c"
        ? { ...window, mode: "maximized" as const, restoreRect: window.rect }
        : window,
    ),
  };
  const made = group(maximized, ["c"]);
  const member = made.windows.find(({ id }) => id === "c");
  expect(member?.mode).toBe("normal");
  expect(member).not.toHaveProperty("restoreRect");
  expect(canvasModel.Window.allows(member)).toBe(true);
});

test.each([
  { type: "activeWindow.close" },
  { type: "activeWindow.minimize" },
  { type: "activeWindow.toggleMaximized" },
  { type: "activeWindow.togglePinned" },
  { type: "window.undock" },
  { type: "group.resizePane", amountPx: 24 },
  { type: "group.moveChild", toward: "end" },
  { type: "window.place", region: "left" },
] as const)("group selection disables the window action $type", (command) => {
  const state = withShell();
  const selected = reduceInfiniteCanvasState(
    { ...state, activeWindowId: "a" },
    {
      type: "selection.replace",
      targets: [{ id: state.groups[0]!.id, type: "group", kind: "group" }],
    },
  );
  expect(isInfiniteCanvasCommandEnabled(selected, command)).toBe(false);
  expect(reduceInfiniteCanvasState(selected, command)).toBe(selected);
});

test("a window action uses the selected window when the active window is stale", () => {
  const state = withShell();
  const selected = {
    ...state,
    activeWindowId: "a",
    selection: {
      anchorTarget: { type: "window" as const, id: "c" },
      targets: [{ type: "window" as const, id: "c" }],
    },
  };
  const closed = reduceInfiniteCanvasState(selected, { type: "activeWindow.close" });
  expect(closed.windows.map(({ id }) => id)).toEqual(["a", "b", "d"]);
});

const pane = (id: string, x: number) =>
  createInfiniteCanvasWindow<Kind>({
    id,
    kind: "note",
    minSize: { height: 80, width: 120 },
    rect: { height: 200, width: 300, x, y: 0 },
    title: id,
  });

const shellRect = { height: 400, width: 900, x: 0, y: 0 };

const withShell = (): InfiniteCanvasState<Kind> => {
  const base = {
    ...createInfiniteCanvasState<Kind>({
      windows: [pane("a", 0), pane("b", 400), pane("c", 800), pane("d", 1200)],
    }),
    viewport: { height: 800, width: 1600 },
  };
  const docked = reduceInfiniteCanvasState(
    { ...base, activeWindowId: "a" },
    { direction: "right", type: "window.dockDirection" },
  );

  expect(docked.groups).toHaveLength(1);

  return docked;
};

const group = (state: InfiniteCanvasState<Kind>, windowIds: readonly string[]) =>
  reduceInfiniteCanvasState(state, {
    groupId: "made",
    rect: shellRect,
    type: "group.create",
    windowIds,
  });

test("grouping two floating windows makes a group", () => {
  const made = group(withShell(), ["c", "d"]);

  expect(made.groups).toHaveLength(2);
});

test("regrouping docked windows replaces their membership without duplicates", () => {
  const before = withShell();
  const after = group(before, ["a", "b"]);

  expect(after.groups).toHaveLength(1);
  expect(after.groups[0]?.id).toBe("made");
  expect(getInfiniteCanvasGroupWindowIds(after.groups[0]!.tree)).toEqual(["a", "b"]);
  expect(after.windows.map(({ id }) => id)).toEqual(before.windows.map(({ id }) => id));
});

test("a mixed selection regroups selected members and preserves other windows", () => {
  const made = group(withShell(), ["a", "c", "d"]);
  const added = made.groups.find((candidate) => candidate.id === "made");

  expect(added).toBeDefined();
  expect(getInfiniteCanvasGroupWindowIds(added!.tree)).toEqual(["a", "c", "d"]);
  expect(made.windows.map(({ id }) => id)).toEqual(["a", "b", "c", "d"]);
});

test("one free window can form a group", () => {
  const made = group(withShell(), ["c"]);

  expect(made.groups).toHaveLength(2);
});

test("the group command creates and selects a group in one state transition", () => {
  const selected = reduceInfiniteCanvasState(withShell(), {
    type: "selection.replace",
    targets: [
      { type: "window" as const, id: "c" },
      { type: "window" as const, id: "d" },
    ],
  });
  expect(isInfiniteCanvasCommandEnabled(selected, { type: "selection.group" })).toBe(true);
  const made = reduceInfiniteCanvasState(selected, { type: "selection.group", groupId: "made" });
  expect(
    getInfiniteCanvasGroupWindowIds(made.groups.find(({ id }) => id === "made")!.tree),
  ).toEqual(["c", "d"]);
  expect(getSelectedWindowIds(made.selection)).toEqual([]);
  expect(made.selection.targets).toEqual([{ id: "made", type: "group", kind: "group" }]);
  expect(isInfiniteCanvasCommandEnabled(made, { type: "selection.group" })).toBe(false);
});

test("group creation rejects an existing id without changing membership", () => {
  const selected = reduceInfiniteCanvasState(withShell(), {
    type: "selection.replace",
    targets: [
      { type: "window" as const, id: "c" },
      { type: "window" as const, id: "d" },
    ],
  });
  const groupId = selected.groups[0]!.id;
  expect(isInfiniteCanvasCommandEnabled(selected, { type: "selection.group", groupId })).toBe(
    false,
  );
  expect(reduceInfiniteCanvasState(selected, { type: "selection.group", groupId })).toBe(selected);
});

test("group layout actions follow selected windows instead of an old active window", () => {
  const state = withShell();
  const selected = {
    ...state,
    activeWindowId: "a",
    selection: {
      anchorTarget: { type: "window" as const, id: "c" },
      targets: [{ type: "window" as const, id: "c" }],
    },
  };
  expect(
    isInfiniteCanvasCommandEnabled(selected, { type: "group.setLayout", layout: "tabs" }),
  ).toBe(false);
  expect(
    reduceInfiniteCanvasState(selected, { type: "group.setLayout", layout: "tabs" }).groups,
  ).toEqual(state.groups);
  expect(isInfiniteCanvasCommandEnabled(selected, { type: "group.dissolve" })).toBe(false);
  expect(reduceInfiniteCanvasState(selected, { type: "group.dissolve" }).groups).toEqual(
    state.groups,
  );
});

test("fit and dissolve accept a selected single-window group", () => {
  const state = group(withShell(), ["c"]);
  const selected = reduceInfiniteCanvasState(state, {
    type: "selection.replace",
    targets: [{ id: "made", type: "group", kind: "group" }],
  });
  expect(isInfiniteCanvasCommandEnabled(selected, { type: "group.fitContents" })).toBe(true);
  const fitted = reduceInfiniteCanvasState(selected, { type: "group.fitContents" });
  expect(fitted.groups.find(({ id }) => id === "made")?.bounds).toBe("content");
  expect(isInfiniteCanvasCommandEnabled(fitted, { type: "group.dissolve" })).toBe(true);
  const dissolved = reduceInfiniteCanvasState(fitted, { type: "group.dissolve" });
  expect(dissolved.groups.some(({ id }) => id === "made")).toBe(false);
  expect(dissolved.windows.map(({ id }) => id)).toEqual(state.windows.map(({ id }) => id));
});

test.each(["tabs", "accordion", "masonry"] as const)(
  "a single-window group can change to %s and back",
  (layout) => {
    const state = group(withShell(), ["c"]);
    const selected = reduceInfiniteCanvasState(state, {
      type: "selection.replace",
      targets: [{ id: "made", type: "group", kind: "group" }],
    });
    expect(isInfiniteCanvasCommandEnabled(selected, { type: "group.setLayout", layout })).toBe(
      true,
    );
    const changed = reduceInfiniteCanvasState(selected, { type: "group.setLayout", layout });
    expect(changed.groups.find(({ id }) => id === "made")?.tree).toMatchObject({
      kind: "container",
      layout,
    });
    const restored = reduceInfiniteCanvasState(changed, {
      type: "group.setLayout",
      layout: "split",
    });
    expect(restored.groups.find(({ id }) => id === "made")?.tree).toMatchObject({
      kind: "window",
      id: "c",
    });
  },
);

test("a selected group supplies the layout action target", () => {
  const state = withShell();
  const selected = reduceInfiniteCanvasState(
    { ...state, activeWindowId: "d" },
    {
      type: "selection.replace",
      targets: [{ type: "group", kind: "group", id: state.groups[0]!.id }],
    },
  );
  expect(
    isInfiniteCanvasCommandEnabled(selected, { type: "group.setLayout", layout: "tabs" }),
  ).toBe(true);
  const changed = reduceInfiniteCanvasState(selected, { type: "group.setLayout", layout: "tabs" });
  expect(changed.groups[0]!.tree).toMatchObject({ layout: "tabs" });
});
