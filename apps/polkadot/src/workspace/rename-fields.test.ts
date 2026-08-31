import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

import { expect, test } from "vite-plus/test";

const SWITCHERS = ["canvas-switcher.tsx", "desktop-switcher.tsx", "project-switcher.tsx"] as const;

const read = (name: string) =>
  readFileSync(fileURLToPath(new URL(`./${name}`, import.meta.url)), "utf8");

test("the shared hook selects the seeded name on arrival", () => {
  expect(read("use-inline-rename.ts")).toContain("node.select()");
});

test.each(SWITCHERS)("%s renames through the shared hook", (name) => {
  const source = read(name);

  expect(source).toContain("useInlineRename");
  expect(source).not.toMatch(/draftTitle\$/);
});

test("no switcher hand-rolls the field the hook owns", () => {
  for (const name of SWITCHERS) {
    const source = read(name);

    if (source.includes("autoFocus")) {
      expect(source).toContain("useInlineRename");
    }
  }
});

test("the scan would notice the call going missing", () => {
  const before = read("use-inline-rename.ts").replace("node.select();", "");

  expect(before).not.toContain("node.select()");
});
