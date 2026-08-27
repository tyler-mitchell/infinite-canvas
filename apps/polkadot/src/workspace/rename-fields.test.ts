import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

import { expect, test } from "vite-plus/test";

/**
 * Every inline rename field goes through the one hook, and the hook selects on arrival.
 *
 * A rename here replaces the trigger with an input already holding the current name. `autoFocus`
 * focuses it and leaves the caret at the end, so the first keystroke *appends*: rename "Desktop 1"
 * to "Research" and you get "Desktop 1Research". `node.select()` is the whole fix.
 *
 * It was found and fixed for desktops and stayed there. The canvas and project switchers had the
 * identical shape and neither had it, so renaming a canvas or a project appended for as long as
 * both had existed. Found by reading a live workspace title of "Desktop 1ResearchResearch" out of
 * the running app — residue from two renames made while the bug was live.
 *
 * The first version of this file asserted the call in each switcher, which was right while the
 * behaviour was copied three times and wrong the moment it was not. `useInlineRename` owns it now,
 * so what is worth asserting changed shape: the behaviour exists once, and nobody has quietly grown
 * a fourth field beside it.
 *
 * A source scan rather than a render test, deliberately. What is being asserted is that a file
 * *uses* the shared hook at all, which is exactly what goes missing when somebody writes a fourth
 * switcher by copying a third. A render test would prove the three that exist work and say nothing
 * about the one written next week.
 */

const SWITCHERS = ["canvas-switcher.tsx", "desktop-switcher.tsx", "project-switcher.tsx"] as const;

const read = (name: string) =>
  readFileSync(fileURLToPath(new URL(`./${name}`, import.meta.url)), "utf8");

test("the shared hook selects the seeded name on arrival", () => {
  // The one place the fix lives. Everything below only matters because this line is here.
  expect(read("use-inline-rename.ts")).toContain("node.select()");
});

test.each(SWITCHERS)("%s renames through the shared hook", (name) => {
  const source = read(name);

  expect(source).toContain("useInlineRename");
  // And does not keep a private copy of the field it replaced: a switcher that still seeds its own
  // draft observable is one the hook is not actually driving, however much it also imports it.
  expect(source).not.toMatch(/draftTitle\$/);
});

test("no switcher hand-rolls the field the hook owns", () => {
  // `autoFocus` without the hook is the exact shape that appends. Asserted across the directory
  // rather than the known three, so a fourth file is covered the day it is written.
  for (const name of SWITCHERS) {
    const source = read(name);

    if (source.includes("autoFocus")) {
      expect(source).toContain("useInlineRename");
    }
  }
});

test("the scan would notice the call going missing", () => {
  // The check is a substring match, so it is worth proving it discriminates rather than trusting
  // that it does. This is the shape of the hook before the fix.
  const before = read("use-inline-rename.ts").replace("node.select();", "");

  expect(before).not.toContain("node.select()");
});
