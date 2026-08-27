import { createInfiniteCanvasState, createInfiniteCanvasWindow } from "@hyphened/infinite-canvas";
import { expect, test } from "vite-plus/test";

import { getAppAction } from "../app-actions";
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

  expect(described).toContain('note "Second" [b], active');
  expect(described).not.toContain('note "First" [a], active');
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
  expect(described).toContain('note "Behind" [b], behind a tab');
  expect(described).not.toContain('note "Front" [a], behind a tab');
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

test("a group carries the handle its verbs take, named or not", () => {
  /*
   * `group.setLayout`, `group.rename` and `group.dissolve` take a group id, so the report has to
   * give one — the same rule the windows follow. An unnamed group needs it most: its title is
   * composed from its members, so two containers holding notes with the same titles compose the
   * same string and are otherwise indistinguishable.
   */
  expect(describeWithGroup("Reading list")).toContain('"Reading list" [group-1]');
  expect(describeWithGroup(null)).toContain('"Sources & Draft" [group-1]');
});

/**
 * A report you can act on names its entries.
 *
 * This report is what a caller reads before deciding anything, and `window.reveal` is what it calls
 * afterwards. If the report does not carry the handle the verb takes, the two halves do not
 * compose — which is not hypothetical: the report said `kind "title"`, the verb took a title and
 * first-matched, and a live canvas held two windows both called "Links". A caller could see both
 * entries and had no way to name the second. It revealed an arbitrary one and reported success.
 */
const twoWindowsSharingATitle = () =>
  createInfiniteCanvasState<WindowKind>({
    viewport: { height: 800, width: 1200 },
    windows: [
      windowAt("window-one", "note", "Links", 0),
      windowAt("window-two", "note", "Links", 400),
    ],
  });

/** Every `[handle]` the report publishes, in order. */
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
  /*
   * Each entry carries *its own* id, rather than merely differing from the other.
   *
   * The weaker form — asserting the two entries are unlike — passed with the handles removed,
   * because one window happened to be the active one and said so. A test that holds for a reason
   * unrelated to its name is worse than no test: it reports the seam as covered while it is open.
   */
  expect(entries[0]).toContain("window-one");
  expect(entries[1]).toContain("window-two");
});

test("a handle from the report is accepted by the verb that consumes it", () => {
  // Through the action's own ArkType declaration rather than a copy, because that declaration is
  // also what `model-context` turns into the tool schema a caller is offered.
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
