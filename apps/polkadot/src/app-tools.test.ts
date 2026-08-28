import { createInfiniteCanvasState, type InfiniteCanvasCommands } from "@hyphened/infinite-canvas";
import { expect, test } from "vite-plus/test";

import type { AppActionContext } from "./app-actions";
import { getAppTools } from "./app-tools";
import type { WindowKind } from "./canvas/window-registry";

/**
 * The one list every caller gets, and what decides who gets which part of it.
 *
 * WebMCP is the only interface: the verbs reach production through it, and the development-only
 * half is registered on the same list rather than beside it on a `window` global. A second
 * transport would be reachable by any script on a page that renders third-party content.
 *
 * The tier is an argument, so both sides of the gate are reachable from here. Reading it from
 * `import.meta.env.DEV` inside `getAppTools` would have made it untestable: `DEV` is true under
 * `vp test`, so an assertion would have passed whether or not the gate existed.
 */

const createContext = (): AppActionContext => ({
  actions: { executeCommand: () => undefined } as unknown as InfiniteCanvasCommands<WindowKind>,
  canvasId: "canvas_document:test",
  canvasTitle: "Test",
  goToCanvas: () => undefined,
  projectId: "project:test",
  refreshRoute: () => undefined,
  state: createInfiniteCanvasState<WindowKind>({ windows: [] }),
});

const tools = (development = true) =>
  getAppTools({ createContext, development, projectId: "project:test" });

const find = (name: string) => tools().find((tool) => tool.name === name);

const takesInput = (name: string) =>
  Object.keys(
    (find(name)?.inputSchema as Readonly<{ properties?: object }> | undefined)?.properties ?? {},
  ).length > 0;

test("the list holds the whole vocabulary, each verb named once", () => {
  const names = tools().map((tool) => tool.name);

  expect(names).toContain("canvas.describe");
  expect(names).toContain("note.create");
  expect(names).toContain("view.fitAll");
  expect(new Set(names).size).toBe(names.length);
});

test("a verb taking an argument publishes the schema it takes", () => {
  expect(takesInput("content.rename")).toBe(true);
  expect(find("content.rename")?.inputSchema).toMatchObject({
    properties: { itemId: { type: "string" }, title: { type: "string" } },
  });
});

test("a verb taking nothing publishes no properties", () => {
  expect(takesInput("canvas.describe")).toBe(false);
});

test("a refusal reaches the caller rather than a success", async () => {
  await expect(find("window.reveal")?.execute({ windowId: "nope" })).resolves.toContain("Refused:");
});

test("a reporter answers with its report", async () => {
  await expect(find("canvas.describe")?.execute()).resolves.toContain("Zoom");
});

/**
 * The gap that made a caller discover availability by failing.
 *
 * WebMCP publishes a fixed set and carries no enablement, so without this a caller holding a
 * hundred names has to invoke one to find out whether it applies.
 */
test("a caller can ask what is available before trying it", async () => {
  const said = (await find("command.list")?.execute()) ?? "";
  // The blocked half specifically. Asserting the name against the whole sentence proves nothing —
  // it appears either way, and a first draft of this test passed with enablement ignored entirely.
  const blocked = said.slice(said.indexOf("Not available right now:"));

  // Nothing is open and nothing is selected, so a verb needing a selection has to be blocked.
  expect(blocked).toContain("group.createFromSelection");
});

/**
 * The gate, exercised in both directions rather than asserted in the one the test happens to run in.
 *
 * `database.query` runs arbitrary SurQL, so it bypasses every schema, refusal and revision guard
 * the vocabulary enforces. It exists because confirming a write means asking the database, and no
 * published verb does — but shipping it would make those guards optional for anything on this list.
 */
const databaseTools = (development: boolean) =>
  tools(development)
    .map((tool) => tool.name)
    .filter((name) => name.startsWith("database."));

test("reading the database directly is offered in development", () => {
  expect(databaseTools(true)).toStrictEqual(["database.query", "database.report"]);
});

test("and is absent from what a production page publishes", () => {
  expect(databaseTools(false)).toStrictEqual([]);
});

test("gating removes nothing else, so the two tiers differ by exactly that", () => {
  const shipped = new Set(tools(false).map((tool) => tool.name));

  expect(tools(true).filter((tool) => !shipped.has(tool.name))).toHaveLength(2);
});

test("the database tool refuses input its schema would let through", async () => {
  await expect(find("database.query")?.execute({ statement: "   " })).resolves.toContain(
    "Refused:",
  );
});

/**
 * A description that sends a caller to another tool has to send it somewhere.
 *
 * Half these descriptions are wayfinding — "with the ids `content.restore` takes", "Ids come from
 * `content.list`" — which is the only way a caller learns the order to call things in. A renamed or
 * removed verb leaves the sentence pointing at a name that no longer resolves, and the caller finds
 * out by invoking it. Nothing else here would notice: the description is a string, and a string
 * cannot be wrong at compile time.
 *
 * This is the same failure that was live one commit ago, in its other form — `canvas.describe`
 * described a selection it did not report. That half cannot be checked mechanically. This half can.
 *
 * **Namespaces come from the tool names themselves rather than a list kept here**, so the scan
 * cannot drift from the vocabulary it checks, and prose is safe by construction: a dotted word is
 * only examined when its prefix is already a real tool namespace, which "e.g." and "import.meta"
 * are not.
 */
const DOTTED = /\b[a-z]+\.[a-zA-Z]+\b/g;

test("every tool a description names is a tool that exists", () => {
  const all = tools();
  const names = new Set(all.map((tool) => tool.name));
  const namespaces = new Set(all.map((tool) => tool.name.split(".")[0]));

  const dangling = all.flatMap((tool) =>
    (tool.description.match(DOTTED) ?? [])
      .filter((token) => namespaces.has(token.split(".")[0] ?? "") && !names.has(token))
      .map((token) => `${tool.name} sends a caller to ${token}`),
  );

  expect(dangling).toStrictEqual([]);
});

test.each([
  ["a renamed verb", "with the ids content.restoreItem takes"],
  ["a removed one", "Ids come from content.listEverything."],
])("the scan notices %s", (_case, description) => {
  const names = new Set(tools().map((tool) => tool.name));
  const namespaces = new Set(tools().map((tool) => tool.name.split(".")[0]));
  const flagged = (description.match(DOTTED) ?? []).filter(
    (token) => namespaces.has(token.split(".")[0] ?? "") && !names.has(token),
  );

  expect(flagged).toHaveLength(1);
});

test("a report that points at another tool points at a real one", () => {
  /*
   * The scan above reads descriptions. `describeCanvas` names a tool in its *output* — "content.list
   * names them", because the canvas report counts selected connections and the content report is
   * what identifies them — and output cannot be scanned without building a context for every
   * reporter. This is that one reference, asserted where the names live: rename the tool and this
   * fails, naming the sentence that has to move with it.
   */
  expect(tools().map((tool) => tool.name)).toContain("content.list");
});

test("it does not read ordinary prose as a tool reference", () => {
  // Neither prefix is a tool namespace, so neither token is examined at all.
  const prose = "Development only. Run SurQL, e.g. against import.meta paths.";
  const namespaces = new Set(tools().map((tool) => tool.name.split(".")[0]));

  expect(
    (prose.match(DOTTED) ?? []).filter((token) => namespaces.has(token.split(".")[0] ?? "")),
  ).toStrictEqual([]);
});
