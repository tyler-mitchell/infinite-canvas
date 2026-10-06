import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

import { expect, test } from "vite-plus/test";

import { FLOATING_SURFACE } from "./material";

const sourceRoot = fileURLToPath(new URL(".", import.meta.url));

const sources = readdirSync(sourceRoot, { recursive: true, withFileTypes: true })
  .filter(
    (entry) => entry.isFile() && /\.tsx?$/.test(entry.name) && !/\.test\.tsx?$/.test(entry.name),
  )
  .map((entry) => join(entry.parentPath, entry.name));

const OWNER = "material.ts";

test("no surface re-inlines the material instead of composing it", () => {
  const offenders = sources.flatMap((path) => {
    const relative = path.slice(sourceRoot.length);

    if (relative === OWNER) {
      return [];
    }

    return readFileSync(path, "utf8")
      .split("\n")
      .flatMap((line, index) =>
        line.includes("bg-[var(--surface)]") && line.includes("border-[var(--line)]")
          ? [`${relative}:${String(index + 1)}`]
          : [],
      );
  });

  expect(offenders).toStrictEqual([]);
});

test("the recipe is both halves, or the scan above is looking for the wrong thing", () => {
  expect(FLOATING_SURFACE).toContain("bg-[var(--surface)]");
  expect(FLOATING_SURFACE).toContain("border-[var(--line)]");
});

test("the hairline is the edge, and it is the only one", () => {
  /*
   * A bevel and a hairline are two edges doing one job. The surface scale spans L 0 to L 0.19, so
   * a panel cannot be told from the canvas by lightness; the hairline is what holds over any
   * ground, and a top-lit inset only worked while the ground was lighter than black.
   */
  expect(FLOATING_SURFACE).not.toContain("inset-shadow");
  expect(FLOATING_SURFACE).not.toContain("inset-ring");
});

test("elevation stays out of the recipe, because it is the part that differs", () => {
  expect(FLOATING_SURFACE).not.toContain("--lift-");
  expect(FLOATING_SURFACE).not.toContain("rounded-");
});
