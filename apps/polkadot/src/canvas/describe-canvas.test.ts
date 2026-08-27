import { createInfiniteCanvasState, createInfiniteCanvasWindow } from "@hyphened/infinite-canvas";
import { expect, test } from "vite-plus/test";

import { describeCanvas } from "./describe-canvas";
import type { WindowKind } from "./window-registry";

/**
 * The reporting half of the vocabulary, which is the half a caller that cannot see the screen
 * depends on entirely. If this says the wrong thing, an agent acts on the wrong picture — and
 * unlike a wrong pixel, nothing about that is visible to anyone.
 */

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
  // The whole point of the report: two notes are not interchangeable if one is the one you are on.
  const described = describeCanvas(
    createInfiniteCanvasState<WindowKind>({
      activeWindowId: "b",
      viewport: { height: 800, width: 1200 },
      windows: [windowAt("a", "note", "First", 0), windowAt("b", "note", "Second", 400)],
    }),
  );

  expect(described).toContain('note "Second", active');
  expect(described).not.toContain('note "First", active');
});

/**
 * The two ways a window is on the canvas without being on screen.
 *
 * Both were reported as ordinary windows until 2026-08-26, found by fitting a real canvas and
 * reading the rects: a note and a collection with byte-identical geometry, one of them drawn.
 * Telling a caller that cannot see the screen it has two things in front of it, when one is
 * behind the other, is worse than omitting it.
 */
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

  // Fails if the projection is not consulted: both read as plain, visible windows.
  expect(described).toContain('note "Behind", behind a tab');
  expect(described).not.toContain('note "Front", behind a tab');
});

/**
 * A group nobody named is described by what is in it, not by the word "null".
 *
 * `InfiniteCanvasGroup.title` became `string | null` on 2026-08-27, where `null` means "named
 * after its members" and `getInfiniteCanvasGroupTitle` composes that from current membership. This
 * file read `title` raw and interpolated it, so an unnamed group reported itself as the literal
 * string `"null"` — reproduced in the running app before the fix, alongside a named group, reading
 * `"Untitled 6 & Connected to Untitled 6", "null"`.
 *
 * A template accepts `null`, so the typechecker had nothing to say, and the only reader affected
 * cannot see the screen — the exact combination this file exists to defend against.
 */
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
