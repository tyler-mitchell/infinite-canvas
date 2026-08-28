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

/**
 * Two windows stacked with a gap, the arrangement the anchor exists for.
 *
 * Offset horizontally by a little, because that is what puts an elbow in the path — and the elbow
 * is the whole subject. Perfectly aligned windows route straight and cannot tell the two answers
 * apart, which is why the defect below survived: every fixture here joined windows side by side.
 */
const STACKED_TOP = { height: 150, width: 200, x: 300, y: 100 };
const STACKED_BOTTOM = { height: 150, width: 200, x: 312, y: 290 };

test("a marker sits halfway along the visible run, not halfway along one of its legs", () => {
  /*
   * Measured in the browser first: two notes with a 34px gap put the label at y321.5 against a
   * true centre of 313 — two pixels off the lower window with nineteen of clearance above it.
   *
   * The cause is that `getInfiniteCanvasLongestUnoccludedSegment` returns the longest *segment*
   * while promising "the longest run". An orthogonal connector is three segments, so a path with
   * nothing covering any of it is still three, and the longest is one leg — a quarter along.
   *
   * Asserted as "centred in the gap" rather than against a number: the y is the midpoint between
   * the two windows' facing edges, which is what a person sees and what the number was wrong about.
   */
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

/** Distance from a point to a segment, so "is the marker on the line" is a measurement. */
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
  /*
   * Two windows offset on both axes, so the route has two long legs rather than the near-vertical
   * one the stacked fixture makes. Walking a path by length can only put the point somewhere the
   * path actually goes if the path was assembled in order, and this is the arrangement where an
   * out-of-order assembly would show.
   *
   * Asserted as a distance to the drawn segments rather than against coordinates: "the marker is
   * on the line" is the property, and it holds whatever the router decides the corner should be.
   */
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

  /*
   * The discrimination half, and the assertion this test was first written with was the wrong one.
   *
   * It claimed averaging the run's endpoints puts the point off the line, and measured zero. The
   * router explains why: `getOrthogonalConnectorPathPoints` always returns a symmetric Z crossing
   * at the exact halfway point, so the endpoint average is `(midX, midY)` — on the middle segment,
   * always — and walking half the routed length arrives there too. For a whole unclipped path the
   * two answers are the same point, and no fixture can separate them.
   *
   * What this fix is actually about is the leg. Asserting the anchor is away from the longest
   * single segment's midpoint is what tells the merged run from the old answer.
   */
  const longestLeg = segments.reduce((best, segment) =>
    segment.length > best.length ? segment : best,
  );

  expect(
    Math.hypot(anchor!.x - longestLeg.midpoint.x, anchor!.y - longestLeg.midpoint.y),
  ).toBeGreaterThan(1);
});

test("a run clipped at one end is where walking stops agreeing with averaging", () => {
  /*
   * The case that makes the walk load-bearing instead of free, and it was an argument until now.
   *
   * On a whole path the two answers coincide, because the router's Z is symmetric — that is the
   * correction recorded above. A run is a *clipped* piece of that path, and clipping one end
   * destroys the symmetry: the remaining stretch is short-leg, long-leg, long-leg, so half its
   * length falls somewhere the straight line between its own two ends does not pass.
   *
   * A third window over the first leg is the clip. It joins nothing; it is only in the way, which
   * is exactly what an occluder is.
   */
  /*
   * Kept inside the default visible world rect — roughly x -600..600, y -400..400 for this
   * viewport. The first draft put the windows at x700 and the anchor came back clipped by
   * `anchorBounds` rather than by the blocker, which looked like the fix misbehaving and was the
   * fixture leaving the screen.
   */
  const state = canvas([
    contentWindow({ id: "from", itemId: "a", rect: { height: 120, width: 180, x: -400, y: -300 } }),
    contentWindow({ id: "to", itemId: "b", rect: { height: 120, width: 180, x: 200, y: 100 } }),
    // On the first leg, which leaves the window's bottom-right corner at y-180 rather than its
    // centre at y-240 — the second thing the first draft of this fixture got wrong.
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

  // Still on the drawn line, which is the property that must survive any clipping.
  expect(Math.min(...segments.map((segment) => distanceToSegment(anchor!, segment)))).toBeLessThan(
    0.001,
  );

  /*
   * And now the two answers differ. Averaging the visible run's own endpoints leaves the line
   * entirely — the claim the previous fixture could not support, measured here rather than argued.
   */
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

  // Measured: the blocker clips the first leg to start at x-120, the walk lands at (-10, 10) on
  // the vertical leg, and averaging that run's ends gives (40, -40) — off the connector entirely.
  expect(
    Math.min(...segments.map((segment) => distanceToSegment(averaged, segment))),
  ).toBeGreaterThan(1);
});

test("the path really does elbow, so the test above is not measuring a straight line", () => {
  // Guards the guard. With the two windows aligned the route is straight, one leg, and the old
  // behaviour and the new one agree — which is exactly how this went unnoticed.
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
