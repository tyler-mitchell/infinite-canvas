import { expect, test } from "vite-plus/test";

import {
  createInfiniteCanvasGroupWindowNode,
  dockInfiniteCanvasGroupWindow,
  equalizeInfiniteCanvasGroupChildren,
  getInfiniteCanvasGroupWindowIds,
  isInfiniteCanvasGroupContainer,
  normalizeInfiniteCanvasGroupTree,
  reorderInfiniteCanvasGroupChild,
  setInfiniteCanvasGroupLayoutMode,
  undockInfiniteCanvasGroupWindow,
} from "./group-tree";
import type { InfiniteCanvasGroupContainerNode, InfiniteCanvasGroupNode } from "./group-tree";

/**
 * C2 — the docking, split, and tab scenarios, at the primitive surface.
 *
 * SHIP_PLAN has called these "the single largest gap to an honest production" since the group
 * model shipped: `grep -l` over `src/*.test.*` returned nothing for `dockInfiniteCanvasGroupWindow`
 * or `undockInfiniteCanvasGroupWindow`, so P1 was capability-complete and verification-empty. The
 * gestures worked; nothing said so.
 *
 * Assertions follow `research/c2-test-plan.md`, which was written from a reading-audit of this
 * module and names the invariant each scenario turns on. The plan chose the primitive surface
 * over the reducer for these because the structural claims — what the tree becomes — are tightest
 * here, and the tree is pure.
 *
 * Container ids are **derived, not generated** (`${targetId}::${edge}` for a split wrapper,
 * `${windowId}::group` for a shell), which is what lets an undo replay rebuild the identical tree
 * — and what lets these tests hard-code the ids they expect.
 */

const asContainer = (node: InfiniteCanvasGroupNode | null): InfiniteCanvasGroupContainerNode => {
  expect(node).not.toBeNull();
  expect(node !== null && isInfiniteCanvasGroupContainer(node)).toBe(true);

  return node as InfiniteCanvasGroupContainerNode;
};

const windowNode = (id: string, weight = 1) => createInfiniteCanvasGroupWindowNode(id, weight);

// ── DOCK-001 — dock beside a floating window → a split shell ──────────────────────────────

test("DOCK-001: docking east of a lone window makes a horizontal split, target first", () => {
  const docked = dockInfiniteCanvasGroupWindow(windowNode("B"), {
    containerId: "B::east",
    edge: "east",
    targetId: "B",
    windowId: "A",
  });
  const container = asContainer(docked);

  expect(container.layout).toBe("split");
  expect(container.axis).toBe("horizontal");
  // East is a trailing edge, so the newcomer goes after the target.
  expect(container.children.map((child) => child.id)).toStrictEqual(["B", "A"]);
});

test("DOCK-001: a leading edge puts the newcomer first", () => {
  const container = asContainer(
    dockInfiniteCanvasGroupWindow(windowNode("B"), {
      containerId: "B::west",
      edge: "west",
      targetId: "B",
      windowId: "A",
    }),
  );

  expect(container.children.map((child) => child.id)).toStrictEqual(["A", "B"]);
});

test("DOCK-001: north/south dock on the vertical axis", () => {
  const container = asContainer(
    dockInfiniteCanvasGroupWindow(windowNode("B"), {
      containerId: "B::south",
      edge: "south",
      targetId: "B",
      windowId: "A",
    }),
  );

  expect(container.axis).toBe("vertical");
  expect(container.children.map((child) => child.id)).toStrictEqual(["B", "A"]);
});

test("DOCK-001: the pair splits the space the target held, so neighbours never move", () => {
  // The invariant under test: docking inside one pane must not resize anything outside it.
  // A target of weight 4 becomes two children of weight 2 — together still 4.
  const container = asContainer(
    dockInfiniteCanvasGroupWindow(windowNode("B", 4), {
      containerId: "B::east",
      edge: "east",
      targetId: "B",
      windowId: "A",
    }),
  );
  const total = container.children.reduce((sum, child) => sum + child.weight, 0);

  expect(total).toBeCloseTo(4);
  expect(container.children[0]?.weight).toBeCloseTo(2);
  expect(container.children[1]?.weight).toBeCloseTo(2);
});

// ── DOCK-002 — centre dock → tab merge, dropped tab active ────────────────────────────────

