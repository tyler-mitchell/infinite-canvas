import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

import { expect, test } from "vite-plus/test";

const sourceRoot = fileURLToPath(new URL("..", import.meta.url));

const sources = readdirSync(sourceRoot, { recursive: true, withFileTypes: true })
  .filter(
    (entry) => entry.isFile() && /\.tsx?$/.test(entry.name) && !/\.test\.tsx?$/.test(entry.name),
  )
  .map((entry) => join(entry.parentPath, entry.name));

const isComment = (line: string) => /^\s*(?:\/\/|\/\*|\*)/.test(line);

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
