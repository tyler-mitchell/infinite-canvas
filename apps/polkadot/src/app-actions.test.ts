import {
  createInfiniteCanvasState,
  createInfiniteCanvasWindow,
  type InfiniteCanvasCommand,
  type InfiniteCanvasCommands,
} from "@hyphened/infinite-canvas";
import { type } from "arktype";
import { expect, test } from "vite-plus/test";

import { getAppAction } from "./app-actions";
import { RELATION_KINDS } from "./relations/relation-store";
import type { WindowKind } from "./canvas/window-registry";
import { projectContent$, type ProjectContent } from "./content/project-content";

/**
 * Every context carries these, and most verbs exercised here read none of them.
 *
 * Which canvas a verb is standing in comes from the route, and going to another is a route change —
 * so the context supplies both rather than any verb reaching for a router or for state of its own.
 * The verbs under test are the parameterized ones, none of which navigates; a canvas verb that does
 * gets its own fixture below, asserting where it went.
 */
const where = { canvasId: "canvas-1", canvasTitle: "Main canvas" };
const goToCanvas = () => undefined;

/**
 * The vocabulary's parameterized half.
 *
 * Every other entry is callable with nothing, so "does it run" and "does it accept the right
 * shape" were the same question. `window.reveal` separates them, and the thing worth pinning is
 * that its published schema and its validation are the same declaration — a caller offered
 * `{ windowId: string }` and a verb that quietly accepted something else is the failure this shape
 * exists to prevent, and nothing about it shows in a typecheck.
 *
 * Both windows in the fixture are called "Untitled", deliberately. This verb used to take a title
 * and first-match, and the test that covered it used two windows with different titles — so it
 * passed while the ambiguity it should have caught went untested. A fixture where the titles
 * collide cannot be satisfied by anything except an identity.
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
    createInfiniteCanvasWindow<WindowKind>({
      id: "note-2",
      kind: "note",
      rect: { height: 200, width: 320, x: 400, y: 0 },
      title: "Untitled",
    }),
  ],
});

const runReveal = (input: unknown) => {
  const commands: InfiniteCanvasCommand[] = [];
  const actions = {
    executeCommand: (command: InfiniteCanvasCommand) => {
      commands.push(command);
    },
  } as unknown as InfiniteCanvasCommands<WindowKind>;

  getAppAction("window.reveal")?.run(
    { actions, ...where, goToCanvas, projectId: "project-1", state },
    input,
  );

  return commands;
};

test("each window is reached by its own handle, though both answer to one name", () => {
  expect(runReveal({ windowId: "note-1" })).toStrictEqual([
    { type: "window.reveal", windowId: "note-1" },
  ]);
  expect(runReveal({ windowId: "note-2" })).toStrictEqual([
    { type: "window.reveal", windowId: "note-2" },
  ]);
});

test("reveal, not focus, so a minimized or tabbed window is actually shown", () => {
  // Focusing alone leaves a window behind a tab exactly where it was. The command matters.
  expect(runReveal({ windowId: "note-2" })[0]?.type).toBe("window.reveal");
});

test("an id no window answers to does nothing rather than reaching for the wrong one", () => {
  expect(runReveal({ windowId: "never-existed" })).toStrictEqual([]);
});

test("a title is refused, because a name is not an identity", () => {
  // The verb took this shape until two windows on one canvas were both called "Links" and it
  // revealed whichever came first. Refusing it is what keeps that from being reintroduced quietly.
  expect(runReveal({ title: "Untitled" })).toStrictEqual([]);
});

test("input that does not match the published schema is refused", () => {
  // The point of one declaration serving both halves: these are exactly the shapes
  // `toJsonSchema()` tells a caller are unacceptable, and the verb has to agree.
  expect(runReveal({})).toStrictEqual([]);
  expect(runReveal({ windowId: 7 })).toStrictEqual([]);
  expect(runReveal(undefined)).toStrictEqual([]);
  expect(runReveal("note-1")).toStrictEqual([]);
});

test("the published schema is the one the verb validates against", () => {
  const schema = getAppAction("window.reveal")?.input?.toJsonSchema() as
    | Readonly<{
        properties: Readonly<{ windowId: Readonly<{ type: string }> }>;
        required: string[];
      }>
    | undefined;

  expect(schema?.properties.windowId.type).toBe("string");
  expect(schema?.required).toStrictEqual(["windowId"]);
});

/**
 * `content.open` resolves against the cache `content.list` reads, which is what makes the pair
 * compose: an id that listed a moment ago cannot fail here for having come from a different read.
 */
