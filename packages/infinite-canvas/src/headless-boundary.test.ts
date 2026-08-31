import { readdirSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { expect, test } from "vite-plus/test";

const srcDirectory = dirname(fileURLToPath(import.meta.url));

const sourceFiles = readdirSync(srcDirectory)
  .filter(
    (name) =>
      (name.endsWith(".ts") || name.endsWith(".tsx")) &&
      !name.includes(".test.") &&
      name !== "theme.css",
  )
  .map((name) => ({ name, text: readFileSync(join(srcDirectory, name), "utf8") }));

test("framework source imports no icon library", () => {
  const offenders = sourceFiles.filter(({ text }) => text.includes("lucide-react"));
  expect(offenders.map(({ name }) => name)).toEqual([]);
});

test("framework source emits no literal className strings", () => {
  const offenders = sourceFiles.flatMap(({ name, text }) =>
    text
      .split("\n")
      .map((line, index) => ({ line, lineNumber: index + 1 }))
      .filter(({ line }) => line.includes('className="'))
      .map(({ lineNumber }) => `${name}:${lineNumber}`),
  );
  expect(offenders).toEqual([]);
});