test("DOCK-002: docking centre makes a tab group with the dropped window active", () => {
  const container = asContainer(
    dockInfiniteCanvasGroupWindow(windowNode("B"), {
      containerId: "B::group",
      edge: "center",
      targetId: "B",
      windowId: "A",
    }),
  );

  expect(container.layout).toBe("tabs");
  expect(container.children.map((child) => child.id)).toStrictEqual(["B", "A"]);
  expect(container.activeChildId).toBe("A");
});

test("DOCK-002: a third centre dock absorbs into the strip rather than nesting", () => {
  const tabs = dockInfiniteCanvasGroupWindow(windowNode("B"), {
    containerId: "B::group",
    edge: "center",
    targetId: "B",
    windowId: "A",
  });
  const container = asContainer(
    dockInfiniteCanvasGroupWindow(tabs as InfiniteCanvasGroupNode, {
      containerId: "B::group",
      edge: "center",
      targetId: "B::group",
      windowId: "C",
    }),
  );

  // Flat three-tab strip, not a tab group inside a tab group.
  expect(container.children.map((child) => child.id)).toStrictEqual(["B", "A", "C"]);
  expect(container.activeChildId).toBe("C");
  expect(container.children.every((child) => !isInfiniteCanvasGroupContainer(child))).toBe(true);
});

// ── DOCK-004 / DOCK-005 — tear out, and empty-group cleanup ───────────────────────────────

test("DOCK-004: undocking a member leaves the rest normalized and active resolved", () => {
  const three = asContainer(
    dockInfiniteCanvasGroupWindow(
      asContainer(
        dockInfiniteCanvasGroupWindow(windowNode("B"), {
          containerId: "B::group",
          edge: "center",
          targetId: "B",
          windowId: "A",
        }),
      ),
      { containerId: "B::group", edge: "center", targetId: "B::group", windowId: "C" },
    ),
  );

  // `C` is active after the third dock; tearing it out must not leave a dangling activeChildId.
  const torn = asContainer(undockInfiniteCanvasGroupWindow(three, "C"));

  expect(torn.children.map((child) => child.id)).toStrictEqual(["B", "A"]);
  expect(torn.children.some((child) => child.id === torn.activeChildId)).toBe(true);
});

test("DOCK-005: undocking the last child returns null so the shell can be removed", () => {
  expect(undockInfiniteCanvasGroupWindow(windowNode("A"), "A")).toBeNull();
});

test("DOCK-005: undocking down to one child collapses the split to that child", () => {
  const pair = asContainer(
    dockInfiniteCanvasGroupWindow(windowNode("B"), {
      containerId: "B::east",
      edge: "east",
      targetId: "B",
      windowId: "A",
    }),
  );
  const remaining = undockInfiniteCanvasGroupWindow(pair, "A");

  // A single-child split is its child (SPLIT-003), so this is a window node again.
  expect(remaining?.id).toBe("B");
  expect(remaining !== null && isInfiniteCanvasGroupContainer(remaining)).toBe(false);
});

test("undocking a window the tree does not contain leaves it untouched", () => {
  const tree = windowNode("A");

  expect(undockInfiniteCanvasGroupWindow(tree, "nope")).toBe(tree);
});

// ── SPLIT-002 — third sibling stays flat (n-ary, no binary churn) ─────────────────────────

test("SPLIT-002: docking a third window into a same-axis split stays flat", () => {
  const pair = asContainer(
    dockInfiniteCanvasGroupWindow(windowNode("B"), {
      containerId: "B::east",
      edge: "east",
      targetId: "B",
      windowId: "A",
    }),
  );
  const three = asContainer(
    dockInfiniteCanvasGroupWindow(pair, {
      containerId: "A::east",
      edge: "east",
      targetId: "A",
      windowId: "C",
    }),
  );

  // R4's whole point: n-ary containers, so a third sibling extends the parent rather than
  // nesting a second split. Depth must not grow.
  expect(getInfiniteCanvasGroupWindowIds(three)).toStrictEqual(["B", "A", "C"]);
  expect(three.children.every((child) => !isInfiniteCanvasGroupContainer(child))).toBe(true);
});

// ── SPLIT-003 — normalization ─────────────────────────────────────────────────────────────

