import { expect, test } from "vite-plus/test";

import { executeInfiniteCanvasCommand } from "./commands";
import { createInfiniteCanvasState, createInfiniteCanvasWindow } from "./factory";
import { createInfiniteCanvasGroup, reconcileInfiniteCanvasGroups } from "./group-state";
import { getInfiniteCanvasGroupWindowIds } from "./group-tree";
import { serializeInfiniteCanvasState } from "./persistence";
import { reduceInfiniteCanvasState } from "./reducer";
import type { InfiniteCanvasRect, InfiniteCanvasState } from "./types";

/**
 * A shell left holding one member dissolves when its companion was taken away, not moved out.
 *
 * Both endings look the same in the tree — one window, no container, because
 * `normalizeInfiniteCanvasGroupTree` collapses a one-child split to its child. What differs is
 * whether anybody asked for it.
 *
 * Undocking is rearrangement. The shell is the workspace being rearranged within, and keeping it is
 * what lets a window be pulled out and another dropped back in; `acceptance-scenarios.test.ts`
 * asserts that under DOCK-006 and it still does.
 *
 * Detaching is not. The window was closed or minimized — nobody touched the group — and what is
 * left is a border, eight resize handles, a label and a footprint several times the survivor's own,
 * standing around a thing that never asked for scaffolding. Watched in the incubator on 2026-08-27:
 * archiving a note closed its pane's window and left a 544×720 shell around the one that remained,
 * still named after the note that had gone.
 */

type Kind = "demo";

const rectAt = (x: number, width = 300): InfiniteCanvasRect => ({ height: 200, width, x, y: 0 });

const twoFloating = (): InfiniteCanvasState<Kind> =>
  createInfiniteCanvasState<Kind>({
    viewport: { height: 800, width: 1200 },
    windows: [
      createInfiniteCanvasWindow({ id: "west", kind: "demo", rect: rectAt(0), title: "West" }),
      createInfiniteCanvasWindow({ id: "east", kind: "demo", rect: rectAt(400), title: "East" }),
    ],
  });

/** Two windows in one shell, by the same verb a user reaches for. */
const docked = () =>
  executeInfiniteCanvasCommand(twoFloating(), { direction: "right", type: "window.dockDirection" });

/** Closing and minimizing are reducer actions; both reach `detachInfiniteCanvasWindowFromGroups`. */
const close = (state: InfiniteCanvasState<Kind>, windowId: string) =>
  reduceInfiniteCanvasState(state, { type: "window.close", windowId });

test("closing one of two panes dissolves the shell around the survivor", () => {
  const after = close(docked(), "west");

  expect(after.groups).toEqual([]);
  expect(after.windows.map((window) => window.id)).toEqual(["east"]);
});

/**
 * The rect is not what dissolving changes, and this test exists to say so.
 *
 * The survivor ends up holding the group's whole footprint — but it does that either way, because
 * `syncInfiniteCanvasGroupWindowRects` already solves a one-member group's only pane to the shell's
 * own rect. Two attempts at asserting the rect *as evidence of dissolving* both passed with the
 * rule stubbed out, including one written specifically to bite. Only the third check found the
 * reason: the two endings agree on the number and differ solely in whether a shell remains.
 *
 * So `dissolveInfiniteCanvasDecayedGroup` writing the group rect is belt-and-braces rather than
 * the mechanism, and the tests that carry the actual claim are the two above. Kept as a
 * characterization — it pins the continuity a user sees, that nothing jumps — and labelled as one
 * rather than left looking like a regression guard it cannot be.
 */
test("the survivor holds the group's footprint, as it already did while grouped", () => {
  const before = docked();
  const groupRect = before.groups[0]?.rect;
  const after = close(before, "west").windows.find((window) => window.id === "east")?.rect;

  expect(groupRect).toBeDefined();
  expect(after).toEqual(groupRect);
});

test("minimizing one of two panes dissolves it too — the pane is just as gone", () => {
  const after = reduceInfiniteCanvasState(docked(), {
    type: "window.minimize",
    windowId: "west",
  });

  expect(after.groups).toEqual([]);
});

/**
 * The other half, and the reason this rule lives in `detach` rather than in the funnel both paths
 * share. Asserted here as well as in the acceptance file so that a change to one is visibly a
 * change to the pair, rather than to a scenario that happens to sit in a different file.
 */
test("undocking one of two panes keeps the shell, because that is rearrangement", () => {
  const after = executeInfiniteCanvasCommand(docked(), { type: "window.undock" });

  expect(after.groups).toHaveLength(1);
  expect(getInfiniteCanvasGroupWindowIds(after.groups[0]!.tree)).toEqual(["east"]);
});

