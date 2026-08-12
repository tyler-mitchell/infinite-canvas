import { expect, test } from "vite-plus/test";

import { DEFAULT_INFINITE_CANVAS_SNAP_POLICY } from "./constants";
import { createInfiniteCanvasState, createInfiniteCanvasWindow } from "./factory";
import { buildSnapCandidates, getMoveSnapAnchors, getResizeSnapAnchors } from "./snap-candidates";
import type { InfiniteCanvasState } from "./types";

/**
 * Candidate generation — what a window is even allowed to snap to.
 *
 * `snap-resolver.test.ts` covers the *decision*: given anchors and candidates, which one catches
 * and when it lets go. It is blind to everything upstream. A candidate that is never generated
 * produces no failure anywhere — the snap simply does not happen, and the user assumes they
 * mis-aimed. That silence is why this is worth asserting separately from the resolver.
 */

type Kind = "note";

const windowAt = (id: string, x: number, y: number, width = 200, height = 100) =>
  createInfiniteCanvasWindow<Kind>({
    id,
    kind: "note",
    rect: { height, width, x, y },
    title: id,
  });

const stateWith = (
  ...windows: readonly ReturnType<typeof windowAt>[]
): InfiniteCanvasState<Kind> => ({
  ...createInfiniteCanvasState<Kind>({
    camera: { center: { x: 0, y: 0 }, zoom: 1 },
    windows: [...windows],
  }),
  viewport: { height: 800, width: 1200 },
});

const RECT = { height: 100, width: 200, x: 0, y: 0 };
const POLICY = DEFAULT_INFINITE_CANVAS_SNAP_POLICY;

test("a moving window offers both edges and its centre on each axis", () => {
  const anchors = getMoveSnapAnchors(RECT, POLICY);

  expect(anchors.map((anchor) => anchor.sourceAnchor).sort()).toEqual([
    "bottom",
    "center",
    "left",
    "middle",
    "right",
    "top",
  ]);
  // Centre is the midpoint, not the origin — an off-by-half here would misalign every
  // centre-snapped window by half its size.
  expect(anchors.find((anchor) => anchor.sourceAnchor === "center")?.position).toBe(100);
  expect(anchors.find((anchor) => anchor.sourceAnchor === "middle")?.position).toBe(50);
});

test("turning centre snapping off removes only the centre anchors", () => {
  const anchors = getMoveSnapAnchors(RECT, { ...POLICY, snapToCenters: false });

  expect(anchors).toHaveLength(4);
  expect(anchors.every((anchor) => anchor.kind === "edge")).toBe(true);
});

test("a resize offers only the edges the handle actually moves", () => {
  // Resizing by the east handle must not snap the west edge: the origin is not moving, so
  // offering it would drag the window sideways while the user is widening it.
  const east = getResizeSnapAnchors(RECT, "east").map((anchor) => anchor.sourceAnchor);

  expect(east).toContain("right");
  expect(east).not.toContain("left");

  const southWest = getResizeSnapAnchors(RECT, "south-west").map((anchor) => anchor.sourceAnchor);

  expect(southWest.sort()).toEqual(["bottom", "left"]);
});

test("another window contributes edge and centre candidates", () => {
  const candidates = buildSnapCandidates(
    stateWith(windowAt("a", 0, 0), windowAt("b", 500, 300)),
    "a",
    RECT,
    POLICY,
  );
  const fromWindows = candidates.filter((candidate) => candidate.from === "window");

  expect(fromWindows.length).toBeGreaterThan(0);
  // The neighbour's left edge at 500 and its centre at 600 are both offered.
  expect(fromWindows.some((candidate) => candidate.position === 500)).toBe(true);
  expect(fromWindows.some((candidate) => candidate.position === 600)).toBe(true);
});

test("the moving window never snaps to itself", () => {
  // Its own edges are at the same coordinates as its anchors, so a self-candidate would catch at
  // distance zero and pin the window in place permanently.
  const candidates = buildSnapCandidates(stateWith(windowAt("a", 0, 0)), "a", RECT, POLICY);

  expect(candidates.filter((candidate) => candidate.from === "window")).toHaveLength(0);
});

test("viewport candidates are opt-in", () => {
  const state = stateWith(windowAt("a", 0, 0));

  expect(
    buildSnapCandidates(state, "a", RECT, POLICY).filter(
      (candidate) => candidate.from === "viewport",
    ),
  ).toHaveLength(0);
  expect(
    buildSnapCandidates(state, "a", RECT, { ...POLICY, snapToViewport: true }).filter(
      (candidate) => candidate.from === "viewport",
    ).length,
  ).toBeGreaterThan(0);
});

test("a gap candidate appears only between two windows that leave room", () => {
  // Equal-gap snapping needs a slot the moving window actually fits in, and the two neighbours
  // have to overlap it on the cross axis — otherwise the "gap" is between things that are not
  // side by side at all, and aligning to it looks arbitrary.
  const roomy = buildSnapCandidates(
    stateWith(windowAt("a", 0, 0), windowAt("left", -600, 0), windowAt("right", 600, 0)),
    "a",
    RECT,
    POLICY,
  );

  expect(roomy.some((candidate) => candidate.kind === "gap")).toBe(true);

  // Same pair, moved far apart on the cross axis: no longer a row, so no gap to centre in.
  const misaligned = buildSnapCandidates(
    stateWith(windowAt("a", 0, 0), windowAt("left", -600, 0), windowAt("right", 600, 5_000)),
    "a",
    RECT,
    POLICY,
  );

  expect(misaligned.some((candidate) => candidate.kind === "gap")).toBe(false);
});

test("turning gap snapping off removes gap candidates and nothing else", () => {
  const state = stateWith(
    windowAt("a", 0, 0),
    windowAt("left", -600, 0),
    windowAt("right", 600, 0),
  );
  const withGaps = buildSnapCandidates(state, "a", RECT, POLICY);
  const without = buildSnapCandidates(state, "a", RECT, { ...POLICY, snapToGaps: false });

  expect(without.some((candidate) => candidate.kind === "gap")).toBe(false);
  expect(without.length).toBeLessThan(withGaps.length);
  expect(without.every((candidate) => candidate.kind !== "gap")).toBe(true);
});

test("a minimized window is not a snap source", () => {
  // It is not on screen, so aligning to where it would have been is aligning to nothing.
  const state = stateWith(windowAt("a", 0, 0), { ...windowAt("b", 500, 0), mode: "minimized" });

  expect(
    buildSnapCandidates(state, "a", RECT, POLICY).filter(
      (candidate) => candidate.from === "window",
    ),
  ).toHaveLength(0);
});