const runOpen = (input: unknown, listing: ProjectContent | null) => {
  const opened: string[] = [];
  const actions = {
    executeCommand: () => undefined,
    openWindow: (window: Readonly<{ data?: Readonly<{ itemId?: string }> }>) => {
      opened.push(window.data?.itemId ?? "");
    },
  } as unknown as InfiniteCanvasCommands<WindowKind>;

  projectContent$.set(listing);
  getAppAction("content.open")?.run(
    { actions, ...where, goToCanvas, projectId: "project-1", state },
    input,
  );

  return opened;
};

const stored: ProjectContent = {
  items: [
    { archived: false, id: "item-1", kind: "note", projectId: "project-1", title: "Untitled" },
    { archived: false, id: "item-2", kind: "note", projectId: "project-1", title: "Untitled" },
  ] as unknown as ProjectContent["items"],
  projectId: "project-1",
};

test("an item is opened by the id the listing gave, not by a title that repeats", () => {
  // Both records are called "Untitled". Only the id can say which one — the same rule `window.reveal`
  // now follows, after a spell taking a title on the belief that windows were somehow different.
  expect(runOpen({ itemId: "item-2" }, stored)).toStrictEqual(["item-2"]);
});

test("an id from another project's listing opens nothing", () => {
  expect(runOpen({ itemId: "item-1" }, { ...stored, projectId: "elsewhere" })).toStrictEqual([]);
});

test("an id in no listing opens nothing rather than the nearest thing", () => {
  expect(runOpen({ itemId: "never-existed" }, stored)).toStrictEqual([]);
  expect(runOpen({ itemId: "item-1" }, null)).toStrictEqual([]);
});

test("content.open refuses input its published schema does not accept", () => {
  expect(runOpen({}, stored)).toStrictEqual([]);
  expect(runOpen({ itemId: 7 }, stored)).toStrictEqual([]);
  expect(runOpen(undefined, stored)).toStrictEqual([]);
});

/**
 * Only the refusals are asserted, and the omission is deliberate rather than an oversight.
 *
 * `openNewCollection` creates the collection record before it opens anything, so nothing this verb
 * does on the success path is observable without a database — a synchronous assertion that a window
 * appeared would be asserting against the mock rather than against the code. The refusals need no
 * database, because they never get that far: that is exactly what makes them worth pinning here.
 */
test("a connected-to collection refuses an id it cannot resolve", () => {
  const opened: string[] = [];
  const actions = {
    executeCommand: () => undefined,
    openWindow: () => {
      opened.push("opened");
    },
  } as unknown as InfiniteCanvasCommands<WindowKind>;
  const attempt = (input: unknown, listing: ProjectContent | null) => {
    projectContent$.set(listing);
    getAppAction("collection.create.connectedTo")?.run(
      { actions, ...where, goToCanvas, projectId: "project-1", state },
      input,
    );
  };

  attempt({ itemId: "never-existed" }, stored);
  attempt({ itemId: "item-1" }, null);
  attempt({}, stored);
  attempt(undefined, stored);

  expect(opened).toStrictEqual([]);
});

