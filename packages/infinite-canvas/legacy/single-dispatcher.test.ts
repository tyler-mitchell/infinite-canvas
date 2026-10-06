import { readdirSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

import { expect, test } from "vite-plus/test";

const sourceDirectory = dirname(fileURLToPath(import.meta.url));

const SINGLE_DISPATCHER = "infinite-canvas.tsx";

const DECLARATION_SITES = new Set(["store.tsx", "types.ts"]);

test("only the mount-scoped listener dispatches interaction steps", () => {
  const offenders = readdirSync(sourceDirectory)
    .filter(
      (file) =>
        (file.endsWith(".ts") || file.endsWith(".tsx")) &&
        !file.includes(".test.") &&
        file !== SINGLE_DISPATCHER &&
        !DECLARATION_SITES.has(file),
    )
    .filter((file) =>
      readFileSync(join(sourceDirectory, file), "utf8").includes("stepInteraction"),
    );

  expect(
    offenders,
    "A second dispatcher for interaction.step reintroduces the modifier race the friction " +
      "backlog already recorded: whichever handler runs last wins, and a handler that does " +
      "not read event.altKey wipes the dock preview the one that does just resolved. Route " +
      "the step through the mount-scoped window listener in infinite-canvas.tsx instead.",
  ).toEqual([]);
});

test("the one dispatcher carries the modifier", () => {
  const source = readFileSync(join(sourceDirectory, SINGLE_DISPATCHER), "utf8");

  expect(source).toContain("dockIntent: event.altKey");
});
