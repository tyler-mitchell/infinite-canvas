import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

import { expect, test } from "vite-plus/test";

/**
 * A derived view asks the same question the verb asks.
 *
 * `ROADMAP.md` records six instances of one omission — `window.reveal` panned to a rect nothing
 * renders, the offscreen ring aimed arrows at hidden windows, the minimap drew them and let them
 * set its scale, the dock offered to restore them, "Fit all visible" was enabled by them, and
 * `activeWindowId` kept naming one after it was filed away. It names the rule and explains it
 * well. Writing it down did not stop the seventh: `describeCanvas`, added to this app on
 * 2026-08-26, asked `mode` and reported windows behind a tab and windows on other desktops as
 * ordinary visible ones. The rule was in a file its author had read the same hour.
 *
 * So it is a test now. A rule that has failed seven times is not a rule anyone remembers; it is a
 * rule that needs an instrument.
 *
 * **What this catches and what it cannot.** `mode !== "minimized"` is the shape five of the six
 * had, and it is the shape a regex can see. The sixth was `activeWindowId` — not an enumeration
 * at all, and invisible to any sweep for a filter. `ROADMAP.md` already says why: a sweep finds
 * the shape you searched for. This closes the common door and is honest that the other one exists.
 */

const sourceRoot = fileURLToPath(new URL("..", import.meta.url));

const sources = readdirSync(sourceRoot, { recursive: true, withFileTypes: true })
  .filter(
    (entry) => entry.isFile() && /\.tsx?$/.test(entry.name) && !/\.test\.tsx?$/.test(entry.name),
  )
  .map((entry) => join(entry.parentPath, entry.name));

/** Deciding a window's visibility from `mode` alone — the shape the six shared. */
const MODE_FILTER = /\bmode\s*[!=]==\s*"minimized"/;

/**
 * Any of the framework's answers to "and which of them can actually be seen".
 *
 * A file that reaches one of these has asked the question, whatever it then does with it. The
 * check does not try to prove the answer is used correctly — it proves the question was asked,
 * which is the step all six skipped.
 */
const ASKS_VISIBILITY =
  /getInfiniteCanvasGroupProjection|hiddenWindowIds|isInfiniteCanvasWindowInActiveWorkspace|getInfiniteCanvasWorkspaceWindowIds|getSelectableWindowIds|getInfiniteCanvasWindowPresence/;

const isComment = (line: string) => /^\s*(?:\/\/|\/\*|\*)/.test(line);

/**
 * The one view whose subject is the windows that are *not* here.
 *
 * `desktop-switcher` lists what is filed elsewhere, so applying the membership filter would empty
 * the list it exists to draw — the question it asks is the inverse of the rule's, and it asks it
 * explicitly against `active.windowIds` on the same line. Being behind a tab does not bear on it
 * either: a tabbed window can be revealed on the desktop it lives on like any other.
 *
 * Named rather than pattern-matched, so a second exemption is a decision somebody writes down.
 */
const EXEMPT = new Set(["workspace/desktop-switcher.tsx"]);

test("no source decides what is visible from `mode` alone", () => {
  const offenders = sources.flatMap((path) => {
    const relative = path.slice(sourceRoot.length);
    const source = readFileSync(path, "utf8");

    if (EXEMPT.has(relative) || ASKS_VISIBILITY.test(source)) {
      return [];
    }

    return source
      .split("\n")
      .flatMap((line, index) =>
        MODE_FILTER.test(line) && !isComment(line)
          ? [`${relative}:${String(index + 1)}: ${line.trim()}`]
          : [],
      );
  });

  expect(offenders).toEqual([]);
});

test("the exemption names a file that exists and still holds the read it is exempt for", () => {
  // An exemption for a file that has moved is an exemption for nothing, and it fails open.
  for (const relative of EXEMPT) {
    expect(MODE_FILTER.test(readFileSync(join(sourceRoot, relative), "utf8"))).toBe(true);
  }
});

test("the check bites on the exact filter that was wrong seven times", () => {
  // The shape `describeCanvas` shipped with, and the shape the roadmap's sweep found five of.
  expect(MODE_FILTER.test('      window.mode === "minimized" ? null : window.mode,')).toBe(true);
  expect(MODE_FILTER.test('    .filter((window) => window.mode !== "minimized")')).toBe(true);
});

test("the check clears a file that consults the framework's answer", () => {
  // `connector-geometry.ts` filters on `mode` and also reads `hiddenWindowIds`; that is the
  // correct shape and must not be flagged, or the guard trains people to suppress it.
  const source = readFileSync(join(sourceRoot, "canvas/connector-geometry.ts"), "utf8");

  expect(MODE_FILTER.test(source)).toBe(true);
  expect(ASKS_VISIBILITY.test(source)).toBe(true);
});
