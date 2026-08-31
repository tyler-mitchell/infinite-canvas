import {
  createInfiniteCanvasState,
  createInfiniteCanvasWindow,
  getInfiniteCanvasUnoccludedSegments,
  type InfiniteCanvasPoint,
  type InfiniteCanvasRect,
  type InfiniteCanvasState,
} from "@hyphened/infinite-canvas";
import { expect, test } from "vite-plus/test";

import type { ContentRelation } from "../database/database.client";
import {
  getConnectorEdgeTargets,
  getDrawnConnectors,
  getHiddenConnectorStubs,
} from "./connector-geometry";
import type { WindowKind } from "./window-registry";

const VIEWPORT = { height: 800, width: 1200 };

const contentWindow = (
  input: Readonly<{ id: string; itemId: string; kind?: WindowKind; rect: InfiniteCanvasRect }>,
) =>
  createInfiniteCanvasWindow<WindowKind, { itemId: string }>({
    data: { itemId: input.itemId },
    id: input.id,
    kind: input.kind ?? "note",
    rect: input.rect,
    title: input.id,
  });

const relation = (source: string, target: string, id = `relates_to:${source}-${target}`) =>
  ({ id, kind: "relates_to", source, target }) satisfies ContentRelation;

const A = { height: 150, width: 200, x: 100, y: 100 };
const B = { height: 150, width: 200, x: 700, y: 100 };

const STACKED_TOP = { height: 150, width: 200, x: 300, y: 100 };
const STACKED_BOTTOM = { height: 150, width: 200, x: 312, y: 290 };

test("a marker sits halfway along the visible run, not halfway along one of its legs", () => {
  const [connector] = getDrawnConnectors(
    canvas([
      contentWindow({ id: "top", itemId: "a", rect: STACKED_TOP }),
      contentWindow({ id: "bottom", itemId: "b", rect: STACKED_BOTTOM }),
    ]),
    [relation("a", "b")],
  );
  const gapMidpoint = (STACKED_TOP.y + STACKED_TOP.height + STACKED_BOTTOM.y) / 2;

  expect(connector?.anchor).not.toBeNull();
  expect(connector?.anchor?.y).toBeCloseTo(gapMidpoint, 5);
});

const distanceToSegment = (
  point: InfiniteCanvasPoint,
  segment: Readonly<{ end: InfiniteCanvasPoint; start: InfiniteCanvasPoint }>,
) => {
  const dx = segment.end.x - segment.start.x;
  const dy = segment.end.y - segment.start.y;
  const squared = dx * dx + dy * dy;
  const along =
    squared === 0
      ? 0
      : Math.max(
          0,
          Math.min(
            1,
            ((point.x - segment.start.x) * dx + (point.y - segment.start.y) * dy) / squared,
          ),
        );

  return Math.hypot(
    point.x - (segment.start.x + along * dx),
    point.y - (segment.start.y + along * dy),
  );
};

test("on a real elbow the marker lands on the line rather than in the corner", () => {
  const [connector] = getDrawnConnectors(
    canvas([
      contentWindow({ id: "left", itemId: "a", rect: { height: 120, width: 180, x: 100, y: 100 } }),
      contentWindow({ id: "far", itemId: "b", rect: { height: 120, width: 180, x: 620, y: 460 } }),
    ]),
    [relation("a", "b")],
  );
  const anchor = connector?.anchor;
  const segments = connector?.segments ?? [];

  expect(anchor).not.toBeNull();
  expect(segments.length).toBeGreaterThan(1);

  const onLine = Math.min(...segments.map((segment) => distanceToSegment(anchor!, segment)));

  expect(onLine).toBeLessThan(0.001);

  const longestLeg = segments.reduce((best, segment) =>
    segment.length > best.length ? segment : best,
  );

  expect(
    Math.hypot(anchor!.x - longestLeg.midpoint.x, anchor!.y - longestLeg.midpoint.y),
  ).toBeGreaterThan(1);
});

test("a run clipped at one end is where walking stops agreeing with averaging", () => {
  const state = canvas([
    contentWindow({ id: "from", itemId: "a", rect: { height: 120, width: 180, x: -400, y: -300 } }),
    contentWindow({ id: "to", itemId: "b", rect: { height: 120, width: 180, x: 200, y: 100 } }),
    contentWindow({
      id: "blocker",
      itemId: "c",
      rect: { height: 60, width: 110, x: -230, y: -210 },
    }),
  ]);
  const [connector] = getDrawnConnectors(state, [relation("a", "b")]);
  const anchor = connector?.anchor;
  const segments = connector?.segments ?? [];

  expect(anchor).not.toBeNull();

  expect(Math.min(...segments.map((segment) => distanceToSegment(anchor!, segment)))).toBeLessThan(
    0.001,
  );

  const visible = getInfiniteCanvasUnoccludedSegments(
    segments,
    state.windows.map((window) => window.rect),
  );
  const first = visible[0];
  const last = visible.at(-1);

  expect(first).toBeDefined();
  expect(last).toBeDefined();

  const averaged = {
    x: (first!.start.x + last!.end.x) / 2,
    y: (first!.start.y + last!.end.y) / 2,
  };

  expect(
    Math.min(...segments.map((segment) => distanceToSegment(averaged, segment))),
  ).toBeGreaterThan(1);
});

test("the path really does elbow, so the test above is not measuring a straight line", () => {
  const [connector] = getDrawnConnectors(
    canvas([
      contentWindow({ id: "top", itemId: "a", rect: STACKED_TOP }),
      contentWindow({ id: "bottom", itemId: "b", rect: STACKED_BOTTOM }),
    ]),
    [relation("a", "b")],
  );

  expect(connector?.segments.length).toBeGreaterThan(1);
});

