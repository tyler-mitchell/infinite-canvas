import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

import { getInfiniteCanvasWindowData } from "@hyphened/infinite-canvas";
import { expect, test } from "vite-plus/test";

import { ContentWindowData } from "./window-registry";

const sourceRoot = fileURLToPath(new URL("..", import.meta.url));

const sources = readdirSync(sourceRoot, { recursive: true, withFileTypes: true })
  .filter(
    (entry) => entry.isFile() && /\.tsx?$/.test(entry.name) && !/\.test\.tsx?$/.test(entry.name),
  )
  .map((entry) => join(entry.parentPath, entry.name));

const WINDOW_DATA_CAST = /\bdata\s+as\s+(?:Readonly\s*<|\{|[A-Z])/;

const isComment = (line: string) => /^\s*(?:\/\/|\/\*|\*)/.test(line);

test("no source casts a window's data payload instead of guarding it", () => {
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

  expect(offenders).toEqual([]);
});

test("the opener guards rather than casts, which is what removed the last exemption", () => {
  const opener = readFileSync(join(sourceRoot, "canvas/open-window.ts"), "utf8");

  expect(opener).toContain("showsContentItem");
  expect(opener.split("\n").some((line) => WINDOW_DATA_CAST.test(line))).toBe(false);
});

test("the check bites on the exact cast that was there", () => {
  expect(
    WINDOW_DATA_CAST.test("const data = window.data as Readonly<{ noteId?: string }> | undefined;"),
  ).toBe(true);
  expect(WINDOW_DATA_CAST.test("      const data = w.data as { itemId: string };")).toBe(true);
});

test("the check does not fire on the guarded read that replaced it", () => {
  expect(
    WINDOW_DATA_CAST.test(
      "const data = getInfiniteCanvasWindowData(window, ContentWindowData.allows);",
    ),
  ).toBe(false);
});

test("only the payload module reads a window's data directly", () => {
  const callers = sources.filter((path) => {
    const relative = path.slice(sourceRoot.length);

    return (
      relative !== "canvas/content-window-data.ts" &&
      /getInfiniteCanvasWindowData\s*\(/.test(readFileSync(path, "utf8"))
    );
  });

  expect(
    callers.map((path) => path.slice(sourceRoot.length)),
    "these read the payload themselves instead of asking `getContentWindowItemId`",
  ).toStrictEqual([]);
});

test("the payload module does read it, or the check above passes by covering nothing", () => {
  const owner = readFileSync(join(sourceRoot, "canvas/content-window-data.ts"), "utf8");

  expect(/getInfiniteCanvasWindowData\s*\(/.test(owner)).toBe(true);
});

test("the schema admits the current payload and refuses the one it replaced", () => {
  const withItem = { data: { itemId: "content_item:abc" } };
  const withNote = { data: { noteId: "note:abc" } };

  expect(getInfiniteCanvasWindowData(withItem, ContentWindowData.allows)?.itemId).toBe(
    "content_item:abc",
  );
  expect(getInfiniteCanvasWindowData(withNote, ContentWindowData.allows)).toBeNull();
  expect(getInfiniteCanvasWindowData({}, ContentWindowData.allows)).toBeNull();
});
