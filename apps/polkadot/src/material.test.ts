import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

import { expect, test } from "vite-plus/test";

import { FLOATING_SURFACE } from "./material";

/**
 * The floating-surface recipe is written once.
 *
 * It was written five times, and the cost was paid rather than predicted: removing one dead
 * property from that material meant editing five files, and all five were only found because a
 * measurement had already named them. A recipe nobody can enumerate is one the next change applies
 * to four surfaces out of five, and the fifth is a panel that quietly stops matching the others.
 *
 * The scan is deliberately narrow — the *pair* of a surface fill and the specular ring, which is
 * what makes something this material rather than merely a box with a background.
 */

const sourceRoot = fileURLToPath(new URL(".", import.meta.url));

const sources = readdirSync(sourceRoot, { recursive: true, withFileTypes: true })
  .filter(
    (entry) => entry.isFile() && /\.tsx?$/.test(entry.name) && !/\.test\.tsx?$/.test(entry.name),
  )
  .map((entry) => join(entry.parentPath, entry.name));

/** The file that owns the recipe is allowed to spell it out. Nothing else is. */
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
        line.includes("bg-[var(--surface)]") && line.includes("var(--edge-light)")
          ? [`${relative}:${String(index + 1)}`]
          : [],
      );
  });

  expect(offenders).toStrictEqual([]);
});

test("the recipe is both halves, or the scan above is looking for the wrong thing", () => {
  // If the material ever stops being "surface fill plus specular hairline", this fails and the
  // check gets rewritten deliberately rather than silently matching nothing.
  expect(FLOATING_SURFACE).toContain("bg-[var(--surface)]");
  expect(FLOATING_SURFACE).toContain("var(--edge-light)");
});

/**
 * A hairline on the top edge, not an outline on four.
 *
 * `inset-ring-1` measured as `oklch(1 0 0 / 0.07) 0 0 0 1px inset` — the `border: 1px solid
 * white/8%` the bar names and forbids — while window frames drew `0 1px 0 0 inset` all along.
 * Pinning the offsets is what keeps the two families drawn by one rule.
 */
test("the light falls on the top edge only", () => {
  expect(FLOATING_SURFACE).toContain("inset-shadow-[0_1px_0_0_");
  expect(FLOATING_SURFACE).not.toContain("inset-ring");
});

test("elevation stays out of the recipe, because it is the part that differs", () => {
  // The notice lifts higher than a rail because it interrupts. Folding lift in would mean a variant
  // per combination — a worse duplication wearing a tidier shape.
  expect(FLOATING_SURFACE).not.toContain("--lift-");
  expect(FLOATING_SURFACE).not.toContain("rounded-");
});
