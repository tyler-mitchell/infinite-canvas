import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

import { DEFAULT_INFINITE_CANVAS_COMMAND_DESCRIPTORS } from "@hyphened/infinite-canvas";
import { expect, test } from "vite-plus/test";

const sourceRoot = fileURLToPath(new URL("..", import.meta.url));

const sources = readdirSync(sourceRoot, { recursive: true, withFileTypes: true })
  .filter(
    (entry) => entry.isFile() && /\.tsx?$/.test(entry.name) && !/\.test\.tsx?$/.test(entry.name),
  )
  .map((entry) => join(entry.parentPath, entry.name));

const COMMAND_CAST =
  /\bas\s+(?:InfiniteCanvasCommand\b|Parameters\s*<\s*typeof\s+[\w.]+\.executeCommand)/;

const isComment = (line: string) => /^\s*(?:\/\/|\/\*|\*)/.test(line);

test("no source asserts a value into the framework's command type", () => {
  const offenders = sources.flatMap((path) => {
    const relative = path.slice(sourceRoot.length);

    return readFileSync(path, "utf8")
      .split("\n")
      .flatMap((line, index) =>
        COMMAND_CAST.test(line) && !isComment(line)
          ? [`${relative}:${String(index + 1)}: ${line.trim()}`]
          : [],
      );
  });

  expect(offenders).toStrictEqual([]);
});

test("the check bites on the exact cast that was there", () => {
  expect(
    COMMAND_CAST.test(
      "      actions.executeCommand({ type: id } as Parameters<typeof actions.executeCommand>[0]);",
    ),
  ).toBe(true);
  expect(COMMAND_CAST.test("    const command = { type: id } as InfiniteCanvasCommand;")).toBe(
    true,
  );
});

test("the check does not fire on the lookup that replaced it, or on an id narrowing", () => {
  expect(COMMAND_CAST.test("      actions.executeCommand(descriptor.command);")).toBe(false);
  expect(
    COMMAND_CAST.test('  { icon: Scan, id: "view.fitSelection" as InfiniteCanvasCommandId },'),
  ).toBe(false);
});

const WINDOW_DATA_CAST = /\.data\s+as\b/;

test("no source asserts a shape onto a window's data", () => {
  const offenders = sources.flatMap((path) => {
    const relative = path.slice(sourceRoot.length);

    return readFileSync(path, "utf8")
      .split("\n")
      .flatMap((line, index) =>
        WINDOW_DATA_CAST.test(line) && !isComment(line)
          ? [`${relative}:${String(index + 1)}: ${line.trim()}`]
          : [],
      );
  });

  expect(offenders).toStrictEqual([]);
});

test("that check bites on all four spellings this repo actually shipped", () => {
  for (const line of [
    "  const data = window.data as { noteId?: string };",
    "        state.windows.find((window) => window.id === windowId)?.data as",
    "  const itemId = (win.data as { itemId?: string } | undefined)?.itemId;",
    "      const noteId = w.data as Record<string, string>;",
  ]) {
    expect(WINDOW_DATA_CAST.test(line)).toBe(true);
  }
});

test("it does not fire on the narrowings that replaced them", () => {
  for (const line of [
    "      getInfiniteCanvasWindowData(window, ContentWindowData.allows)?.itemId;",
    "      return selected === undefined ? null : getContentWindowItemId(selected);",
    '  const parsed = metadata as { kind: "note" };',
  ]) {
    expect(WINDOW_DATA_CAST.test(line)).toBe(false);
  }
});

test("the framework really does ship verbs whose id is not their command type", () => {
  const encodesAnArgument = DEFAULT_INFINITE_CANVAS_COMMAND_DESCRIPTORS.filter(
    (descriptor) => descriptor.command.type !== descriptor.id,
  );

  expect(encodesAnArgument.length).toBeGreaterThan(0);
});
