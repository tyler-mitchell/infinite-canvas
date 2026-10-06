import { expect, test } from "vite-plus/test";

import { DEFAULT_INFINITE_CANVAS_SNAP_POLICY } from "./constants";
import { createInfiniteCanvasState, createInfiniteCanvasWindow } from "./factory";
import { buildSnapCandidates, getMoveSnapAnchors, getResizeSnapAnchors } from "./snap-candidates";
import type { InfiniteCanvasState } from "./types";

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

test("guide identities remain distinct for arbitrary window IDs", () => {
  const candidates = buildSnapCandidates(
    stateWith(
      windowAt("viewport", -600, 0),
      windowAt("a-b", 0, 0),
      windowAt("c", 500, 0),
      windowAt("a", 1000, 0),
      windowAt("b-c", 1500, 0),
    ),
    null,
    RECT,
    { ...POLICY, snapToViewport: true, snapToGaps: true },
  );
  expect(candidates).toEqual(
    expect.arrayContaining([
      expect.objectContaining({ from: "viewport" }),
      expect.objectContaining({ from: "window", windowIds: ["viewport"] }),
      expect.objectContaining({ kind: "gap", windowIds: ["a-b", "c"] }),
      expect.objectContaining({ kind: "gap", windowIds: ["a", "b-c"] }),
    ]),
  );
  expect(new Set(candidates.map((candidate) => candidate.id)).size).toBe(candidates.length);
});

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
  expect(anchors.find((anchor) => anchor.sourceAnchor === "center")?.position).toBe(100);
  expect(anchors.find((anchor) => anchor.sourceAnchor === "middle")?.position).toBe(50);
});

test("turning centre snapping off removes only the centre anchors", () => {
  const anchors = getMoveSnapAnchors(RECT, { ...POLICY, snapToCenters: false });

  expect(anchors).toHaveLength(4);
  expect(anchors.every((anchor) => anchor.kind === "edge")).toBe(true);
});

test("a resize offers only the edges the handle actually moves", () => {
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
  expect(fromWindows.some((candidate) => candidate.position === 500)).toBe(true);
  expect(fromWindows.some((candidate) => candidate.position === 600)).toBe(true);
});

test("the moving window never snaps to itself", () => {
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
  const roomy = buildSnapCandidates(
    stateWith(windowAt("a", 0, 0), windowAt("left", -600, 0), windowAt("right", 600, 0)),
    "a",
    RECT,
    POLICY,
  );

  expect(roomy.some((candidate) => candidate.kind === "gap")).toBe(true);

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
  const state = stateWith(windowAt("a", 0, 0), { ...windowAt("b", 500, 0), mode: "minimized" });

  expect(
    buildSnapCandidates(state, "a", RECT, POLICY).filter(
      (candidate) => candidate.from === "window",
    ),
  ).toHaveLength(0);
});
