import {
  createInfiniteCanvasState,
  createInfiniteCanvasWindow,
  type InfiniteCanvasCommands,
} from "@hyphened/infinite-canvas";
import { expect, test } from "vite-plus/test";

import { APP_ACTIONS, getAppAction } from "./app-actions";
import type { WindowKind } from "./canvas/window-registry";
import { projectContent$, type ProjectContent } from "./content/project-content";
import { relations$ } from "./relations/relation-store";

/**
 * A verb that refuses has to say so, and these are the assertions that make that true.
 *
 * The existing suite pins that a bad argument *does nothing* — no command dispatched, no window
 * opened. That was the whole contract while the only caller was a person, who finds out by looking.
 * It is half the contract for a caller that cannot look, and the missing half went unnoticed until
 * the vocabulary was driven through WebMCP for the first time: `content.open` with an id naming
 * nothing and `window.reveal` with an id naming nothing both answered **"done."**
 *
 * Nothing was broken in the verbs. `run` returned `void`, so the three outcomes each verb already
 * distinguishes — it ran, the input did not validate, the input named nothing — arrived at the
 * adapter as one `undefined`, and the adapter reported success because that is all it had.
 *
 * These tests would all have passed before that change, which is exactly why they are worth having:
 * every one of them fails if `run` goes back to returning nothing.
 */

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

const actions = {
  closeGroup: () => undefined,
  executeCommand: () => undefined,
  openWindow: () => undefined,
  setGroupLayoutMode: () => undefined,
  setGroupTitle: () => undefined,
} as unknown as InfiniteCanvasCommands<WindowKind>;

const stored: ProjectContent = {
  items: [
    { archived: false, id: "item-1", kind: "note", projectId: "project-1", title: "Untitled" },
    { archived: false, id: "item-2", kind: "note", projectId: "project-1", title: "Untitled" },
  ] as unknown as ProjectContent["items"],
  projectId: "project-1",
};

const refuse = (id: string, input: unknown) => {
  projectContent$.set(stored);

  return getAppAction(id)?.run({ actions, projectId: "project-1", state }, input);
};

/**
 * The property, over the whole vocabulary rather than sixteen hand-written cases.
 *
 * A verb added tomorrow with an `input` and a silent `return` is caught by this without anyone
 * remembering to extend the list — which is the failure mode the original defect had, sixteen times
 * over. `42` rather than `{}`: every schema here is an object, but `workspace.create`'s fields are
 * all optional, so `{}` is *valid* input for it and would not exercise a refusal at all.
 */
test("every verb that takes an argument says why it refused a malformed one", () => {
  const parameterized = APP_ACTIONS.filter((action) => action.input !== undefined);

  // Guards the guard: if the vocabulary lost its parameterized half, the loop below would pass by
  // iterating nothing.
  expect(parameterized.length).toBeGreaterThan(10);

  for (const action of parameterized) {
    const refusal = refuse(action.id, 42);

    expect(typeof refusal, `${action.id} answered ${String(refusal)}`).toBe("string");
    expect(refusal, `${action.id} refused without saying why`).toMatch(/^Refused: /);
  }
});

test("a schema refusal names the field, so a caller can correct it rather than guess", () => {
  // ArkType's own summary, passed through rather than reworded — it already names every bad field
  // at once, which a hand-written message would have to keep in step with the declaration.
  const refusal = refuse("relation.connect", { sourceItemId: 123 });

  expect(refusal).toContain("sourceItemId must be a string");
  expect(refusal).toContain("targetItemId must be a string");
});

/**
 * Every verb that takes a handle, with input its schema accepts naming something that is not there.
 *
 * A table rather than a generic loop, because this refusal cannot be provoked generically: the
 * input has to *pass* the schema and then miss the world, and synthesizing that from a JSON Schema
 * is machinery to avoid writing thirteen lines. The table is the thirteen lines.
 *
 * Worth being explicit about why this table exists at all: mutating one verb's not-found branch back
 * to silence left the schema-refusal property test above **green**, because `42` never reaches the
 * lookup. The two paths need two tests, and only the first one generalizes.
 */
