import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

import { expect, test } from "vite-plus/test";

/**
 * A default name is decided in one place, and claimed under the lock.
 *
 * This rule has been broken five times, and each time it was written by someone who could see one of
 * the earlier fixes. `create-canvas.ts` is the first, and exists because two surfaces both wrote
 * `Canvas ${canvases.length + 1}` inline; its docstring closes "the lesson stayed with notes".
 * `create-desktop.ts` is the second, the same fix for desktops. `fork-canvas.ts` is the third and
 * says so by name. Then the canvas switcher's Duplicate and the project switcher's New project
 * turned out to be the fourth and fifth, both still live weeks later.
 *
 * Nothing caught any of them. Every copy typechecks, every copy looks reasonable at the call site,
 * and the failure only shows up after something is removed or repeated — which is exactly when a
 * switcher full of duplicate names is least welcome. Five hand-written prose warnings across five
 * docstrings did not stop the sixth from being written, so this is the check those docstrings
 * should have been.
 *
 * Two halves, because either alone has a hole the other covers:
 *
 * - A file may not create a named record directly. That is the half that catches the switchers,
 *   which never imported `titles.ts` at all and so were invisible to any rule about how names are
 *   composed.
 * - A file that composes a default name holds the naming lock. That is the half that catches a new
 *   naming module written without one, where the read and the claim are two awaits and two
 *   creations started together both take the same name.
 */

const sourceRoot = fileURLToPath(new URL(".", import.meta.url));

const sources = readdirSync(sourceRoot, { recursive: true, withFileTypes: true })
  .filter(
    (entry) => entry.isFile() && /\.tsx?$/.test(entry.name) && !/\.test\.tsx?$/.test(entry.name),
  )
  .map((entry) => join(entry.parentPath, entry.name));

const read = (path: string) => readFileSync(path, "utf8");

const relative = (path: string) => path.slice(sourceRoot.length);

/** A docstring quoting the mistake is not the mistake. Four of these files quote it deliberately. */
const isComment = (line: string) => /^\s*(?:\/\/|\/\*|\*)/.test(line);

const withoutComments = (source: string) =>
  source
    .split("\n")
    .filter((line) => !isComment(line))
    .join("\n");

/**
 * Making a record that carries a title somebody did not type.
 *
 * Matched as the call rather than by importing `operations`, because every switcher imports that
 * module legitimately — they list, archive and restore through it. It is the creating that is
 * reserved.
 *
 * **Whitespace between the receiver and the method is the whole reason this is not line-based.**
 * The first version of this scan tested one line at a time and passed on its first run, which was
 * the scan being wrong rather than the app being clean: both switchers wrote the call as
 * `database.projects` then `.create(...)` on the next line, so the contiguous spelling never
 * appeared and the check would have missed the exact defect it was written for. `AGENTS.md` names
 * this shape — a fixed window instead of a real boundary — from a scan that read 120 characters
 * after a tag and cut off the prop it was looking for.
 */
const CREATES_NAMED_RECORD =
  /\b(?:canvases\s*\.\s*(?:create|duplicate)|projects\s*\.\s*create)\s*\(/;

/**
 * The modules allowed to name something, each holding the lock and asking `titles.ts` for the name.
 *
 * A list rather than a rule, because "this module owns a naming policy" is a decision, not a
 * property of the source. Adding to it should cost a sentence explaining what new kind of thing is
 * being named and why the existing four do not cover it.
 */
const NAMING_MODULES = new Set([
  "workspace/create-canvas.ts",
  "workspace/create-project.ts",
  "workspace/duplicate-canvas.ts",
  "workspace/fork-canvas.ts",
]);

/**
 * Names without the lock, and the reason is real rather than an oversight.
 *
 * `createDesktop` reads the taken titles from an array its caller already holds and claims one with
 * a synchronous `executeCommand`. The lock exists to close the gap between reading which names are
 * taken and claiming one, and where that is not two awaits there is no gap to close. The test below
 * asserts the file is still synchronous, so this exemption stops applying the moment its reason does.
 */
const SYNCHRONOUS_NAMING = "workspace/create-desktop.ts";

test("only a naming module creates a record that carries a default title", () => {
  const creating = sources.filter((path) => CREATES_NAMED_RECORD.test(withoutComments(read(path))));

  // Guards the guard: a rename in `operations.ts` would make the pattern match nothing, and a scan
  // that matches nothing passes exactly like a scan that found nothing wrong.
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

  // Seven today: four canvas/project modules, notes, collections, and the synchronous desktop one.
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
  /*
   * The exemption's reason, asserted rather than trusted. Making `createDesktop` await anything puts
   * a gap between reading the taken names and claiming one, which is the whole thing the lock is
   * for — so this fails and sends the next person to the exemption rather than leaving it standing
   * over a file it no longer describes.
   */
  const source = read(join(sourceRoot, SYNCHRONOUS_NAMING));

  expect(source).not.toMatch(/\bawait\b/);
  expect(source).not.toMatch(/\basync\b/);
});

test("the check bites on both switchers exactly as they were written", () => {
  /*
   * Verbatim, including the line breaks. This is the case the first version of this scan missed:
   * the receiver and the method are on different lines in both switchers, which is how the defect
   * was written and therefore the only spelling that proves the check works.
   */
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
  // And the contiguous spelling, which is what a naming module writes.
  expect(CREATES_NAMED_RECORD.test("    return database.canvases.create({ layout, title });")).toBe(
    true,
  );
});

test("the checks do not fire on the calls that replaced them", () => {
  expect(CREATES_NAMED_RECORD.test("void createProject().then((created) => {")).toBe(false);
  expect(
    CREATES_NAMED_RECORD.test("void duplicateCanvas({ canvasId, canvasTitle: title, projectId })"),
  ).toBe(false);
  // Listing, archiving and restoring stay open to every surface. Only creating is reserved.
  expect(
    CREATES_NAMED_RECORD.test("void database.projects.listArchived().then((records) => {"),
  ).toBe(false);
  expect(CREATES_NAMED_RECORD.test("void database.canvases.archive(canvasId)")).toBe(false);
  expect(CREATES_NAMED_RECORD.test("await database.canvases.list(projectId)")).toBe(false);
});

test("a docstring quoting the mistake is not read as the mistake", () => {
  // Four of these files quote the old expression on purpose. A guard that reported its own
  // explanation as the defect would be worse than no guard.
  expect(isComment(" * `Project ${projectList.length + 1}` reads how many are listed rather")).toBe(
    true,
  );
  expect(isComment("      void database.projects.create({ layout: initialLayout })")).toBe(false);
});
