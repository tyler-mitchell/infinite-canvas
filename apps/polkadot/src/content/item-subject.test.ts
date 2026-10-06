import {
  createInfiniteCanvasState,
  createInfiniteCanvasWindow,
  type InfiniteCanvasState,
} from "@hyphened/infinite-canvas/legacy";
import { expect, test } from "vite-plus/test";

import type { WindowKind } from "../canvas/window-registry";
import type { ContentItemRecord } from "../database/database.client";
import { describeProjectContent } from "./describe-content";
import type { ProjectContent } from "./project-content";

const item = (id: string, kind: string, title: string, content: object = {}) =>
  ({
    archived: false,
    content,
    id,
    kind,
    projectId: "project-1",
    title,
  }) as unknown as ContentItemRecord;

const empty = createInfiniteCanvasState<WindowKind>({
  viewport: { height: 800, width: 1200 },
  windows: [],
});

const describe = (
  items: readonly ContentItemRecord[],
  state: InfiniteCanvasState<WindowKind> = empty,
) =>
  describeProjectContent({
    listing: { items, projectId: "project-1" } as ProjectContent,
    projectId: "project-1",
    relations: [],
    state,
  });

test("a collection says which kind it lists, so a renamed one is still legible", () => {
  const described = describe([
    item("c1", "collection", "Reading list", { listsKind: "link" }),
    item("n1", "note", "Quarterly notes"),
  ]);

  expect(described).toContain('collection "Reading list" [c1] (lists every link in this project)');
  expect(described).toContain('note "Quarterly notes" [n1]');
  expect(described).not.toContain('Quarterly notes" [n1] (');
});

test("a connected-to collection names its subject by title, in the listing's own vocabulary", () => {
  const described = describe([
    item("c2", "collection", "Around the review", { connectedTo: "n1" }),
    item("n1", "note", "Quarterly notes"),
  ]);

  expect(described).toContain('lists what "Quarterly notes" connects to');
});

test("a subject the listing does not hold falls back to its id rather than vanishing", () => {
  expect(describe([item("c3", "collection", "Orphaned", { connectedTo: "gone" })])).toContain(
    "lists what [gone] connects to",
  );
});

test("open-state and subject read together rather than one replacing the other", () => {
  const showing = createInfiniteCanvasState<WindowKind>({
    viewport: { height: 800, width: 1200 },
    windows: [
      createInfiniteCanvasWindow<WindowKind, { itemId: string }>({
        data: { itemId: "c4" },
        id: "w1",
        kind: "collection",
        rect: { height: 200, width: 320, x: 0, y: 0 },
        title: "Links",
      }),
    ],
  });

  expect(describe([item("c4", "collection", "Links", { listsKind: "link" })], showing)).toContain(
    "[c4] (open, lists every link in this project)",
  );
});

test("a link says where it points, which its title often does not", () => {
  expect(
    describe([
      item("l1", "link", "Infinite Canvas — Docs", {
        host: "example.com",
        url: "https://example.com/docs/canvas?v=2",
      }),
    ]),
  ).toContain('link "Infinite Canvas — Docs" [l1] (points at https://example.com/docs/canvas?v=2)');
});

test("an image says how it is described, which is the only words a picture has", () => {
  expect(
    describe([
      item("i1", "image", "Reference", {
        description: "whiteboard, March",
        source: "data:image/png;base64,AAAA",
      }),
    ]),
  ).toContain('image "Reference" [i1] (described as "whiteboard, March")');
});

test("a note says nothing extra, because its content is not a phrase", () => {
  expect(describe([item("n2", "note", "Quarterly notes")])).toContain(
    'note "Quarterly notes" [n2].',
  );
});

test("a collection whose stored question cannot be read is still listed", () => {
  const described = describe([item("c5", "collection", "Broken", { nonsense: true })]);

  expect(described).toContain('collection "Broken" [c5]');
  expect(described).not.toContain("lists");
});