const HANDLE_VERBS: readonly Readonly<{ id: string; input: object }>[] = [
  { id: "content.open", input: { itemId: "never-existed" } },
  { id: "content.archive", input: { itemId: "never-existed" } },
  { id: "window.reveal", input: { windowId: "never-existed" } },
  { id: "collection.create.connectedTo", input: { itemId: "never-existed" } },
  { id: "group.dissolve", input: { groupId: "never-existed" } },
  { id: "group.rename", input: { groupId: "never-existed", title: "x" } },
  { id: "group.setLayout", input: { groupId: "never-existed", layout: "tabs" } },
  { id: "workspace.enter", input: { workspaceId: "never-existed" } },
  { id: "workspace.close", input: { workspaceId: "never-existed" } },
  { id: "workspace.moveActiveWindow", input: { workspaceId: "never-existed" } },
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

test("a handle that names nothing is refused, by every verb that takes one", () => {
  /*
   * `content.open` and `window.reveal` are the exact pair that reported "done" when driven through
   * WebMCP. A caller told an item opened goes on to act against a window that is not there, and the
   * first visible symptom is several calls downstream of the mistake.
   */
  for (const verb of HANDLE_VERBS) {
    const refusal = refuse(verb.id, verb.input);

    expect(typeof refusal, `${verb.id} answered ${String(refusal)}`).toBe("string");
    expect(refusal, `${verb.id} refused without saying why`).toMatch(/^Refused: /);
  }
});

test("the refusal says where good handles come from, not just that this one was bad", () => {
  // Naming the reporting verb is the correction. "Not found" alone tells a caller it was wrong and
  // not what to do instead, which for something that cannot see the screen is most of the answer.
  expect(refuse("content.open", { itemId: "never-existed" })).toContain("content.list");
  expect(refuse("window.reveal", { windowId: "never-existed" })).toContain("canvas.describe");
  expect(refuse("group.dissolve", { groupId: "never-existed" })).toContain("canvas.describe");
});

test("which end of a connection was wrong, rather than that one of them was", () => {
  // `resolveEndpoints` collapsed a missing source, a missing target and a self-edge into one `null`,
  // so every caller of it could only say "no such item" — a lie for the self-edge, and half an
  // answer when a caller holding two ids is not told which one to fix.
  const missingTarget = refuse("relation.connect", {
    sourceItemId: "item-1",
    targetItemId: "ghost",
  });

  expect(missingTarget).toContain("target ghost");
  expect(missingTarget).not.toContain("source item-1");
});

test("joining an item to itself is refused as itself, not as a missing item", () => {
  /*
   * Both ends resolve, so "no such item" would send a caller to check ids that are fine. The drag
   * cannot express this — it starts on one window and ends on another — so a verb that can express
   * it should not be how a self-edge first enters the database.
   */
  expect(refuse("relation.connect", { sourceItemId: "item-1", targetItemId: "item-1" })).toBe(
    "Refused: an item cannot be connected to itself.",
  );
});

test("two items that exist but are not joined is its own answer", () => {
  // Distinct from "no such item": both ends are right and the edge is what is missing, so the
  // correction is `relation.connect` rather than a different id.
  const refusal = refuse("relation.setLabel", {
    label: "because",
    sourceItemId: "item-1",
    targetItemId: "item-1",
  });

  expect(refusal).toMatch(/^Refused: /);
});

/**
 * The other thing a verb can have to say, which is not a refusal.
 *
 * `relation.disconnect` succeeds and still owes the caller a sentence, because it is the one removal
 * in this app that destroys something. `archiveProjectItem` is reversible on purpose — its docstring
 * is where the rule is written — while `fn::unrelate_content_items` deletes the row, and the canvas's
 * `history.undo` does not reach the database. Driven on 2026-08-27: undo answers "not available right
 * now", and reconnecting gives back a bare `relates`.
 */
const seedEdge = (relation: Readonly<{ kind: string; label: string | null }>) => {
  relations$.set([
    { id: "rel-1", source: "item-1", target: "item-2", ...relation },
  ] as unknown as Parameters<typeof relations$.set>[0]);
};

test("disconnecting names the kind and label it destroyed, and says they cannot be undone", () => {
  seedEdge({ kind: "supports", label: "load-bearing evidence" });

  const said = refuse("relation.disconnect", { sourceItemId: "item-1", targetItemId: "item-2" });

  expect(said).toContain("supports");
  expect(said).toContain("load-bearing evidence");
  expect(said).toContain("cannot be undone");
  // Not a refusal: it ran. The distinction matters because the adapter shows both the same way.
  expect(said).not.toMatch(/^Refused: /);
});

test("a default edge with no label says nothing, because losing it costs nothing", () => {
  /*
   * `relates` with no label is the connector's own "says nothing beyond existing" case, which
   * `getRelationLabel` renders as nothing at all. Reporting its loss would train a caller to ignore
   * the report that matters.
   */
  seedEdge({ kind: "relates", label: null });

  expect(
    refuse("relation.disconnect", { sourceItemId: "item-1", targetItemId: "item-2" }),
  ).toBeUndefined();
});

test("restore does not pretend to check an id it has no way to check", () => {
  /*
   * The deliberate exception to the table above, stated so it reads as a decision rather than an
   * omission. Archived items are absent from `projectContent$` — that observable is what the library
   * shows — so there is no local set to resolve against. Refusing would mean caching archived items
   * purely so one verb could word an error better, and `content.restore` on an id naming nothing is
   * a no-op in the database rather than a corruption.
   */
  expect(refuse("content.restore", { itemId: "never-existed" })).toBeUndefined();
  // The shape is still checked, because that costs nothing and the schema is the caller's contract.
  expect(refuse("content.restore", 42)).toMatch(/^Refused: /);
});

test("a verb that ran returns nothing, so the adapter can tell the two apart", () => {
  // The other half of the contract. If success also returned a string the adapter would have to
  // parse it to know what happened, which is the ambiguity this shape exists to remove.
  expect(refuse("note.create", undefined)).toBeUndefined();
  expect(refuse("window.reveal", { windowId: "note-1" })).toBeUndefined();
});
