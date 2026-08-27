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
 * The one structural read that stays.
 *
 * `showsItem` in `open-window.ts` cannot import the registry's schema — the registry reaches every
 * kind's body and those bodies reach back for the opener, so the import would close a cycle. Its
 * own docstring says so, and it reads the current field. Named here rather than pattern-matched,
 * so adding a second exemption is a decision somebody writes down.
 */
const EXEMPT = new Set(["canvas/open-window.ts"]);

test("no source casts a window's data payload instead of guarding it", () => {
  const offenders = sources.flatMap((path) => {
    const relative = path.slice(sourceRoot.length);

    if (EXEMPT.has(relative)) {
      return [];
    }

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

test("the exemption names a file that exists and still holds the read it is exempt for", () => {
  // An exemption for a file that has moved is an exemption for nothing, and it fails open.
  for (const relative of EXEMPT) {
    const source = readFileSync(join(sourceRoot, relative), "utf8");

    expect(source.split("\n").some((line) => WINDOW_DATA_CAST.test(line))).toBe(true);
  }
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
test("the schema admits the current payload and refuses the one it replaced", () => {
  const withItem = { data: { itemId: "content_item:abc" } };
  const withNote = { data: { noteId: "note:abc" } };

  expect(getInfiniteCanvasWindowData(withItem, ContentWindowData.allows)?.itemId).toBe(
    "content_item:abc",
  );
  expect(getInfiniteCanvasWindowData(withNote, ContentWindowData.allows)).toBeNull();
  expect(getInfiniteCanvasWindowData({}, ContentWindowData.allows)).toBeNull();
});
