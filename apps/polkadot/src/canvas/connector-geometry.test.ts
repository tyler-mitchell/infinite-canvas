import {
  createInfiniteCanvasState,
  createInfiniteCanvasWindow,
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

/**
 * Connector geometry is where this app's silent wrongness lives.
 *
 * Every defect this module's own comments record was found by looking at the canvas, not by a
 * typecheck and not by a failing build: a line drawn between two notes that live on another
 * desktop, a marker rendered at x=174 behind the library rail, a label placed at the midpoint of a
 * path and therefore inside a window, connectors that joined notes to notes while an image was
 * connectable in the database and not on the canvas. All four render. All four look like working
 * code. The only signal was somebody opening the app and noticing.
 *
 * That is exactly the class of thing worth pinning, because the next person to touch this will
 * have no way of knowing which of these arrangements was deliberate.
 */

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

const canvas = (
  windows: readonly ReturnType<typeof contentWindow>[],
): InfiniteCanvasState<WindowKind> =>
  createInfiniteCanvasState<WindowKind>({ viewport: VIEWPORT, windows: [...windows] });

/**
 * A canvas with one desktop active, admitting only the windows named.
 *
 * Spread rather than passed in, because `activeWorkspaceId` is not a `createInfiniteCanvasState`
 * input — a fresh canvas has no desktop active, and the field is filled by hydration instead. This
 * is the state a reload produces, built the only way a test can build it.
 */
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
  // The baseline every other test here depends on. If this stops producing a connector, the
  // assertions below stop meaning anything while still passing.
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
  /*
   * The invariant this module was written to hold, and the one nothing else checks. Two things need
   * to know where a connector is — the layer that draws it and the resolver that decides whether a
   * click landed on it — and if those ever derive it separately you get an edge you can see and
   * cannot hit, or one you hit somewhere it is not drawn. Neither failure appears in a typecheck,
   * and neither is visible on screen: the line looks right, the click just does nothing.
   */
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
  // An orthogonal route is three segments. Registering them under different ids would make
  // clicking an elbow select a limb, and there is no such thing as selecting a limb.
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
  /*
   * `state.windows` is every window on the canvas, not every window on the desktop being looked at.
   * Skipping only minimized windows drew a line between two notes filed elsewhere, so switching to
   * an empty desktop showed an edge hanging in blank space joining nothing visible.
   */
  const windows = [
    contentWindow({ id: "wa", itemId: "content_item:a", rect: A }),
    contentWindow({ id: "wb", itemId: "content_item:b", rect: B }),
  ];
  const relations = [relation("content_item:a", "content_item:b")];

  expect(getDrawnConnectors(canvasOnDesktop(windows, ["wa"]), relations)).toEqual([]);
  // The same canvas with both admitted still draws it, so the filter is membership and not an
  // accident of having any workspace at all.
  expect(getDrawnConnectors(canvasOnDesktop(windows, ["wa", "wb"]), relations)).toHaveLength(1);
});

test("connectors join content items, not note windows", () => {
  /*
   * `relates_to` has joined any content item to any other since the first migration, but the
   * connector layer resolved note windows and only note windows — so an image was connectable in
   * the database and simply absent from the canvas.
   */
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
  /*
   * Connectors draw beneath the windows they join, so an anchor inside one is a label that is
   * simply not there — it renders, it has the right text, and a window is painted over it. The
   * midpoint of the routed path was the obvious choice and did exactly this whenever the two ends
   * nearly touched, which is when an edge most needs something to aim at.
   *
   * A third window parked across the line is the case a two-window test cannot reach: it occludes
   * without being an endpoint.
   */
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

  // Asserted rather than guarded on. A `null` here would make every check below vacuous while the
  // test still reported green, which is the failure this whole file exists to avoid.
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
  /*
   * An edge draws only when both ends have a rect, so closing one note silently removes the line:
   * the note keeps its connections and the canvas stops mentioning them, which is
   * indistinguishable from having none.
   */
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
  // Two relations to the same absent item is one note you cannot see, and a stub reading "2" would
  // be claiming a second one exists.
  const stubs = getHiddenConnectorStubs(
    canvas([contentWindow({ id: "wa", itemId: "content_item:a", rect: A })]),
    [
      relation("content_item:a", "content_item:gone", "relates_to:one"),
      relation("content_item:gone", "content_item:a", "relates_to:two"),
    ],
  );

  expect(stubs[0]?.count).toBe(1);
});