/**
 * Joining two items was reachable by a pointer and by nothing else.
 *
 * `connectItems` and `disconnectItems` existed as module functions, called from a drag gesture and
 * from palette rows — so on a canvas whose point is relating things, relating was the one capability
 * an agent could not perform. The report now says how the project is joined; these are the verbs
 * that let a caller act on what it read.
 *
 * Only the schema is asserted, for the reason the connected-to verb above gives: the success path
 * writes to the database before anything is observable, so a synchronous assertion would be checking
 * a mock rather than the code. The schema is not a mock — it is the same declaration the verb
 * narrows with and the one `model-context` publishes, so a caller is offered exactly this.
 */
const relationInput = (id: string) => getAppAction(id)?.input;

test("connecting takes two item ids, because an edge joins records rather than windows", () => {
  const input = relationInput("relation.connect");

  expect(input?.({ sourceItemId: "item-1", targetItemId: "item-2" })).toStrictEqual({
    sourceItemId: "item-1",
    targetItemId: "item-2",
  });
  expect(input?.({ sourceItemId: "item-1" })).toBeInstanceOf(type.errors);
  expect(input?.({ windowId: "note-1" })).toBeInstanceOf(type.errors);
});

test("a connection can say what it means, and only in the words the model has", () => {
  const input = relationInput("relation.connect");

  expect(
    input?.({ kind: "supports", sourceItemId: "item-1", targetItemId: "item-2" }),
  ).toStrictEqual({ kind: "supports", sourceItemId: "item-1", targetItemId: "item-2" });
  // Not one of RELATION_KINDS. Accepting it would store a kind nothing renders and nothing queries.
  expect(
    input?.({ kind: "vaguely about", sourceItemId: "item-1", targetItemId: "item-2" }),
  ).toBeInstanceOf(type.errors);
});

test("the kind is optional, because the drag gesture cannot express one either", () => {
  expect(
    relationInput("relation.connect")?.({ sourceItemId: "item-1", targetItemId: "item-2" }),
  ).not.toBeInstanceOf(type.errors);
});

test("the published schema offers the five kinds, so a caller need not guess them", () => {
  const schema = relationInput("relation.connect")?.toJsonSchema() as
    | Readonly<{ properties: Readonly<{ kind: Readonly<{ enum?: readonly string[] }> }> }>
    | undefined;

  // Compared as a set: ArkType emits the values sorted, and a JSON Schema enum is a set anyway.
  expect([...(schema?.properties.kind.enum ?? [])].sort()).toStrictEqual(
    [...RELATION_KINDS].sort(),
  );
});

test("re-typing an existing connection insists on a kind, unlike connecting", () => {
  const input = relationInput("relation.setKind");

  expect(
    input?.({ kind: "refines", sourceItemId: "item-1", targetItemId: "item-2" }),
  ).toStrictEqual({ kind: "refines", sourceItemId: "item-1", targetItemId: "item-2" });
  // Connecting without a kind is a real intent — it is what the drag does. Re-typing to nothing
  // is not, so the field that is optional there is required here.
  expect(input?.({ sourceItemId: "item-1", targetItemId: "item-2" })).toBeInstanceOf(type.errors);
});

test("a connection is addressed by its ends, not by a relation id", () => {
  /*
   * The store's own functions take a relation id, because a person clicked a connector. Copying
   * that signature here would have published a handle no report gives a caller.
   *
   * The first assertion is the decisive one, and it is decisive because both ends are valid: the
   * undeclared key is the only thing wrong with that input, so it passing proves the schema is
   * exact rather than merely permissive about shapes it does not mention.
   */
  const ends = { sourceItemId: "item-1", targetItemId: "item-2" };

  expect(relationInput("relation.setKind")?.({ ...ends, relationId: "r-1" })).toBeInstanceOf(
    type.errors,
  );
  expect(relationInput("relation.setLabel")?.({ label: "x", relationId: "r-1" })).toBeInstanceOf(
    type.errors,
  );
});

