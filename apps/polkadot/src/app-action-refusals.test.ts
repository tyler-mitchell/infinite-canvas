import {
  createInfiniteCanvasState,
  createInfiniteCanvasWindow,
  type InfiniteCanvasDispatch,
} from "@hyphened/infinite-canvas/legacy";
import { expect, test } from "vite-plus/test";

import { APP_ACTIONS, describeCutRelation, getAppAction } from "./app-actions";
import type { WindowKind } from "./canvas/window-registry";
import { projectListings$, type ProjectContent } from "./content/project-content";

const state = createInfiniteCanvasState<WindowKind>({
  viewport: { height: 800, width: 1200 },
  windows: [
    createInfiniteCanvasWindow<WindowKind>({
      id: "note-1",
      kind: "note",
      rect: { height: 200, width: 320, x: 0, y: 0 },
      title: "Untitled",
    }),
  ],
});

const dispatch: InfiniteCanvasDispatch<WindowKind> = () => undefined;

const stored: ProjectContent = {
  items: [
    { archived: false, id: "item-1", kind: "note", projectId: "project-1", title: "Untitled" },
    { archived: false, id: "item-2", kind: "note", projectId: "project-1", title: "Untitled" },
  ] as unknown as ProjectContent["items"],
  projectId: "project-1",
};

const visited: string[] = [];

const refuse = (id: string, input: unknown) => {
  projectListings$[stored.projectId].set(stored);
  visited.length = 0;

  return getAppAction(id)?.run(
    {
      dispatch,
      canvasId: "canvas-1",
      canvasTitle: "Main canvas",
      goToCanvas: ({ canvasId }) => visited.push(canvasId),
      projectId: "project-1",
      refreshRoute: () => undefined,
      state,
    },
    input,
  );
};

test("renaming a document refuses a name that is blank once trimmed", async () => {
  for (const [id, input] of [
    ["canvas.rename", { canvasId: "canvas_document:canvas-1", title: "   " }],
    ["project.rename", { projectId: "project:project-1", title: "" }],
  ] as const) {
    expect(`${id}: ${String(await refuse(id, input))}`).toBe(
      `${id}: Refused: a name cannot be blank.`,
    );
  }
});

test("renaming a document accepts a real name, so the guard above is not refusing everything", async () => {
  expect(
    typeof refuse("canvas.rename", { canvasId: "canvas_document:canvas-1", title: "Q3 planning" }),
  ).not.toBe("string");
  expect(
    typeof refuse("project.rename", { projectId: "project:project-1", title: "Atlas" }),
  ).not.toBe("string");
});

test("every verb that takes an argument says why it refused a malformed one", async () => {
  const parameterized = APP_ACTIONS.filter((action) => action.input !== undefined);

  expect(parameterized.length).toBeGreaterThan(10);

  for (const action of parameterized) {
    const refusal = await refuse(action.id, 42);

    expect(typeof refusal, `${action.id} answered ${String(refusal)}`).toBe("string");
    expect(refusal, `${action.id} refused without saying why`).toMatch(/^Refused: /);
  }
});

test("a schema refusal names the field, so a caller can correct it rather than guess", async () => {
  const refusal = await refuse("relation.connect", { sourceItemId: 123 });

  expect(refusal).toContain("sourceItemId must be a string");
  expect(refusal).toContain("targetItemId must be a string");
});

