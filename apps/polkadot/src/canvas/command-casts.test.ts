import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

import { DEFAULT_INFINITE_CANVAS_COMMAND_DESCRIPTORS } from "@hyphened/infinite-canvas";
import { expect, test } from "vite-plus/test";

/**
 * A command comes from the framework's table. It is never asserted into existence.
 *
 * An id is not a command. Most of the time it looks like one — `view.fitAll` is the id of
 * `{ type: "view.fitAll" }` — so `{ type: id }` compiles under a cast and works, right up until it
 * meets a verb whose id encodes an argument. `group.setLayout.split` is the id of
 * `{ type: "group.setLayout", layout: "split" }`, and the fabricated form throws
 * `Unknown infinite canvas command type` at the reducer.
 *
 * The radial menu shipped exactly that. Three layout spokes threw on every click from the day the
 * ring was written, while the other fifteen verbs on the same three rings worked — which is what
 * made it survive: the surface looked fine and failed only on the third of it nobody clicked while
 * building the rest.
 *
 * **The cast is the defect, not the typo.** Without it, `{ type: "group.setLayout.split" }` is a
 * type error that names the problem exactly; `as Parameters<typeof actions.executeCommand>[0]`
 * silences that error and nothing else. The fix is to look the id up —
 * `getInfiniteCanvasContextualCommands` returns each verb's real command alongside its live
 * enablement — so this guard bans the assertion rather than trying to detect the bad ids.
 */

const sourceRoot = fileURLToPath(new URL("..", import.meta.url));

const sources = readdirSync(sourceRoot, { recursive: true, withFileTypes: true })
  .filter(
    (entry) => entry.isFile() && /\.tsx?$/.test(entry.name) && !/\.test\.tsx?$/.test(entry.name),
  )
  .map((entry) => join(entry.parentPath, entry.name));

/**
 * An assertion onto the framework's command type, in the two spellings this repo has written.
 *
 * `\bInfiniteCanvasCommand\b` deliberately does not match `InfiniteCanvasCommandId`: narrowing a
 * string to an id is a different act with a visible failure — an id that resolves to no descriptor
 * renders a disabled spoke labelled with itself, which is loud. Asserting a *command* is the one
 * that reaches the reducer and throws.
 */
const COMMAND_CAST =
  /\bas\s+(?:InfiniteCanvasCommand\b|Parameters\s*<\s*typeof\s+[\w.]+\.executeCommand)/;

/** A comment quoting the old cast is not the old cast. This file does exactly that, twice. */
const isComment = (line: string) => /^\s*(?:\/\/|\/\*|\*)/.test(line);

test("no source asserts a value into the framework's command type", () => {
  const offenders = sources.flatMap((path) => {
    const relative = path.slice(sourceRoot.length);

    return readFileSync(path, "utf8")
      .split("\n")
      .flatMap((line, index) =>
        COMMAND_CAST.test(line) && !isComment(line)
          ? [`${relative}:${String(index + 1)}: ${line.trim()}`]
          : [],
      );
  });

  expect(offenders).toStrictEqual([]);
});

test("the check bites on the exact cast that was there", () => {
  // Both lines verbatim: the shipped one, and the intermediate that replaced it and was no better.
  expect(
    COMMAND_CAST.test(
      "      actions.executeCommand({ type: id } as Parameters<typeof actions.executeCommand>[0]);",
    ),
  ).toBe(true);
  expect(COMMAND_CAST.test("    const command = { type: id } as InfiniteCanvasCommand;")).toBe(
    true,
  );
});

test("the check does not fire on the lookup that replaced it, or on an id narrowing", () => {
  expect(COMMAND_CAST.test("      actions.executeCommand(descriptor.command);")).toBe(false);
  expect(
    COMMAND_CAST.test('  { icon: Scan, id: "view.fitSelection" as InfiniteCanvasCommandId },'),
  ).toBe(false);
});

/**
 * The reason the ban is worth having rather than a lint rule about one id.
 *
 * If every descriptor's command type equalled its id, `{ type: id }` would be correct everywhere
 * and this guard would be ceremony. It is not: the framework ships verbs whose id encodes an
 * argument, and asserting past that is what reaches the reducer with a type it has never heard of.
 */
test("the framework really does ship verbs whose id is not their command type", () => {
  const encodesAnArgument = DEFAULT_INFINITE_CANVAS_COMMAND_DESCRIPTORS.filter(
    (descriptor) => descriptor.command.type !== descriptor.id,
  );

  expect(encodesAnArgument.length).toBeGreaterThan(0);
});
