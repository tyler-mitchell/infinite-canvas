import { createInfiniteCanvasState, createInfiniteCanvasWindow } from "@hyphened/infinite-canvas";
import { expect, test } from "vite-plus/test";

import { getAppAction } from "../app-actions";
import { describeCanvas } from "./describe-canvas";
import type { WindowKind } from "./window-registry";

const windowAt = (id: string, kind: WindowKind, title: string, x: number) =>
  createInfiniteCanvasWindow<WindowKind>({
    id,
    kind,
    rect: { height: 200, width: 320, x, y: 0 },
    title,
  });

test("an empty canvas says so rather than reporting nothing", () => {
  const described = describeCanvas(
    createInfiniteCanvasState<WindowKind>({ viewport: { height: 800, width: 1200 }, windows: [] }),
  );

  expect(described).toContain("No windows open.");
  expect(described).toContain("No groups.");
});

test("each window is named by its kind and title", () => {
  const described = describeCanvas(
    createInfiniteCanvasState<WindowKind>({
      viewport: { height: 800, width: 1200 },
      windows: [windowAt("a", "note", "Quarterly notes", 0), windowAt("b", "link", "Example", 400)],
    }),
  );

  expect(described).toContain('note "Quarterly notes"');
  expect(described).toContain('link "Example"');
  expect(described).toContain("2 window(s)");
});

test("the live window is distinguishable from the rest", () => {
  const described = describeCanvas(
    createInfiniteCanvasState<WindowKind>({
      activeWindowId: "b",
      viewport: { height: 800, width: 1200 },
      windows: [windowAt("a", "note", "First", 0), windowAt("b", "note", "Second", 400)],
    }),
  );

  expect(described).toContain('note "Second" [b], active');
  expect(described).not.toContain('note "First" [a], active');
});

test("a window behind a tab is said to be behind a tab", () => {
  const described = describeCanvas(
    createInfiniteCanvasState<WindowKind>({
      groups: [
        {
          id: "group-1",
          rect: { height: 400, width: 600, x: 0, y: 0 },
          title: "Reading list",
          tree: {
            activeChildId: "a",
            axis: "horizontal",
            children: [
              { id: "a", kind: "window", weight: 1 },
              { id: "b", kind: "window", weight: 1 },
            ],
            id: "container-1",
            kind: "container",
            layout: "tabs",
            weight: 1,
          },
          zIndex: 0,
        },
      ],
      viewport: { height: 800, width: 1200 },
      windows: [windowAt("a", "note", "Front", 0), windowAt("b", "note", "Behind", 0)],
    }),
  );

  expect(described).toContain('note "Behind" [b], behind a tab');
  expect(described).not.toContain('note "Front" [a], behind a tab');
});

const groupOf = (title: string | null) => ({
  id: "group-1",
  rect: { height: 400, width: 600, x: 0, y: 0 },
  title,
  tree: {
    activeChildId: null,
    axis: "horizontal" as const,
    children: [
      { id: "a", kind: "window" as const, weight: 1 },
      { id: "b", kind: "window" as const, weight: 1 },
    ],
    id: "container-1",
    kind: "container" as const,
    layout: "split" as const,
    weight: 1,
  },
  zIndex: 0,
});

const describeWithGroup = (title: string | null) =>
  describeCanvas(
    createInfiniteCanvasState<WindowKind>({
      groups: [groupOf(title)],
      viewport: { height: 800, width: 1200 },
      windows: [windowAt("a", "note", "Sources", 0), windowAt("b", "note", "Draft", 400)],
    }),
  );

test("an unnamed group is described by its members, never as null", () => {
  const described = describeWithGroup(null);

  expect(described).not.toContain("null");
  expect(described).toContain('"Sources & Draft"');
});

test("a group somebody named is described by that name", () => {
  expect(describeWithGroup("Reading list")).toContain('"Reading list"');
});

test("a group says what it holds, so its verbs can be used on purpose", () => {
  expect(describeWithGroup("Reading list")).toContain("[group-1] holding [a], [b]");
});

test("a group carries the handle its verbs take, named or not", () => {
  expect(describeWithGroup("Reading list")).toContain('"Reading list" [group-1]');
  expect(describeWithGroup(null)).toContain('"Sources & Draft" [group-1]');
});

const twoWindowsSharingATitle = () =>
  createInfiniteCanvasState<WindowKind>({
    viewport: { height: 800, width: 1200 },
    windows: [
      windowAt("window-one", "note", "Links", 0),
      windowAt("window-two", "note", "Links", 400),
    ],
  });

const getReportedHandles = (report: string) =>
  [...report.matchAll(/\[([^\]]+)\]/g)].map((match) => match[1]);

test("the report names every window with a handle, even when titles collide", () => {
  expect(getReportedHandles(describeCanvas(twoWindowsSharingATitle()))).toStrictEqual([
    "window-one",
    "window-two",
  ]);
});

test("two windows with one title are distinguishable by their own handle", () => {
  const entries = describeCanvas(twoWindowsSharingATitle())
    .split(";")
    .filter((entry) => entry.includes('"Links"'));

  expect(entries).toHaveLength(2);
  expect(entries[0]).toContain("window-one");
  expect(entries[1]).toContain("window-two");
});

test("a handle from the report is accepted by the verb that consumes it", () => {
  const reveal = getAppAction("window.reveal");

  expect(reveal?.input).toBeDefined();

  for (const handle of getReportedHandles(describeCanvas(twoWindowsSharingATitle()))) {
    expect(reveal?.input?.({ windowId: handle })).toStrictEqual({ windowId: handle });
  }
});

test("zoom is reported as a percentage, the way the canvas shows it", () => {
  const described = describeCanvas(
    createInfiniteCanvasState<WindowKind>({
      camera: { center: { x: 0, y: 0 }, zoom: 0.64 },
      viewport: { height: 800, width: 1200 },
      windows: [],
    }),
  );

  expect(described).toContain("Zoom 64%.");
});

const EDGE_TARGET = {
  id: "relates_to:one",
  kind: "relation",
  type: "edge",
} as const;

test("a selected connector is reported, when the window selection is empty", () => {
  const described = describeCanvas(
    createInfiniteCanvasState<WindowKind>({
      selection: {
        anchorTarget: EDGE_TARGET,
        anchorWindowId: null,
        targets: [EDGE_TARGET],
        windowIds: [],
      },
      viewport: { height: 800, width: 1200 },
      windows: [windowAt("a", "note", "First", 0)],
    }),
  );

  expect(described).toContain("1 connection(s) selected");
  expect(described).toContain("content.list names them");
});

test("a canvas with nothing selected does not mention connections at all", () => {
  const described = describeCanvas(
    createInfiniteCanvasState<WindowKind>({
      viewport: { height: 800, width: 1200 },
      windows: [windowAt("a", "note", "First", 0)],
    }),
  );

  expect(described).not.toContain("connection");
});