test("SPLIT-003: a single-child split normalizes to its child, carrying the parent weight", () => {
  const redundant: InfiniteCanvasGroupNode = {
    activeChildId: null,
    axis: "horizontal",
    children: [windowNode("A", 1)],
    id: "wrapper",
    kind: "container",
    layout: "split",
    weight: 7,
  };
  const normalized = normalizeInfiniteCanvasGroupTree(redundant);

  expect(normalized?.id).toBe("A");
  expect(normalized?.weight).toBe(7);
});

test("SPLIT-003: a one-tab group survives normalization because it is semantic", () => {
  const oneTab: InfiniteCanvasGroupNode = {
    activeChildId: "A",
    axis: "horizontal",
    children: [windowNode("A")],
    id: "tabs",
    kind: "container",
    layout: "tabs",
    weight: 1,
  };
  const normalized = normalizeInfiniteCanvasGroupTree(oneTab);

  // A one-tab group is still a tab group — collapsing it would silently destroy the strip.
  expect(normalized !== null && isInfiniteCanvasGroupContainer(normalized)).toBe(true);
  expect(asContainer(normalized).layout).toBe("tabs");
});

test("SPLIT-003: an emptied container normalizes to null", () => {
  const empty: InfiniteCanvasGroupNode = {
    activeChildId: null,
    axis: "horizontal",
    children: [],
    id: "empty",
    kind: "container",
    layout: "split",
    weight: 1,
  };

  expect(normalizeInfiniteCanvasGroupTree(empty)).toBeNull();
});

test("SPLIT-003: a same-axis split nested in a same-axis split is inlined in one pass", () => {
  const nested: InfiniteCanvasGroupNode = {
    activeChildId: null,
    axis: "horizontal",
    children: [
      windowNode("A"),
      {
        activeChildId: null,
        axis: "horizontal",
        children: [windowNode("B"), windowNode("C")],
        id: "inner",
        kind: "container",
        layout: "split",
        weight: 1,
      },
    ],
    id: "outer",
    kind: "container",
    layout: "split",
    weight: 1,
  };
  const flattened = asContainer(normalizeInfiniteCanvasGroupTree(nested));

  // One bottom-up pass must reach a fixed point — no second normalize required.
  expect(flattened.children.map((child) => child.id)).toStrictEqual(["A", "B", "C"]);
  expect(flattened.children.every((child) => !isInfiniteCanvasGroupContainer(child))).toBe(true);
});

// ── TAB-001 — reorder ─────────────────────────────────────────────────────────────────────

test("TAB-001: reordering moves a tab and preserves membership", () => {
  const three = asContainer(
    dockInfiniteCanvasGroupWindow(
      asContainer(
        dockInfiniteCanvasGroupWindow(windowNode("B"), {
          containerId: "B::group",
          edge: "center",
          targetId: "B",
          windowId: "A",
        }),
      ),
      { containerId: "B::group", edge: "center", targetId: "B::group", windowId: "C" },
    ),
  );
  const reordered = asContainer(
    reorderInfiniteCanvasGroupChild(three, { childId: "B", toIndex: 2 }),
  );

  expect(reordered.children.map((child) => child.id)).toStrictEqual(["A", "C", "B"]);
  expect(getInfiniteCanvasGroupWindowIds(reordered).toSorted()).toStrictEqual(["A", "B", "C"]);
});

test("TAB-001: an out-of-range or non-finite index is clamped rather than corrupting order", () => {
  const pair = asContainer(
    dockInfiniteCanvasGroupWindow(windowNode("B"), {
      containerId: "B::group",
      edge: "center",
      targetId: "B",
      windowId: "A",
    }),
  );

  expect(
    asContainer(reorderInfiniteCanvasGroupChild(pair, { childId: "B", toIndex: 99 })).children.map(
      (child) => child.id,
    ),
  ).toStrictEqual(["A", "B"]);
  // A non-finite index lands at the END, not at zero — `clampIndex` returns
  // `lastInsertableIndex` for it deliberately. Encoded here rather than assumed: this assertion
  // originally guessed zero and failed, and the code was the correct half of that disagreement.
  expect(
    asContainer(
      reorderInfiniteCanvasGroupChild(pair, { childId: "B", toIndex: Number.NaN }),
    ).children.map((child) => child.id),
  ).toStrictEqual(["A", "B"]);
  // Negative indices clamp to the front, which is the other end of the same guard.
  expect(
    asContainer(reorderInfiniteCanvasGroupChild(pair, { childId: "A", toIndex: -5 })).children.map(
      (child) => child.id,
    ),
  ).toStrictEqual(["A", "B"]);
});