test("an empty label is accepted, because clearing one is a thing to want", () => {
  expect(
    relationInput("relation.setLabel")?.({
      label: "",
      sourceItemId: "item-1",
      targetItemId: "item-2",
    }),
  ).not.toBeInstanceOf(type.errors);
});

test("the four verbs an edge needs are all published", () => {
  // Make one, say what it means, write on it, cut it. A vocabulary missing any of these leaves a
  // capability the pointer has and a caller does not.
  for (const id of [
    "relation.connect",
    "relation.setKind",
    "relation.setLabel",
    "relation.disconnect",
  ]) {
    expect(getAppAction(id)?.input).toBeDefined();
  }
});

test("disconnecting names the pair and nothing else", () => {
  const input = relationInput("relation.disconnect");

  expect(input?.({ sourceItemId: "item-1", targetItemId: "item-2" })).toStrictEqual({
    sourceItemId: "item-1",
    targetItemId: "item-2",
  });
  expect(input?.({})).toBeInstanceOf(type.errors);
});

/**
 * Naming a container, which the contextual `group.*` commands cannot do.
 *
 * Those act on the active window's container — right for a keyboard, where "the group" is the one
 * you are in. A caller that cannot see the screen is in none, and had to reveal a member window
 * first and hope it landed in the container it meant.
 *
 * These verbs call the framework facade synchronously and touch no database, so unlike the relation
 * verbs their behaviour is assertable rather than only their schemas — the calls are recorded here.
 */
const groupState = (tree: unknown) =>
  createInfiniteCanvasState<WindowKind>({
    groups: [
      {
        id: "group-1",
        rect: { height: 400, width: 600, x: 0, y: 0 },
        title: "Reading list",
        tree,
        zIndex: 0,
      },
    ] as never,
    viewport: { height: 800, width: 1200 },
    windows: [
      createInfiniteCanvasWindow<WindowKind>({
        id: "a",
        kind: "note",
        rect: { height: 200, width: 320, x: 0, y: 0 },
        title: "Sources",
      }),
      createInfiniteCanvasWindow<WindowKind>({
        id: "b",
        kind: "note",
        rect: { height: 200, width: 320, x: 400, y: 0 },
        title: "Draft",
      }),
    ],
  });

const CONTAINER_TREE = {
  activeChildId: "a",
  axis: "horizontal",
  children: [
    { id: "a", kind: "window", weight: 1 },
    { id: "b", kind: "window", weight: 1 },
  ],
  id: "container-1",
  kind: "container",
  layout: "split",
  weight: 1,
};

/** A group holding one window is a leaf, not a container — there is no shape to arrange. */
const LEAF_TREE = { id: "a", kind: "window", weight: 1 };

const runGroupVerb = (id: string, input: unknown, tree: unknown = CONTAINER_TREE) => {
  const calls: unknown[] = [];
  const actions = {
    closeGroup: (groupId: string) => calls.push({ closeGroup: groupId }),
    setGroupLayoutMode: (value: unknown) => calls.push({ setGroupLayoutMode: value }),
    setGroupTitle: (value: unknown) => calls.push({ setGroupTitle: value }),
  } as unknown as InfiniteCanvasCommands<WindowKind>;

  getAppAction(id)?.run(
    { actions, ...where, goToCanvas, projectId: "project-1", state: groupState(tree) },
    input,
  );

  return calls;
};

test("a group is arranged by its own id, not by whichever window happens to be active", () => {
  expect(runGroupVerb("group.setLayout", { groupId: "group-1", layout: "tabs" })).toStrictEqual([
    { setGroupLayoutMode: { containerId: "container-1", groupId: "group-1", layout: "tabs" } },
  ]);
});

test("the container id is resolved here, because it is a fact about the tree", () => {
  // A caller holds the group id the canvas description publishes. Making it carry a container id
  // would be making it carry the shape of a tree it cannot see.
  const calls = runGroupVerb("group.setLayout", { containerId: "container-1", groupId: "group-1" });

  expect(calls).toStrictEqual([]);
});

