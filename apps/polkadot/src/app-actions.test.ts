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

  getAppAction("window.reveal")?.run({ actions, projectId: "project-1", state }, input);

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
  getAppAction("content.open")?.run({ actions, projectId: "project-1", state }, input);

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
      { actions, projectId: "project-1", state },
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

test("disconnecting names the pair and nothing else", () => {
  const input = relationInput("relation.disconnect");

  expect(input?.({ sourceItemId: "item-1", targetItemId: "item-2" })).toStrictEqual({
    sourceItemId: "item-1",
    targetItemId: "item-2",
  });
  expect(input?.({})).toBeInstanceOf(type.errors);
});

test("the verbs that take nothing publish no input, so they stay palette rows", () => {
  expect(getAppAction("note.create")?.input).toBeUndefined();
  expect(getAppAction("group.createFromSelection")?.input).toBeUndefined();
});