const HANDLE_VERBS: readonly Readonly<{ id: string; input: object }>[] = [
  { id: "content.open", input: { itemId: "never-existed" } },
  { id: "content.archive", input: { itemId: "never-existed" } },
  { id: "window.reveal", input: { windowId: "never-existed" } },
  { id: "collection.create.connectedTo", input: { itemId: "never-existed" } },
  { id: "group.dissolve", input: { groupId: "never-existed" } },
  { id: "group.rename", input: { groupId: "never-existed", title: "x" } },
  { id: "group.setLayout", input: { groupId: "never-existed", layout: "tabs" } },
  { id: "workspace.enter", input: { workspaceId: "never-existed" } },
  { id: "workspace.rename", input: { title: "x", workspaceId: "never-existed" } },
  { id: "workspace.close", input: { workspaceId: "never-existed" } },
  { id: "workspace.moveActiveWindow", input: { workspaceId: "never-existed" } },
  { id: "view.open", input: { viewId: "never-existed" } },
  { id: "view.reframe", input: { viewId: "never-existed" } },
  { id: "view.remove", input: { viewId: "never-existed" } },
  { id: "relation.connect", input: { sourceItemId: "ghost-a", targetItemId: "ghost-b" } },
  { id: "relation.disconnect", input: { sourceItemId: "ghost-a", targetItemId: "ghost-b" } },
  {
    id: "relation.setKind",
    input: { kind: "supports", sourceItemId: "item-1", targetItemId: "ghost-b" },
  },
  {
    id: "relation.setLabel",
    input: { label: "x", sourceItemId: "item-1", targetItemId: "ghost-b" },
  },
];

test("a handle that names nothing is refused, by every verb that takes one", async () => {
  for (const verb of HANDLE_VERBS) {
    const refusal = await refuse(verb.id, verb.input);

    expect(typeof refusal, `${verb.id} answered ${String(refusal)}`).toBe("string");
    expect(refusal, `${verb.id} refused without saying why`).toMatch(/^Refused: /);
  }
});

test("the refusal says where good handles come from, not just that this one was bad", async () => {
  expect(await refuse("content.open", { itemId: "never-existed" })).toContain("content.list");
  expect(await refuse("window.reveal", { windowId: "never-existed" })).toContain("canvas.describe");
  expect(await refuse("group.dissolve", { groupId: "never-existed" })).toContain("canvas.describe");
});

test("which end of a connection was wrong, rather than that one of them was", async () => {
  const missingTarget = await refuse("relation.connect", {
    sourceItemId: "item-1",
    targetItemId: "ghost",
  });

  expect(missingTarget).toContain("target ghost");
  expect(missingTarget).not.toContain("source item-1");
});

test("joining an item to itself is refused as itself, not as a missing item", async () => {
  expect(await refuse("relation.connect", { sourceItemId: "item-1", targetItemId: "item-1" })).toBe(
    "Refused: an item cannot be connected to itself.",
  );
});

test("two items that exist but are not joined is its own answer", async () => {
  const refusal = await refuse("relation.setLabel", {
    label: "because",
    sourceItemId: "item-1",
    targetItemId: "item-1",
  });

  expect(refusal).toMatch(/^Refused: /);
});

const cutEdge = (relation: Readonly<{ kind: string; label: string | null }>) =>
  ({ id: "rel-1", source: "item-1", target: "item-2", ...relation }) as unknown as Parameters<
    typeof describeCutRelation
  >[0];

test("disconnecting names what went with it, and how to put it back", () => {
  const said = describeCutRelation(cutEdge({ kind: "supports", label: "load-bearing evidence" }));

  expect(said).toContain("supports");
  expect(said).toContain("load-bearing evidence");
  expect(said).toContain("relation.connect");
  expect(said).toContain("relation.setLabel");
  expect(said).not.toMatch(/^Refused: /);
});

test("a default edge with no label says nothing, because losing it costs nothing", () => {
  expect(describeCutRelation(cutEdge({ kind: "relates", label: null }))).toBeUndefined();
});

test("restore does not pretend to check an id it has no way to check", async () => {
  expect(typeof refuse("content.restore", { itemId: "content_item:never-existed" })).not.toBe(
    "string",
  );
  expect(await refuse("content.restore", { itemId: "canvas_document:not-an-item" })).toMatch(
    /^Refused: .*wrong kind of id/,
  );
  expect(await refuse("content.restore", 42)).toMatch(/^Refused: /);
});

test("a verb that ran returns nothing, so the adapter can tell the two apart", async () => {
  expect(typeof refuse("note.create", undefined)).not.toBe("string");
  expect(await refuse("window.reveal", { windowId: "note-1" })).toBeUndefined();
});
