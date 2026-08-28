import { readdirSync, readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

import { expect, test } from "vite-plus/test";

/**
 * Making something puts it in the library, whatever kind it is.
 *
 * `open-note.ts` states the rule — "refreshing the listing here is what makes creation whole" — and
 * it was the only one of four creation paths that kept it. A collection, an image and a dropped
 * link each existed, opened a window on the canvas, and were absent from the library rail and from
 * `content.list` until a reload.
 *
 * **The cost is larger than a stale rail.** Every id-taking verb resolves against that listing, so
 * an item missing from it cannot be renamed, archived, connected or opened by id — nothing can be
 * handed a handle nothing reports. Driven: a collection window open on the canvas beside a rail
 * reading "Nothing here yet.", and `content.list` answering "This project holds nothing yet."
 *
 * A source scan rather than a behavioural test because the write goes through a kind's gateway to
 * SurrealDB WASM, and this app has no database tests. What is checkable without one is that every
 * creation path still calls the refresh — which is exactly the thing three of them forgot.
 */

const sourceDirectory = fileURLToPath(new URL("..", import.meta.url));

/**
 * Every file under `src` that declares a creation entry point.
 *
 * Found by scanning rather than listed, so a fifth kind is caught by existing. A hand-written list
 * would need updating by the same person who forgot the refresh.
 */
const readCreationSources = (directory: string): readonly (readonly [string, string])[] =>
  readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const path = `${directory}/${entry.name}`;

    if (entry.isDirectory()) {
      return readCreationSources(path);
    }

    if (!entry.name.endsWith(".ts") || entry.name.endsWith(".test.ts")) {
      return [];
    }

    const source = readFileSync(path, "utf8");

    // `async function openNewX(` — the shape all four share. Matched on the declaration rather than
    // on the filename, since `open-item.ts` opens existing records and must not be caught.
    return /async function openNew\w+\(/u.test(source) ? [[entry.name, source] as const] : [];
  });

const creationSources = readCreationSources(sourceDirectory);

test("the scan finds every creation path, so it cannot pass by finding none", () => {
  /*
   * The discrimination test AGENTS.md asks for. Asserting "each found file refreshes" is vacuously
   * true of an empty set, and a regex that stops matching is exactly how that happens quietly.
   */
  expect(creationSources.map(([name]) => name).sort()).toStrictEqual([
    "open-collection.ts",
    "open-image.ts",
    "open-link.ts",
    "open-note.ts",
  ]);
});

test("every creation path refreshes the listing the library and content.list read", () => {
  for (const [name, source] of creationSources) {
    expect(`${name}: ${String(source.includes("loadProjectContent("))}`).toBe(`${name}: true`);
  }
});

test("opening something that already exists is not a creation path", () => {
  // Guards the regex against widening into `openItemWindow`, `openNoteWindow` and the rest, which
  // place a window for a record that is already listed and must not re-read anything.
  const openItem = readFileSync(`${sourceDirectory}/canvas/open-item.ts`, "utf8");

  expect(/async function openNew\w+\(/u.test(openItem)).toBe(false);
  expect(openItem).not.toContain("loadProjectContent(");
});
