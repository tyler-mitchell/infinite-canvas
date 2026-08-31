import { createInfiniteCanvasState, type InfiniteCanvasCommands } from "@hyphened/infinite-canvas";
import { expect, test } from "vite-plus/test";

import type { AppActionContext } from "./app-actions";
import { getAppTools } from "./app-tools";
import type { WindowKind } from "./canvas/window-registry";

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

test("a caller can ask what is available before trying it", async () => {
  const said = (await find("command.list")?.execute()) ?? "";
  const blocked = said.slice(said.indexOf("Not available right now:"));

  expect(blocked).toContain("group.createFromSelection");
});

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
  expect(tools().map((tool) => tool.name)).toContain("content.list");
});

test("it does not read ordinary prose as a tool reference", () => {
  const prose = "Development only. Run SurQL, e.g. against import.meta paths.";
  const namespaces = new Set(tools().map((tool) => tool.name.split(".")[0]));

  expect(
    (prose.match(DOTTED) ?? []).filter((token) => namespaces.has(token.split(".")[0] ?? "")),
  ).toStrictEqual([]);
});