// ── TAB-002 — mode round-trip preserves membership and weights ────────────────────────────

test("TAB-002: tabs → accordion → tabs preserves children, order, and weights", () => {
  const tabs = asContainer(
    dockInfiniteCanvasGroupWindow(windowNode("B", 3), {
      containerId: "B::group",
      edge: "center",
      targetId: "B",
      windowId: "A",
    }),
  );
  const asAccordion = asContainer(
    setInfiniteCanvasGroupLayoutMode(tabs, { containerId: "B::group", layout: "accordion" }),
  );
  const backToTabs = asContainer(
    setInfiniteCanvasGroupLayoutMode(asAccordion, { containerId: "B::group", layout: "tabs" }),
  );

  expect(asAccordion.layout).toBe("accordion");
  expect(backToTabs.layout).toBe("tabs");
  // Weights ride along even while tabs and accordion ignore them, so a later conversion to
  // `split` restores the proportions the user last set rather than resetting them.
  expect(backToTabs.children.map((child) => [child.id, child.weight])).toStrictEqual(
    tabs.children.map((child) => [child.id, child.weight]),
  );
});

// ── SPLIT-005 — equalize: undo accumulated seam drags ────────────────────────────────────

/**
 * `equalizeInfiniteCanvasGroupChildren` — the arrange verb for docked panes, added on
 * 2026-08-12.
 *
 * Seam drags are lossy in one direction: every drag records new weights and nothing
 * remembers what they were before, so a shell that has been resized a few times can only
 * be returned to even panes by dragging each seam back by eye. Align and distribute give
 * floating windows a one-shot way out of that; docked panes had none.
 */

const splitOf = (
  childIds: readonly string[],
  weights: readonly number[],
): InfiniteCanvasGroupNode =>
  asContainer(
    normalizeInfiniteCanvasGroupTree({
      activeChildId: null,
      axis: "horizontal",
      children: childIds.map((id, index) => windowNode(id, weights[index] ?? 1)),
      id: "root",
      kind: "container",
      layout: "split",
      weight: 1,
    }),
  );

test("SPLIT-005: equalizing returns skewed panes to identical weights", () => {
  const equalized = asContainer(
    equalizeInfiniteCanvasGroupChildren(splitOf(["A", "B", "C"], [7, 1, 4]), "root"),
  );

  expect(new Set(equalized.children.map((child) => child.weight)).size).toBe(1);
});

test("SPLIT-005: equalizing is idempotent", () => {
  // The verb has to be safe to invoke on an already-even split — a palette does not know
  // whether the user dragged a seam since last time.
  const once = asContainer(
    equalizeInfiniteCanvasGroupChildren(splitOf(["A", "B"], [3, 1]), "root"),
  );
  const twice = equalizeInfiniteCanvasGroupChildren(once, "root");

  expect(asContainer(twice).children.map((child) => child.weight)).toStrictEqual(
    once.children.map((child) => child.weight),
  );
});

test("SPLIT-005: equalizing a container leaves a nested container's own weights alone", () => {
  // The verb names one container. Recursing would make it a whole-tree "balance", which is a
  // coarser gesture than the user asked for by focusing one pane.
  const nested = asContainer(
    normalizeInfiniteCanvasGroupTree({
      activeChildId: null,
      axis: "horizontal",
      children: [
        windowNode("A", 5),
        {
          activeChildId: null,
          axis: "vertical",
          children: [windowNode("B", 9), windowNode("C", 1)],
          id: "inner",
          kind: "container",
          layout: "split",
          weight: 1,
        },
      ],
      id: "root",
      kind: "container",
      layout: "split",
      weight: 1,
    }),
  );
  const equalized = asContainer(equalizeInfiniteCanvasGroupChildren(nested, "root"));
  const inner = equalized.children.find((child) => child.id === "inner");

  expect(new Set(equalized.children.map((child) => child.weight)).size).toBe(1);
  expect(asContainer(inner ?? null).children.map((child) => child.weight)).toStrictEqual([9, 1]);
});

test("SPLIT-005: equalizing an unknown container id changes nothing", () => {
  const tree = splitOf(["A", "B"], [3, 1]);

  expect(asContainer(equalizeInfiniteCanvasGroupChildren(tree, "absent")).children).toStrictEqual(
    asContainer(tree).children,
  );
});
