import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

import { getInfiniteCanvasWindowData } from "@hyphened/infinite-canvas";
import { expect, test } from "vite-plus/test";

import { ContentWindowData } from "./window-registry";

/**
 * A window's `data` is read through the schema, never through a cast.
 *
 * `data` is `unknown` at the framework boundary, which is correct — the payload is this app's, and
 * the framework cannot know its shape. A `as Readonly<{ noteId?: string }>` closes that boundary by
 * assertion instead of by proof, and an assertion cannot be wrong at runtime: it silently produces
 * `undefined` for a field nothing writes, so every read is a miss and every guarded branch takes
 * the other path.
 *
 * That is not hypothetical. Window data was `{ noteId }` per kind and became `{ itemId }` for every
 * kind when content items went kind-generic. Nothing failed. The casts kept compiling, kept
 * returning `undefined`, and four features quietly stopped working — three in the command palette,
 * and in the library rail the presence dot, the window-closes-on-archive rule, and the retitle that
 * follows a rename. Two of those had docstrings promising the behaviour they had stopped doing.
 *
 * `getInfiniteCanvasWindowData(window, ContentWindowData.allows)` cannot fail that way: it returns
 * `null` when the payload does not match, so a rekey turns "the dot is missing" into a branch that
 * is visibly never taken, and the ArkType schema is the single place the field name lives.
 */

const sourceRoot = fileURLToPath(new URL("..", import.meta.url));

const sources = readdirSync(sourceRoot, { recursive: true, withFileTypes: true })
  .filter(
    (entry) => entry.isFile() && /\.tsx?$/.test(entry.name) && !/\.test\.tsx?$/.test(entry.name),
  )
  .map((entry) => join(entry.parentPath, entry.name));

/**
 * A cast of a window's payload, in any of the spellings this repo has actually written.
 *
 * Deliberately narrow: it matches `window.data as …` and `.data as Readonly<{…}>`, not every cast
 * in the app. A regex over source is a weak instrument and a broad one would fail on unrelated
 * code, so this is scoped to the exact expression whose failure mode is invisible.
 */
const WINDOW_DATA_CAST = /\bdata\s+as\s+(?:Readonly\s*<|\{|[A-Z])/;

/** A comment quoting the old cast is not the old cast. This file and the fix both do that. */
const isComment = (line: string) => /^\s*(?:\/\/|\/\*|\*)/.test(line);

/**
 * There are no exemptions, and there was one.
 *
 * `showsItem` in `open-window.ts` held the app's last structural cast because it could not import
 * the registry's schema: the registry reaches every kind's body and those bodies reach back for the
 * opener, so a value import would have closed a cycle. That was a true constraint about where the
 * schema *lived*, not about the opener — moving `ContentWindowData` into a module that imports
 * nothing let the opener guard like everything else, and this test is what noticed, since an
 * exemption whose file no longer holds the read fails rather than passing quietly.
 *
 * If a second one is ever needed, it goes back as a named set with the same failing check beside
 * it, so an exemption for a read that has since been fixed cannot outlive it.
 */
test("no source casts a window's data payload instead of guarding it", () => {
  const offenders = sources.flatMap((path) => {
    const relative = path.slice(sourceRoot.length);

    return readFileSync(path, "utf8")
      .split("\n")
      .flatMap((line, index) =>
        WINDOW_DATA_CAST.test(line) && !isComment(line)
          ? [`${relative}:${String(index + 1)}: ${line.trim()}`]
          : [],
      );
  });

  expect(offenders).toEqual([]);
});

test("the opener guards rather than casts, which is what removed the last exemption", () => {
  /*
   * Named rather than left to the scan above, because the scan passing is also what a deleted file
   * looks like. The opener is the one place a cast survived on a structural argument, so it is worth
   * asserting it still reads the payload and reads it through the schema.
   */
  const opener = readFileSync(join(sourceRoot, "canvas/open-window.ts"), "utf8");

  expect(opener).toContain("showsContentItem");
  expect(opener.split("\n").some((line) => WINDOW_DATA_CAST.test(line))).toBe(false);
});

test("the check bites on the exact cast that was there", () => {
  // The line deleted from `library-rail.tsx`, verbatim. A guard nobody has watched fail is a guard
  // that might match nothing at all — this is the string it exists to catch.
  expect(
    WINDOW_DATA_CAST.test("const data = window.data as Readonly<{ noteId?: string }> | undefined;"),
  ).toBe(true);
  expect(WINDOW_DATA_CAST.test("      const data = w.data as { itemId: string };")).toBe(true);
});

test("the check does not fire on the guarded read that replaced it", () => {
  expect(
    WINDOW_DATA_CAST.test(
      "const data = getInfiniteCanvasWindowData(window, ContentWindowData.allows);",
    ),
  ).toBe(false);
});

/**
 * The other half: the schema itself must reject the shape the casts were asserting.
 *
 * If `ContentWindowData` ever grew `noteId` back as optional, every guarded read above would start
 * passing on a stale payload and the source check would still be green.
 */
/**
 * One module reads the payload, and everything else asks it.
 *
 * Forbidding casts was the first half and it is not enough: a *correct* guarded read, open-coded,
 * still spells the field name out. Nine of them were, and they had already diverged — the helper
 * answers `null`, the hand-written ones answered `undefined`, and one reader guarding `!== undefined`
 * would have handed `null` to `rememberNote`.
 *
 * Worth saying how the last three were found, because it says what this test is for. A structural
 * search for `getInfiniteCanvasWindowData(window, …)` missed them: they were written against
 * `activeStateWindow` and `selected`, so the query matched on a *parameter name* and reported six
 * sites when there were nine. A count that depends on what everyone happened to call their variable
 * is not a count. This asks the only question that does not: who imports the reader.
 */
test("only the payload module reads a window's data directly", () => {
  const callers = sources.filter((path) => {
    const relative = path.slice(sourceRoot.length);

    return (
      relative !== "canvas/content-window-data.ts" &&
      /getInfiniteCanvasWindowData\s*\(/.test(readFileSync(path, "utf8"))
    );
  });

  expect(
    callers.map((path) => path.slice(sourceRoot.length)),
    "these read the payload themselves instead of asking `getContentWindowItemId`",
  ).toStrictEqual([]);
});

test("the payload module does read it, or the check above passes by covering nothing", () => {
  const owner = readFileSync(join(sourceRoot, "canvas/content-window-data.ts"), "utf8");

  expect(/getInfiniteCanvasWindowData\s*\(/.test(owner)).toBe(true);
});

test("the schema admits the current payload and refuses the one it replaced", () => {
  const withItem = { data: { itemId: "content_item:abc" } };
  const withNote = { data: { noteId: "note:abc" } };

  expect(getInfiniteCanvasWindowData(withItem, ContentWindowData.allows)?.itemId).toBe(
    "content_item:abc",
  );
  expect(getInfiniteCanvasWindowData(withNote, ContentWindowData.allows)).toBeNull();
  expect(getInfiniteCanvasWindowData({}, ContentWindowData.allows)).toBeNull();
});
