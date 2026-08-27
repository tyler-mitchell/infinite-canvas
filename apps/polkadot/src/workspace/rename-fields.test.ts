import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

import { expect, test } from "vite-plus/test";

/**
 * Every inline rename field selects its seeded text on arrival.
 *
 * A rename here replaces the trigger with an input already holding the current name. `autoFocus`
 * focuses it and leaves the caret at the end, so the first keystroke *appends*: rename "Desktop 1"
 * to "Research" and you get "Desktop 1Research". `node.select()` is the whole fix.
 *
 * It was found and fixed for desktops, and stayed there. The canvas and project switchers have the
 * identical shape — seed the draft, render an `autoFocus` input, register Enter and Escape — and
 * neither had it, so renaming a canvas or a project appended for as long as both have existed.
 *
 * Found by reading a live workspace title of "Desktop 1ResearchResearch" out of the running app:
 * residue from two renames made while the bug was live, still sitting in the database. The data is
 * left alone — a corrupted name is the owner's to fix — but it is what pointed at the siblings.
 *
 * A source scan rather than a render test, deliberately. What is being asserted is that a file
 * *has* the call at all, which is exactly the thing that goes missing when somebody writes a fourth
 * switcher by copying a third. A render test would prove the two that exist work and say nothing
 * about the one written next week.
 */

const FIELDS = ["canvas-switcher.tsx", "desktop-switcher.tsx", "project-switcher.tsx"] as const;

const read = (name: string) =>
  readFileSync(fileURLToPath(new URL(`./${name}`, import.meta.url)), "utf8");

test.each(FIELDS)("%s selects its seeded name on arrival", (name) => {
  const source = read(name);

  // Guard the premise: if a file stops being an inline rename field this assertion is meaningless,
  // and should fail loudly rather than pass by vacuously not matching.
  expect(source).toContain("autoFocus");
  expect(source).toContain("node.select()");
});

test("the scan would notice the call going missing", () => {
  // The check is a substring match, so it is worth proving it discriminates rather than trusting
  // that it does. This is the shape of the file before the fix.
  const before = read("desktop-switcher.tsx").replace("node.select();", "");

  expect(before).not.toContain("node.select()");
});

test("every switcher seeds the draft with the existing name, which is why selecting matters", () => {
  // The two halves are one decision. Seeding an empty field would need no selection; seeding the
  // current name and *not* selecting is the combination that appends.
  for (const name of FIELDS) {
    expect(read(name)).toMatch(/draftTitle\$\.set\((?!null)/);
  }
});
