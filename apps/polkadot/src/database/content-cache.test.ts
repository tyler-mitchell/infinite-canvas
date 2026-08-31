import { readdirSync, readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

import { expect, test } from "vite-plus/test";

const SRC = fileURLToPath(new URL("..", import.meta.url));

const sourceFiles = (directory: string): readonly string[] =>
  readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const path = `${directory}/${entry.name}`;

    if (entry.isDirectory()) {
      return sourceFiles(path);
    }

    return /\.tsx?$/.test(entry.name) && !entry.name.includes(".test.") ? [path] : [];
  });

test("no cache consumer renders a title out of the cached record", () => {
  const consumers = sourceFiles(SRC).filter((path) => {
    const source = readFileSync(path, "utf8");

    return source.includes("entries$[") && !path.endsWith("content-cache.ts");
  });

  // This assertion fails if the scan finds no cache consumers.
  expect(consumers.length).toBeGreaterThanOrEqual(2);

  const readingTitle = consumers
    .filter((path) => /\brecord\.title\b/.test(readFileSync(path, "utf8")))
    .map((path) => path.slice(SRC.length));

  expect(
    readingTitle,
    "a rename does not reach the content cache, so this window will show the old name beside the new one",
  ).toStrictEqual([]);
});
