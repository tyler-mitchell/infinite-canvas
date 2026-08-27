import { createInfiniteCanvasState, createInfiniteCanvasWindow } from "@hyphened/infinite-canvas";
import { expect, test } from "vite-plus/test";

import type { WindowKind } from "../canvas/window-registry";
import type { ContentItemRecord } from "../database/database.client";
import { describeProjectContent } from "./describe-content";
import type { ProjectContent } from "./project-content";

/**
 * The listing a caller cannot get any other way.
 *
 * `describeCanvas` reports what is open; a record whose window was closed still exists and is
 * invisible to everything except the library rail. The distinction this file guards hardest is
 * "not loaded" against "empty", because collapsing them tells a caller the project holds nothing
 * while the first query is still in flight — and that is a lie it would act on.
 */

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
    describeProjectContent({ listing: null, projectId: "project-1", state: stateShowing([]) }),
  ).toBe("The project's content has not loaded yet.");
  expect(
    describeProjectContent({
      listing: { items: [], projectId: "project-1" },
      projectId: "project-1",
      state: stateShowing([]),
    }),
  ).toBe("This project holds nothing yet.");
});

test("a listing belonging to another project reads as not loaded, never as that project's", () => {
  // The guard `project-content` carries for exactly this: mid-navigation, the held listing is the
  // previous project's, and reporting it would attribute one project's contents to another.
  expect(describeProjectContent({ listing, projectId: "project-2", state: stateShowing([]) })).toBe(
    "The project's content has not loaded yet.",
  );
});

test("every item is named by kind and title", () => {
  const described = describeProjectContent({
    listing,
    projectId: "project-1",
    state: stateShowing([]),
  });

  expect(described).toContain('note "Quarterly notes"');
  expect(described).toContain('image "swatch.png"');
});

test("every item carries the id that content.open takes, or the listing cannot be ordered from", () => {
  // Titles do not distinguish stored items — five "Untitled" notes are ordinary — so the id is
  // the only handle that names one item. A listing without it is a catalogue with no order form.
  const described = describeProjectContent({
    listing,
    projectId: "project-1",
    state: stateShowing([]),
  });

  expect(described).toContain("[one]");
  expect(described).toContain("[two]");
});

test("items already on the canvas are marked, and the rest are counted", () => {
  // The actionable number: what is closed is what a caller might want to open.
  const described = describeProjectContent({
    listing,
    projectId: "project-1",
    state: stateShowing(["one"]),
  });

  expect(described).toContain('note "Quarterly notes" [one] (open)');
  expect(described).not.toContain("[two] (open)");
  expect(described).toContain("2 item(s), 1 not open");
});
