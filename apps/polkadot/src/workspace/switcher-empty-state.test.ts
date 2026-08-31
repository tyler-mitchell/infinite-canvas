import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

import { expect, test } from "vite-plus/test";

const SWITCHERS = ["canvas-switcher.tsx", "project-switcher.tsx"] as const;

const read = (name: string) =>
  readFileSync(fileURLToPath(new URL(`./${name}`, import.meta.url)), "utf8");

// styles.empty appears only in the rendered loading branch.
const EMPTY_BRANCH = "styles.empty()";

test.each(SWITCHERS)("%s says it is loading rather than showing an empty list", (name) => {
  const source = read(name);

  expect(source).toContain("onOpenChange");
  expect(source).toContain("length === 0");
  expect(source).toContain(EMPTY_BRANCH);
});

test("the scan would notice the branch going missing", () => {
  const before = read("project-switcher.tsx").replaceAll(EMPTY_BRANCH, "");

  expect(before).not.toContain(EMPTY_BRANCH);
});
