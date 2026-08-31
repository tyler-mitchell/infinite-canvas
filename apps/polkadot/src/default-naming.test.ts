import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

import { expect, test } from "vite-plus/test";

const sourceRoot = fileURLToPath(new URL(".", import.meta.url));

const sources = readdirSync(sourceRoot, { recursive: true, withFileTypes: true })
  .filter(
    (entry) => entry.isFile() && /\.tsx?$/.test(entry.name) && !/\.test\.tsx?$/.test(entry.name),
  )
  .map((entry) => join(entry.parentPath, entry.name));

const read = (path: string) => readFileSync(path, "utf8");

const relative = (path: string) => path.slice(sourceRoot.length);

const isComment = (line: string) => /^\s*(?:\/\/|\/\*|\*)/.test(line);

const withoutComments = (source: string) =>
  source
    .split("\n")
    .filter((line) => !isComment(line))
    .join("\n");

const CREATES_NAMED_RECORD =
  /\b(?:canvases\s*\.\s*(?:create|duplicate)|projects\s*\.\s*create)\s*\(/;

const NAMING_MODULES = new Set([
  "workspace/create-canvas.ts",
  "workspace/create-project.ts",
  "workspace/duplicate-canvas.ts",
  "workspace/fork-canvas.ts",
]);

const SYNCHRONOUS_NAMING = "workspace/create-desktop.ts";

test("only a naming module creates a record that carries a default title", () => {
  const creating = sources.filter((path) => CREATES_NAMED_RECORD.test(withoutComments(read(path))));

  expect(creating.length, "the pattern matched no creation at all").toBeGreaterThanOrEqual(4);

  expect(
    creating.map(relative).filter((path) => !NAMING_MODULES.has(path)),
    "these name a record themselves instead of asking a naming module",
  ).toStrictEqual([]);
});

test("every module that composes a default name claims it under the lock", () => {
  const naming = sources.filter(
    (path) => relative(path) !== "titles.ts" && /from "\.{1,2}\/?.*titles"/.test(read(path)),
  );

  expect(naming.length, "nothing imports the title rules").toBeGreaterThanOrEqual(6);

  expect(
    naming
      .map(relative)
      .filter((path) => path !== SYNCHRONOUS_NAMING)
      .filter((path) => !read(join(sourceRoot, path)).includes("withNamingLock")),
    "these decide a default name without holding the lock that makes it exclusive",
  ).toStrictEqual([]);
});

test("the one module exempt from the lock is still the synchronous one", () => {
  const source = read(join(sourceRoot, SYNCHRONOUS_NAMING));

  expect(source).not.toMatch(/\bawait\b/);
  expect(source).not.toMatch(/\basync\b/);
});

test("the check bites on both switchers exactly as they were written", () => {
  const projectSwitcher = [
    "              void database.projects",
    "                .create({ layout: initialLayout, title: `Project ${projects.length + 1}` })",
    "                .then((created) => {",
  ].join("\n");
  const canvasSwitcher = [
    "              void database.canvases",
    "                .duplicate({ canvasId, title: `${title} copy` })",
    "                .then((created) => {",
  ].join("\n");

  expect(CREATES_NAMED_RECORD.test(projectSwitcher)).toBe(true);
  expect(CREATES_NAMED_RECORD.test(canvasSwitcher)).toBe(true);
  expect(CREATES_NAMED_RECORD.test("    return database.canvases.create({ layout, title });")).toBe(
    true,
  );
});

test("the checks do not fire on the calls that replaced them", () => {
  expect(CREATES_NAMED_RECORD.test("void createProject().then((created) => {")).toBe(false);
  expect(
    CREATES_NAMED_RECORD.test("void duplicateCanvas({ canvasId, canvasTitle: title, projectId })"),
  ).toBe(false);
  expect(
    CREATES_NAMED_RECORD.test("void database.projects.listArchived().then((records) => {"),
  ).toBe(false);
  expect(CREATES_NAMED_RECORD.test("void database.canvases.archive(canvasId)")).toBe(false);
  expect(CREATES_NAMED_RECORD.test("await database.canvases.list(projectId)")).toBe(false);
});

test("a docstring quoting the mistake is not read as the mistake", () => {
  expect(isComment(" * `Project ${projectList.length + 1}` reads how many are listed rather")).toBe(
    true,
  );
  expect(isComment("      void database.projects.create({ layout: initialLayout })")).toBe(false);
});
