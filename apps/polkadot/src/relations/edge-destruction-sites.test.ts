import { readdirSync, readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

import { expect, test } from "vite-plus/test";

const SRC = fileURLToPath(new URL("..", import.meta.url));

// These sites cut only the connector that the user selected.
const VISIBLE_SELECTION_SITES = new Set(["canvas-hud.tsx", "connector-hotkeys.ts"]);

const sourceFiles = (directory: string): readonly string[] =>
  readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const path = `${directory}/${entry.name}`;

    if (entry.isDirectory()) {
      return sourceFiles(path);
    }

    return /\.tsx?$/.test(entry.name) && !entry.name.includes(".test.") ? [path] : [];
  });

test("every surface that cuts an edge has reasoned about what the cut destroys", () => {
  const cutting = sourceFiles(SRC).filter((path) => {
    const source = readFileSync(path, "utf8");

    // Match calls, not imports.
    return /\bdisconnect(?:Items|Relations)\s*\(/.test(source);
  });

  // This assertion fails if the scan finds too few cut sites.
  expect(cutting.length).toBeGreaterThanOrEqual(5);

  const unreasoned = cutting.filter((path) => {
    const name = path.split("/").pop() ?? "";

    if (VISIBLE_SELECTION_SITES.has(name)) {
      return false;
    }

    // Other cut sites must inspect the relation claim.
    return !readFileSync(path, "utf8").includes("getRelationLabel");
  });

  expect(
    unreasoned.map((path) => path.slice(SRC.length)),
    "these cut an edge without asking what it claimed",
  ).toStrictEqual([]);
});