test("arranging a group that holds one window does nothing, as the framework already reports", () => {
  expect(
    runGroupVerb("group.setLayout", { groupId: "group-1", layout: "tabs" }, LEAF_TREE),
  ).toStrictEqual([]);
});

test("only the three modes the framework implements are accepted", () => {
  expect(runGroupVerb("group.setLayout", { groupId: "group-1", layout: "grid" })).toStrictEqual([]);
});

test("renaming and ungrouping take the same handle, and refuse an id naming no group", () => {
  expect(runGroupVerb("group.rename", { groupId: "group-1", title: "Sources" })).toStrictEqual([
    { setGroupTitle: { groupId: "group-1", title: "Sources" } },
  ]);
  expect(runGroupVerb("group.dissolve", { groupId: "group-1" })).toStrictEqual([
    { closeGroup: "group-1" },
  ]);
  expect(runGroupVerb("group.rename", { groupId: "nope", title: "x" })).toStrictEqual([]);
  expect(runGroupVerb("group.dissolve", { groupId: "nope" })).toStrictEqual([]);
});

test("an empty title is accepted, because it returns a group to being named by its members", () => {
  // `InfiniteCanvasGroup.title` uses that to mean "named after what it holds", so clearing is a
  // thing to want rather than a malformed input.
  expect(runGroupVerb("group.rename", { groupId: "group-1", title: "" })).toStrictEqual([
    { setGroupTitle: { groupId: "group-1", title: "" } },
  ]);
});

/**
 * Desktops, which the framework publishes only as templates.
 *
 * Its four `workspace.*` descriptors carry `workspaceId: ""`, so `published-commands.ts` holds them
 * back rather than offer a verb that acts on a workspace called `""`. These supply the argument.
 */
const workspaceState = (workspaces: readonly Readonly<{ id: string; title: string }>[]) =>
  createInfiniteCanvasState<WindowKind>({
    activeWindowId: "note-1",
    viewport: { height: 800, width: 1200 },
    windows: [
      createInfiniteCanvasWindow<WindowKind>({
        id: "note-1",
        kind: "note",
        rect: { height: 200, width: 320, x: 0, y: 0 },
        title: "Sources",
      }),
    ],
    workspaces: workspaces.map((workspace) => ({ ...workspace, windowIds: [] })) as never,
  });

const runWorkspaceVerb = (
  id: string,
  input: unknown,
  workspaces: readonly Readonly<{ id: string; title: string }>[] = [
    { id: "desk-1", title: "Desktop 1" },
  ],
) => {
  const commands: InfiniteCanvasCommand[] = [];
  const actions = {
    executeCommand: (command: InfiniteCanvasCommand) => {
      commands.push(command);
    },
  } as unknown as InfiniteCanvasCommands<WindowKind>;

  getAppAction(id)?.run(
    { actions, ...where, goToCanvas, projectId: "project-1", state: workspaceState(workspaces) },
    input,
  );

  return commands;
};

test("a new desktop is numbered past the highest name taken, never by a count", () => {
  /*
   * The rule `titles.ts` exists for, and the switcher and the palette both had the count form.
   * Close "Desktop 2" of three and a count hands out "Desktop 3" while a "Desktop 3" is still open
   * — on a thing you switch to *by name*, which is where that hurts most.
   */
  const created = runWorkspaceVerb("workspace.create", {}, [
    { id: "a", title: "Desktop 1" },
    { id: "c", title: "Desktop 3" },
  ]);

  expect(created[0]).toMatchObject({ title: "Desktop 4", type: "workspace.create" });
});

test("a desktop somebody names keeps that name", () => {
  expect(runWorkspaceVerb("workspace.create", { title: "Reading" })[0]).toMatchObject({
    title: "Reading",
  });
});

