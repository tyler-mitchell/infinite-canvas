import { expect, test } from "vite-plus/test";

import {
  createInfiniteCanvasGroupWindowNode,
  dockInfiniteCanvasGroupWindow,
  getInfiniteCanvasGroupWindowIds,
  isInfiniteCanvasGroupContainer,
  normalizeInfiniteCanvasGroupTree,
  reorderInfiniteCanvasGroupChild,
  setInfiniteCanvasGroupLayoutMode,
  undockInfiniteCanvasGroupWindow,
} from "./group-tree";
import type { InfiniteCanvasGroupContainerNode, InfiniteCanvasGroupNode } from "./group-tree";

const asContainer = (node: InfiniteCanvasGroupNode | null): InfiniteCanvasGroupContainerNode => {
  expect(node).not.toBeNull();
  expect(node !== null && isInfiniteCanvasGroupContainer(node)).toBe(true);

  return node as InfiniteCanvasGroupContainerNode;
};

const windowNode = (id: string, weight = 1) => createInfiniteCanvasGroupWindowNode(id, weight);

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

  expect(container.children.map((child) => child.id)).toStrictEqual(["B", "A", "C"]);
  expect(container.activeChildId).toBe("C");
  expect(container.children.every((child) => !isInfiniteCanvasGroupContainer(child))).toBe(true);
});

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

  expect(remaining?.id).toBe("B");
  expect(remaining !== null && isInfiniteCanvasGroupContainer(remaining)).toBe(false);
});

test("undocking a window the tree does not contain leaves it untouched", () => {
  const tree = windowNode("A");

  expect(undockInfiniteCanvasGroupWindow(tree, "nope")).toBe(tree);
});

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

  expect(getInfiniteCanvasGroupWindowIds(three)).toStrictEqual(["B", "A", "C"]);
  expect(three.children.every((child) => !isInfiniteCanvasGroupContainer(child))).toBe(true);
});

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

  expect(flattened.children.map((child) => child.id)).toStrictEqual(["A", "B", "C"]);
  expect(flattened.children.every((child) => !isInfiniteCanvasGroupContainer(child))).toBe(true);
});

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
  expect(
    asContainer(
      reorderInfiniteCanvasGroupChild(pair, { childId: "B", toIndex: Number.NaN }),
    ).children.map((child) => child.id),
  ).toStrictEqual(["A", "B"]);
  expect(
    asContainer(reorderInfiniteCanvasGroupChild(pair, { childId: "A", toIndex: -5 })).children.map(
      (child) => child.id,
    ),
  ).toStrictEqual(["A", "B"]);
});

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
  expect(backToTabs.children.map((child) => [child.id, child.weight])).toStrictEqual(
    tabs.children.map((child) => [child.id, child.weight]),
  );
});

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
    setInfiniteCanvasGroupChildWeights(splitOf(["A", "B", "C"], [7, 1, 4]), {
      containerId: "root",
      weights: { A: 1, B: 1, C: 1 },
    }),
  );

  expect(new Set(equalized.children.map((child) => child.weight)).size).toBe(1);
});

test("SPLIT-005: equalizing is idempotent", () => {
  const once = asContainer(
    setInfiniteCanvasGroupChildWeights(splitOf(["A", "B"], [3, 1]), {
      containerId: "root",
      weights: { A: 1, B: 1 },
    }),
  );
  const twice = setInfiniteCanvasGroupChildWeights(once, {
    containerId: "root",
    weights: { A: 1, B: 1 },
  });

  expect(asContainer(twice).children.map((child) => child.weight)).toStrictEqual(
    once.children.map((child) => child.weight),
  );
});

test("SPLIT-005: equalizing a container leaves a nested container's own weights alone", () => {
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
  const equalized = asContainer(
    setInfiniteCanvasGroupChildWeights(nested, {
      containerId: "root",
      weights: { A: 1, inner: 1 },
    }),
  );
  const inner = equalized.children.find((child) => child.id === "inner");

  expect(new Set(equalized.children.map((child) => child.weight)).size).toBe(1);
  expect(asContainer(inner ?? null).children.map((child) => child.weight)).toStrictEqual([9, 1]);
});

test("SPLIT-005: equalizing an unknown container id changes nothing", () => {
  const tree = splitOf(["A", "B"], [3, 1]);

  expect(
    asContainer(
      setInfiniteCanvasGroupChildWeights(tree, { containerId: "absent", weights: { A: 1, B: 1 } }),
    ).children,
  ).toStrictEqual(asContainer(tree).children);
});
import { setInfiniteCanvasGroupChildWeights } from "./group-tree";
