import {
  createInfiniteCanvasState,
  createInfiniteCanvasWindow,
  type InfiniteCanvasCommand,
  type InfiniteCanvasCommands,
} from "@hyphened/infinite-canvas";
import { expect, test } from "vite-plus/test";

import { getAppAction } from "./app-actions";
import type { WindowKind } from "./canvas/window-registry";
import { projectContent$, type ProjectContent } from "./content/project-content";

/**
 * The vocabulary's parameterized half.
 *
 * Every other entry is callable with nothing, so "does it run" and "does it accept the right
 * shape" were the same question. `window.reveal` separates them, and the thing worth pinning is
 * that its published schema and its validation are the same declaration — a caller offered
 * `{ title: string }` and a verb that quietly accepted something else is the failure this shape
 * exists to prevent, and nothing about it shows in a typecheck.
 */

const state = createInfiniteCanvasState<WindowKind>({
  viewport: { height: 800, width: 1200 },
  windows: [
    createInfiniteCanvasWindow<WindowKind>({
      id: "note-1",
      kind: "note",
      rect: { height: 200, width: 320, x: 0, y: 0 },
      title: "Quarterly notes",
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

test("a window is reached by the title a caller can actually see", () => {
  expect(runReveal({ title: "Quarterly notes" })).toStrictEqual([
    { type: "window.reveal", windowId: "note-1" },
  ]);
});

test("reveal, not focus, so a minimized or tabbed window is actually shown", () => {
  // Focusing alone leaves a window behind a tab exactly where it was. The command matters.
  expect(runReveal({ title: "Untitled" })[0]?.type).toBe("window.reveal");
});

test("a title no window answers to does nothing rather than reaching for the wrong one", () => {
  expect(runReveal({ title: "Nothing is called this" })).toStrictEqual([]);
});

test("input that does not match the published schema is refused", () => {
  // The point of one declaration serving both halves: these are exactly the shapes
  // `toJsonSchema()` tells a caller are unacceptable, and the verb has to agree.
  expect(runReveal({})).toStrictEqual([]);
  expect(runReveal({ title: 7 })).toStrictEqual([]);
  expect(runReveal(undefined)).toStrictEqual([]);
  expect(runReveal("Quarterly notes")).toStrictEqual([]);
});

test("the published schema is the one the verb validates against", () => {
  const schema = getAppAction("window.reveal")?.input?.toJsonSchema() as
    | Readonly<{ properties: Readonly<{ title: Readonly<{ type: string }> }>; required: string[] }>
    | undefined;

  expect(schema?.properties.title.type).toBe("string");
  expect(schema?.required).toStrictEqual(["title"]);
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
  // Both records are called "Untitled". Only the id can say which one, which is the whole reason
  // this verb takes an id where `window.reveal` takes a title.
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

test("the verbs that take nothing publish no input, so they stay palette rows", () => {
  expect(getAppAction("note.create")?.input).toBeUndefined();
  expect(getAppAction("group.createFromSelection")?.input).toBeUndefined();
});