test("entering, closing and moving all refuse an id no desktop answers to", () => {
  for (const id of ["workspace.enter", "workspace.close", "workspace.moveActiveWindow"]) {
    expect(runWorkspaceVerb(id, { workspaceId: "desk-1" })).toHaveLength(1);
    expect(runWorkspaceVerb(id, { workspaceId: "never-existed" })).toStrictEqual([]);
  }
});

test("moving the active window needs one, not just a desktop", () => {
  // Both facts are checked because either alone is a no-op that would report success.
  const noActiveWindow = createInfiniteCanvasState<WindowKind>({
    viewport: { height: 800, width: 1200 },
    windows: [],
    workspaces: [{ id: "desk-1", title: "Desktop 1", windowIds: [] }] as never,
  });
  const commands: InfiniteCanvasCommand[] = [];
  const actions = {
    executeCommand: (command: InfiniteCanvasCommand) => commands.push(command),
  } as unknown as InfiniteCanvasCommands<WindowKind>;

  getAppAction("workspace.moveActiveWindow")?.run(
    { actions, ...where, goToCanvas, projectId: "project-1", state: noActiveWindow },
    { workspaceId: "desk-1" },
  );

  expect(commands).toStrictEqual([]);
});

/**
 * The document level, which the vocabulary could not name until now.
 *
 * Only the parts that need no database are asserted, the same line `collection.create.connectedTo`
 * draws above: creating a canvas writes a record before anything is observable, so a synchronous
 * assertion there would be checking the mock. What is checkable is where a verb decides to send
 * you, and every one of these decisions was previously unreachable by anything but a pointer.
 */

const documentContext = (goTo: (canvasId: string) => void) => ({
  actions: { executeCommand: () => undefined } as unknown as InfiniteCanvasCommands<WindowKind>,
  ...where,
  goToCanvas: goTo,
  projectId: "project-1",
  state,
});

test("going to a canvas navigates to the id it was handed, and nowhere else", () => {
  const visited: string[] = [];

  getAppAction("canvas.open")?.run(
    documentContext((id) => visited.push(id)),
    {
      canvasId: "canvas-7",
    },
  );

  expect(visited).toStrictEqual(["canvas-7"]);
});

test("duplicating names the copy after the canvas the context says it is in", () => {
  /*
   * There is no "nothing is open" case to refuse, and that is the point of taking the canvas from
   * the route rather than from state beside it: `/canvas/$canvasId` cannot resolve without one, so
   * a context exists only where a canvas does. An earlier version published the id into an
   * observable and had to refuse `null` — a branch that existed only because the copy could go
   * stale against the URL.
   */
  expect(getAppAction("canvas.duplicate")?.input).toBeUndefined();
  expect(getAppAction("canvas.duplicate")?.label).toBe("Duplicate this canvas");
});

test("going to the project you are already in does not move the canvas", async () => {
  /*
   * The same rule the switcher and the palette ask, reached through the same function — so the verb
   * cannot drift from them. Before that rule was shared, this walked you to whichever canvas of
   * that project was written last.
   */
  const visited: string[] = [];

  getAppAction("project.open")?.run(
    documentContext((id) => visited.push(id)),
    {
      projectId: "project-1",
    },
  );

  // The verb answers through a promise; nothing here touches a database, so one turn settles it.
  await new Promise((resolve) => setTimeout(resolve, 0));

  expect(visited).toStrictEqual([]);
});

test("the four desktop verbs shadow the framework templates they complete", () => {
  // Same relationship `window.reveal` has: the framework publishes the shape, the app supplies the
  // argument, and `published-commands.ts` keeps the template out so one name means one tool.
  for (const id of [
    "workspace.create",
    "workspace.enter",
    "workspace.close",
    "workspace.moveActiveWindow",
  ]) {
    expect(getAppAction(id)?.input).toBeDefined();
  }
});

test("the verbs that take nothing publish no input, so they stay palette rows", () => {
  expect(getAppAction("note.create")?.input).toBeUndefined();
  expect(getAppAction("group.createFromSelection")?.input).toBeUndefined();
});
