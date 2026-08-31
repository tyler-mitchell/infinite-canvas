import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

import { expect, test } from "vite-plus/test";

import { getProjectEntryCanvas } from "./enter-project";

test("entering the project you are already in is not a move", async () => {
  await expect(
    getProjectEntryCanvas({ openProjectId: "project:a", projectId: "project:a" }),
  ).resolves.toBeNull();
});

test("both surfaces ask for the entry canvas rather than working it out again", () => {
  const callers = ["../hud/command-palette.tsx", "../workspace/project-switcher.tsx"];

  for (const caller of callers) {
    const source = readFileSync(fileURLToPath(new URL(caller, import.meta.url)), "utf8");

    expect(source, `${caller} no longer asks where a project opens`).toContain(
      "getProjectEntryCanvas",
    );
  }
});