/** A group built around exactly the windows named, which is the state `createGroup` offers. */
const groupOf = (windowIds: readonly string[], state = twoFloating()) =>
  createInfiniteCanvasGroup(state, {
    groupId: "made",
    rect: rectAt(0, 600),
    windowIds,
  });

test("a group deliberately made around one window is left alone", () => {
  // `createInfiniteCanvasGroup` has an explicit branch for this, so it is a state a consumer asks
  // for — a shell to dock into. Decay is "more than one member before, one after"; this is neither.
  const state = groupOf(["west"]);

  expect(state.groups).toHaveLength(1);
  expect(getInfiniteCanvasGroupWindowIds(state.groups[0]!.tree)).toEqual(["west"]);
});

test("closing a pane of a three-member group leaves a real group standing", () => {
  const three = createInfiniteCanvasState<Kind>({
    viewport: { height: 800, width: 1200 },
    windows: ["a", "b", "c"].map((id, index) =>
      createInfiniteCanvasWindow({ id, kind: "demo", rect: rectAt(index * 400), title: id }),
    ),
  });
  const after = close(groupOf(["a", "b", "c"], three), "a");

  // Two is still a group. Dissolving here would be the rule overreaching.
  expect(after.groups).toHaveLength(1);
  expect(getInfiniteCanvasGroupWindowIds(after.groups[0]!.tree)).toEqual(["b", "c"]);
});

test("closing the last member still drops the shell, as DOCK-005 always did", () => {
  expect(close(groupOf(["west"]), "west").groups).toEqual([]);
});

/**
 * Hydration cleans up one kind of residue a previous session saved, and not the other.
 *
 * The kind it reaches is a tree still *naming* a window that is gone — the window left the state
 * without going through any group verb, so the tree loses a member during the pass and that is
 * decay by the same definition `detach` uses.
 *
 * The kind it cannot reach is a tree that was already collapsed to one member before the save. The
 * pair below is the whole statement, and the second half was written after watching the first half
 * pass while the incubator's own canvas stayed wrong.
 */
test("a persisted group naming a window that no longer exists dissolves on reconciliation", () => {
  const grouped = groupOf(["west", "east"]);
  const groupRect = grouped.groups[0]?.rect;
  // The window vanishes without going through any group verb, which is what a stale layout is.
  const stale: InfiniteCanvasState<Kind> = {
    ...grouped,
    windows: grouped.windows.filter((window) => window.id !== "west"),
  };
  const after = reconcileInfiniteCanvasGroups(stale);

  expect(after.groups).toEqual([]);
  expect(after.windows.find((window) => window.id === "east")?.rect).toEqual(groupRect);
});

test("a persisted group that still has two live windows survives reconciliation", () => {
  const after = reconcileInfiniteCanvasGroups(groupOf(["west", "east"]));

  expect(after.groups).toHaveLength(1);
  expect(getInfiniteCanvasGroupWindowIds(after.groups[0]!.tree)).toEqual(["west", "east"]);
});

/**
 * The other half, and the one that is easy to read as a bug.
 *
 * A canvas saved holding a single-member shell reopens holding it. Decay is "more than one member
 * before, one after", `before` is the tree the pass received, and a tree that arrived collapsed
 * loses nothing during the pass — so the rule cannot fire, no matter how the group got that way.
 *
 * It cannot be fixed by dissolving every single-member group here, and the test below is why:
 * `undock` produces this shape on purpose under DOCK-006, `serializeInfiniteCanvasState` writes it,
 * and what it writes is indistinguishable from what a decayed shell writes. Dissolving on sight
 * would delete part of an arrangement the user made.
 *
 * Written after watching the incubator's own canvas keep a 544×720 shell around one window across
 * a full reload while every test above was green.
 */
test("a group saved already collapsed to one live member reopens still collapsed", () => {
  const after = reconcileInfiniteCanvasGroups(groupOf(["west"]));

  expect(after.groups).toHaveLength(1);
  expect(getInfiniteCanvasGroupWindowIds(after.groups[0]!.tree)).toEqual(["west"]);
});

test("an undocked shell is written to the document, which is what makes the two indistinguishable", () => {
  const undocked = executeInfiniteCanvasCommand(docked(), { type: "window.undock" });
  const stored = serializeInfiniteCanvasState(undocked).groups;

  // One member, no container — the same tree a decayed shell leaves behind.
  expect(stored).toHaveLength(1);
  expect(stored[0]?.tree).toEqual({ id: "east", kind: "window", weight: 1 });
});
