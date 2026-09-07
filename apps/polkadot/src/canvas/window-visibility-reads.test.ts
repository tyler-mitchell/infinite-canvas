import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

import { expect, test } from "vite-plus/test";

const sourceRoot = fileURLToPath(new URL("..", import.meta.url));

const sources = readdirSync(sourceRoot, { recursive: true, withFileTypes: true })
  .filter(
    (entry) => entry.isFile() && /\.tsx?$/.test(entry.name) && !/\.test\.tsx?$/.test(entry.name),
  )
  .map((entry) => join(entry.parentPath, entry.name));

const MODE_FILTER = /\bmode\s*[!=]==\s*"minimized"/;

const ASKS_HIDDEN =
  /getInfiniteCanvasGroupProjection|hiddenWindowIds|getSelectableWindowIds|getInfiniteCanvasWindowPresence/;
const ASKS_MEMBERSHIP =
  /isInfiniteCanvasWindowInActiveWorkspace|getInfiniteCanvasWorkspaceWindowIds|getInfiniteCanvasWindowPresence/;

const isComment = (line: string) => /^\s*(?:\/\/|\/\*|\*)/.test(line);

const asked = (source: string) =>
  source
    .split("\n")
    .filter((line) => !isComment(line) && !/^\s*(?:import\b|\}\s*from\b|[\w$]+,?\s*$)/.test(line))
    .join("\n");

const EXEMPT = new Map([
  [
    "workspace/desktop-switcher.tsx",
    "Lists what is filed elsewhere, so membership would empty the list it draws.",
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
  expect(MODE_FILTER.test('      window.mode === "minimized" ? null : window.mode,')).toBe(true);
  expect(MODE_FILTER.test('    .filter((window) => window.mode !== "minimized")')).toBe(true);
});

test("the check clears a file that consults both of the framework's answers", () => {
  const body = asked(readFileSync(join(sourceRoot, "canvas/connector-geometry.ts"), "utf8"));

  expect(MODE_FILTER.test(body)).toBe(true);
  expect(ASKS_HIDDEN.test(body)).toBe(true);
  expect(ASKS_MEMBERSHIP.test(body)).toBe(true);
});

test("an import is not an answer", () => {
  const importOnly = [
    'import { isInfiniteCanvasWindowInActiveWorkspace } from "@hyphened/infinite-canvas";',
    '  .filter((w) => w.mode !== "minimized" && !hiddenWindowIds.has(w.id))',
  ].join("\n");

  expect(ASKS_MEMBERSHIP.test(importOnly)).toBe(true);
  expect(ASKS_MEMBERSHIP.test(asked(importOnly))).toBe(false);
});

test("asking one question does not excuse the other, which is how the eighth was found", () => {
  const asksOnlyHidden =
    'windows.filter((w) => w.mode !== "minimized" && !hiddenWindowIds.has(w.id))';

  expect(MODE_FILTER.test(asksOnlyHidden)).toBe(true);
  expect(ASKS_HIDDEN.test(asksOnlyHidden)).toBe(true);
  expect(ASKS_MEMBERSHIP.test(asksOnlyHidden)).toBe(false);
});

test("every exemption names a file that exists and still holds the read it is exempt for", () => {
  for (const [relative, reason] of EXEMPT) {
    expect(reason.length, relative).toBeGreaterThan(20);
    expect(MODE_FILTER.test(readFileSync(join(sourceRoot, relative), "utf8")), relative).toBe(true);
  }
});
