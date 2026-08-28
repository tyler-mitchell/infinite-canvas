import { readdirSync, readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

import { expect, test } from "vite-plus/test";

/**
 * A window that reads from the content cache must not take a name from it.
 *
 * `createContentCache` is read-once, which is right for the thing it exists for — an image's bytes,
 * a link's address — and wrong for a title, because a rename changes one. A rename writes storage,
 * folds `projectContent$` and sets the window chrome, and nothing tells this cache.
 *
 * Driven 2026-08-28: renaming a link left storage and the window chrome saying "Third Name" while
 * the link's own bar, one line below the chrome, still said "New Link Name". Two names for one thing
 * on screen at once, which is exactly the failure `renameProjectItem` describes and counts three
 * holders for. The cache was a fourth.
 *
 * A scan rather than a behaviour test because the failure is a *source* choice — which of two
 * available titles a component reads — and it is invisible until something is renamed while its
 * window is open. Nothing else here checks that.
 */

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

    // The consumers are the files that read entries out of a cache, not the one that makes them.
    return source.includes("entries$[") && !path.endsWith("content-cache.ts");
  });

  // Guards the guard: a rename of `entries$` would leave this passing over nothing.
  expect(consumers.length).toBeGreaterThanOrEqual(2);

  const readingTitle = consumers
    .filter((path) => /\brecord\.title\b/.test(readFileSync(path, "utf8")))
    .map((path) => path.slice(SRC.length));

  expect(
    readingTitle,
    "a rename does not reach the content cache, so this window will show the old name beside the new one",
  ).toStrictEqual([]);
});