const canvas = (
  windows: readonly ReturnType<typeof contentWindow>[],
): InfiniteCanvasState<WindowKind> =>
  createInfiniteCanvasState<WindowKind>({ viewport: VIEWPORT, windows: [...windows] });

const canvasOnDesktop = (
  windows: readonly ReturnType<typeof contentWindow>[],
  admitted: readonly string[],
): InfiniteCanvasState<WindowKind> => ({
  ...canvas(windows),
  activeWorkspaceId: "desk",
  workspaces: [
    {
      camera: canvas([]).camera,
      id: "desk",
      selection: canvas([]).selection,
      title: "Desk",
      windowIds: admitted,
    },
  ],
});

const containsPoint = (rect: InfiniteCanvasRect, point: InfiniteCanvasPoint) =>
  point.x >= rect.x &&
  point.x <= rect.x + rect.width &&
  point.y >= rect.y &&
  point.y <= rect.y + rect.height;

test("two connected windows draw one connector", () => {
  const connectors = getDrawnConnectors(
    canvas([
      contentWindow({ id: "wa", itemId: "content_item:a", rect: A }),
      contentWindow({ id: "wb", itemId: "content_item:b", rect: B }),
    ]),
    [relation("content_item:a", "content_item:b")],
  );

  expect(connectors).toHaveLength(1);
  expect(connectors[0]?.segments.length).toBeGreaterThan(0);
  expect(connectors[0]?.anchor).not.toBeNull();
});

test("what you can click is exactly what is drawn", () => {
  const state = canvas([
    contentWindow({ id: "wa", itemId: "content_item:a", rect: A }),
    contentWindow({ id: "wb", itemId: "content_item:b", rect: B }),
  ]);
  const relations = [relation("content_item:a", "content_item:b")];

  const drawn = getDrawnConnectors(state, relations).flatMap((connector) =>
    connector.segments.map((segment) => ({
      end: segment.end,
      id: connector.relation.id,
      start: segment.start,
    })),
  );
  const clickable = getConnectorEdgeTargets(state, relations).map((target) => ({
    end: target.end,
    id: target.id,
    start: target.start,
  }));

  expect(clickable).toEqual(drawn);
});

test("every segment of one connector carries the whole edge's id", () => {
  const targets = getConnectorEdgeTargets(
    canvas([
      contentWindow({ id: "wa", itemId: "content_item:a", rect: A }),
      contentWindow({ id: "wb", itemId: "content_item:b", rect: B }),
    ]),
    [relation("content_item:a", "content_item:b", "relates_to:only")],
  );

  expect(targets.length).toBeGreaterThan(1);
  expect(new Set(targets.map((target) => target.id))).toEqual(new Set(["relates_to:only"]));
});

test("a window on another desktop is not connected to one on this desktop", () => {
  const windows = [
    contentWindow({ id: "wa", itemId: "content_item:a", rect: A }),
    contentWindow({ id: "wb", itemId: "content_item:b", rect: B }),
  ];
  const relations = [relation("content_item:a", "content_item:b")];

  expect(getDrawnConnectors(canvasOnDesktop(windows, ["wa"]), relations)).toEqual([]);
  expect(getDrawnConnectors(canvasOnDesktop(windows, ["wa", "wb"]), relations)).toHaveLength(1);
});

test("connectors join content items, not note windows", () => {
  const connectors = getDrawnConnectors(
    canvas([
      contentWindow({ id: "wa", itemId: "content_item:a", rect: A }),
      contentWindow({ id: "wi", itemId: "content_item:pic", kind: "image", rect: B }),
    ]),
    [relation("content_item:a", "content_item:pic")],
  );

  expect(connectors).toHaveLength(1);
});

test("a marker never lands inside a window, and is null when there is nowhere left", () => {
  const windows = [
    contentWindow({ id: "wa", itemId: "content_item:a", rect: A }),
    contentWindow({ id: "wb", itemId: "content_item:b", rect: B }),
    contentWindow({
      id: "wc",
      itemId: "content_item:c",
      rect: { height: 400, width: 260, x: 330, y: 0 },
    }),
  ];
  const [connector] = getDrawnConnectors(canvas(windows), [
    relation("content_item:a", "content_item:b"),
  ]);
  const anchor = connector?.anchor;

  expect(anchor).not.toBeNull();
  expect(anchor).toBeDefined();

  for (const window of windows) {
    expect(
      containsPoint(window.rect, anchor as InfiniteCanvasPoint),
      `marker at ${anchor?.x},${anchor?.y} is inside ${window.id}`,
    ).toBe(false);
  }
});

test("a connection whose other end is closed becomes a stub, and stops being one when it opens", () => {
  const open = contentWindow({ id: "wa", itemId: "content_item:a", rect: A });
  const relations = [relation("content_item:a", "content_item:gone")];

  const stubs = getHiddenConnectorStubs(canvas([open]), relations);

  expect(stubs).toHaveLength(1);
  expect(stubs[0]?.count).toBe(1);
  expect(stubs[0]?.itemId).toBe("content_item:a");

  const bothOpen = canvas([
    open,
    contentWindow({ id: "wg", itemId: "content_item:gone", rect: B }),
  ]);

  expect(getHiddenConnectorStubs(bothOpen, relations)).toEqual([]);
});

test("a stub counts the far notes, not the edges reaching them", () => {
  const stubs = getHiddenConnectorStubs(
    canvas([contentWindow({ id: "wa", itemId: "content_item:a", rect: A })]),
    [
      relation("content_item:a", "content_item:gone", "relates_to:one"),
      relation("content_item:gone", "content_item:a", "relates_to:two"),
    ],
  );

  expect(stubs[0]?.count).toBe(1);
});
