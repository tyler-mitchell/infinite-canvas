import { readdirSync, readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

import { expect, test } from "vite-plus/test";

// Scan source because browser-backed writes cannot run in this test.
const sourceDirectory = fileURLToPath(new URL("..", import.meta.url));

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

    // Match creation entry points, not functions that open existing items.
    return /async function openNew\w+\(/u.test(source) ? [[entry.name, source] as const] : [];
  });

const creationSources = readCreationSources(sourceDirectory);

test("the scan finds every creation path, so it cannot pass by finding none", () => {
  // Prevent a vacuous pass if the scan finds no creation paths.
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
  const openItem = readFileSync(`${sourceDirectory}/canvas/open-item.ts`, "utf8");

  expect(/async function openNew\w+\(/u.test(openItem)).toBe(false);
  expect(openItem).not.toContain("loadProjectContent(");
});
