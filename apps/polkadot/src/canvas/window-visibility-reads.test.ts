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
 * There are **two** questions, not one, and this check used to accept either.
 *
 * A window can be on the canvas without being on screen in two independent ways: a group is not
 * drawing it, or it belongs to a desktop you are not looking at. One check answers neither of the
 * other's cases, so a file that asks about tabs is not thereby excused from asking about desktops.
 *
 * That mattered: `field.tsx` filtered on `mode` and `hiddenWindowIds` and never asked membership,
 * so the dot field was displaced by windows on other desktops. It passed this guard for months
 * because one match cleared the file. Splitting the two is what found it.
 *
 * `getInfiniteCanvasWindowPresence` answers both at once, which is why it appears in each list.
 */
const ASKS_HIDDEN =
  /getInfiniteCanvasGroupProjection|hiddenWindowIds|getSelectableWindowIds|getInfiniteCanvasWindowPresence/;
const ASKS_MEMBERSHIP =
  /isInfiniteCanvasWindowInActiveWorkspace|getInfiniteCanvasWorkspaceWindowIds|getInfiniteCanvasWindowPresence/;

const isComment = (line: string) => /^\s*(?:\/\/|\/\*|\*)/.test(line);

/**
 * The file with its imports and comments removed, which is where "did it ask" is decided.
 *
 * Importing a helper is not asking it anything, and this guard accepted it: deleting the only *call*
 * to `isInfiniteCanvasWindowInActiveWorkspace` from `field.tsx` left the import behind and the check
 * stayed green. Found by mutating the file and watching nothing happen, which is the only way a
 * guard that matches its own scaffolding gets caught.
 *
 * Comments go for the reason the theme-token guard learned: prose naming the thing it forbids is not
 * the thing.
 */
const asked = (source: string) =>
  source
    .split("\n")
    .filter((line) => !isComment(line) && !/^\s*(?:import\b|\}\s*from\b|[\w$]+,?\s*$)/.test(line))
    .join("\n");

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
const EXEMPT = new Map([
  [
    "workspace/desktop-switcher.tsx",
    "Lists what is filed elsewhere, so membership would empty the list it draws.",
  ],
  [
    "canvas/open-window.ts",
    "Placement asks membership; a tab member needs no filter because the shell's own rect is already an occupant, which its comment argues in full.",
  ],
]);

test("no source decides what is visible from `mode` alone", () => {
  const offenders = sources.flatMap((path) => {
    const relative = path.slice(sourceRoot.length);
    const source = readFileSync(path, "utf8");

    const body = asked(source);

    if (EXEMPT.has(relative) || (ASKS_HIDDEN.test(body) && ASKS_MEMBERSHIP.test(body))) {
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

test("the check bites on the exact filter that was wrong seven times", () => {
  // The shape `describeCanvas` shipped with, and the shape the roadmap's sweep found five of.
  expect(MODE_FILTER.test('      window.mode === "minimized" ? null : window.mode,')).toBe(true);
  expect(MODE_FILTER.test('    .filter((window) => window.mode !== "minimized")')).toBe(true);
});

test("the check clears a file that consults both of the framework's answers", () => {
  // `connector-geometry.ts` filters on `mode` and reads *both* — that is the correct shape and must
  // not be flagged, or the guard trains people to suppress it.
  const body = asked(readFileSync(join(sourceRoot, "canvas/connector-geometry.ts"), "utf8"));

  expect(MODE_FILTER.test(body)).toBe(true);
  expect(ASKS_HIDDEN.test(body)).toBe(true);
  expect(ASKS_MEMBERSHIP.test(body)).toBe(true);
});

test("an import is not an answer", () => {
  /*
   * The hole this guard had until it was mutated. Deleting the only call to the membership helper
   * from `field.tsx` left the import standing, `ASKS_MEMBERSHIP` matched the import line, and the
   * check stayed green over exactly the bug it exists to catch.
   */
  const importOnly = [
    'import { isInfiniteCanvasWindowInActiveWorkspace } from "@hyphened/infinite-canvas";',
    '  .filter((w) => w.mode !== "minimized" && !hiddenWindowIds.has(w.id))',
  ].join("\n");

  expect(ASKS_MEMBERSHIP.test(importOnly)).toBe(true);
  expect(ASKS_MEMBERSHIP.test(asked(importOnly))).toBe(false);
});

test("asking one question does not excuse the other, which is how the eighth was found", () => {
  /*
   * The shape `field.tsx` shipped with: minimized and tab members filtered, desktop membership
   * never asked. Under the old single check this cleared the whole file, because `hiddenWindowIds`
   * appeared in it. Asserted as text rather than against the file, so fixing the file does not
   * silently delete the case.
   */
  const asksOnlyHidden =
    'windows.filter((w) => w.mode !== "minimized" && !hiddenWindowIds.has(w.id))';

  expect(MODE_FILTER.test(asksOnlyHidden)).toBe(true);
  expect(ASKS_HIDDEN.test(asksOnlyHidden)).toBe(true);
  expect(ASKS_MEMBERSHIP.test(asksOnlyHidden)).toBe(false);
});

test("every exemption names a file that exists and still holds the read it is exempt for", () => {
  // An exemption for a file that has moved is an exemption for nothing, and it fails open. Each
  // carries its reason here so adding one is a sentence somebody has to write.
  for (const [relative, reason] of EXEMPT) {
    expect(reason.length, relative).toBeGreaterThan(20);
    expect(MODE_FILTER.test(readFileSync(join(sourceRoot, relative), "utf8")), relative).toBe(true);
  }
});
