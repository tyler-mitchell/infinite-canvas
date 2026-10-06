import {
  createInfiniteCanvasState,
  createInfiniteCanvasWindow,
} from "@hyphened/infinite-canvas/legacy";
import { expect, test } from "vite-plus/test";

import type { WindowKind } from "../canvas/window-registry";
import type { ContentItemRecord, ContentRelation } from "../database/database.client";
import { describeProjectContent } from "./describe-content";
import type { ProjectContent } from "./project-content";

const item = (id: string, kind: string, title: string) =>
  ({ archived: false, id, kind, projectId: "project-1", title }) as unknown as ContentItemRecord;

const listing: ProjectContent = {
  items: [item("one", "note", "Quarterly notes"), item("two", "image", "swatch.png")],
  projectId: "project-1",
};

const stateShowing = (itemIds: readonly string[]) =>
  createInfiniteCanvasState<WindowKind>({
    viewport: { height: 800, width: 1200 },
    windows: itemIds.map((itemId, index) =>
      createInfiniteCanvasWindow<WindowKind, { itemId: string }>({
        data: { itemId },
        id: `window-${index}`,
        kind: "note",
        rect: { height: 200, width: 320, x: index * 400, y: 0 },
        title: itemId,
      }),
    ),
  });

test("nothing loaded yet is not the same answer as an empty project", () => {
  expect(
    describeProjectContent({
      listing: null,
      projectId: "project-1",
      relations: [],
      state: stateShowing([]),
    }),
  ).toBe("The project's content has not loaded yet.");
  expect(
    describeProjectContent({
      listing: { items: [], projectId: "project-1" },
      projectId: "project-1",
      relations: [],
      state: stateShowing([]),
    }),
  ).toBe("This project holds nothing yet.");
});

test("a listing belonging to another project reads as not loaded, never as that project's", () => {
  expect(
    describeProjectContent({
      listing,
      projectId: "project-2",
      relations: [],
      state: stateShowing([]),
    }),
  ).toBe("The project's content has not loaded yet.");
});

test("every item is named by kind and title", () => {
  const described = describeProjectContent({
    listing,
    projectId: "project-1",
    relations: [],
    state: stateShowing([]),
  });

  expect(described).toContain('note "Quarterly notes"');
  expect(described).toContain('image "swatch.png"');
});

test("every item carries the id that content.open takes, or the listing cannot be ordered from", () => {
  const described = describeProjectContent({
    listing,
    projectId: "project-1",
    relations: [],
    state: stateShowing([]),
  });

  expect(described).toContain("[one]");
  expect(described).toContain("[two]");
});

test("items already on the canvas are marked, and the rest are counted", () => {
  const described = describeProjectContent({
    listing,
    projectId: "project-1",
    relations: [],
    state: stateShowing(["one"]),
  });

  expect(described).toContain('note "Quarterly notes" [one] (open)');
  expect(described).not.toContain("[two] (open)");
  expect(described).toContain("2 item(s), 1 not open");
});

const relation = (source: string, target: string, kind: string, label?: string) =>
  ({ id: `${source}-${target}`, kind, label, source, target }) as ContentRelation;

const describeWith = (relations: readonly ContentRelation[]) =>
  describeProjectContent({ listing, projectId: "project-1", relations, state: stateShowing([]) });

test("a project with no edges says so, rather than saying nothing about edges", () => {
  expect(describeWith([])).toContain("No connections.");
});

test("edges that have not loaded are not reported as no edges", () => {
  const described = describeProjectContent({
    listing,
    projectId: "project-1",
    relations: null,
    state: stateShowing([]),
  });

  expect(described).toContain("The project's connections have not loaded yet.");
  expect(described).not.toContain("No connections.");
});

test("a connection names both ends by the handle content.open takes", () => {
  const described = describeWith([relation("one", "two", "supports")]);

  expect(described).toContain(
    '1 connection(s): "Quarterly notes" [one] supports "swatch.png" [two]',
  );
});

test("the stored order is kept, because the kinds are not symmetric", () => {
  // Relation meaning follows the stored source and target order.
  expect(describeWith([relation("two", "one", "supports")])).toContain(
    '"swatch.png" [two] supports "Quarterly notes" [one]',
  );
});

test("a written label wins over the kind, the way the drawn connector reads it", () => {
  expect(describeWith([relation("one", "two", "contradicts", "blocks the review")])).toContain(
    '"Quarterly notes" [one] blocks the review "swatch.png" [two]',
  );
});

test("the default kind is named rather than hidden", () => {
  expect(describeWith([relation("one", "two", "relates")])).toContain("[one] relates ");
});

test("an edge to something the listing does not hold is still reported", () => {
  const described = describeWith([relation("one", "gone", "refines")]);

  expect(described).toContain('"Quarterly notes" [one] refines [gone]');
});

const stateSelecting = (relationId: string) =>
  createInfiniteCanvasState<WindowKind>({
    selection: {
      anchorTarget: { id: relationId, kind: "relation", type: "edge" },
      targets: [{ id: relationId, kind: "relation", type: "edge" }],
    },
    viewport: { height: 800, width: 1200 },
    windows: [],
  });

test("the selected connection is marked, and only that one", () => {
  const described = describeProjectContent({
    listing,
    projectId: "project-1",
    relations: [relation("one", "two", "supports"), relation("two", "one", "refines")],
    state: stateSelecting("one-two"),
  });

  expect(described).toContain('"Quarterly notes" [one] supports "swatch.png" [two] (selected)');
  expect(described).toContain('"swatch.png" [two] refines "Quarterly notes" [one]');
  expect(described).not.toContain("[one] (selected)");
});

test("nothing selected marks nothing, rather than saying so on every line", () => {
  expect(describeWith([relation("one", "two", "supports")])).not.toContain("selected");
});
