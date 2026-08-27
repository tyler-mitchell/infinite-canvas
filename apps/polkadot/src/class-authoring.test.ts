import { readdirSync, readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

import { expect, test } from "vite-plus/test";

/**
 * Every class this app renders comes from a `tv` slot.
 *
 * `AGENTS.md` states it as non-negotiable and `ROADMAP.md` lists it under the bar, and until now
 * nothing checked it. A rule that only exists in prose is a rule that erodes one hurried component
 * at a time, and the erosion is invisible: a literal `className` typechecks, lints, renders, and
 * looks identical to a slot call in a screenshot. What it costs shows up later, when a token moves
 * and the one element written by hand keeps the old value.
 *
 * Scanned on the source because that is where the decision lives. A rendered class list cannot say
 * whether it came from a slot or from a string somebody typed.
 */

const SRC = fileURLToPath(new URL(".", import.meta.url));

const sources = (): readonly string[] =>
  readdirSync(SRC, { encoding: "utf8", recursive: true })
    .filter((entry) => entry.endsWith(".tsx") && !entry.endsWith(".test.tsx"))
    .map((entry) => entry.replaceAll("\\", "/"));

/**
 * A class list written out rather than called for, in the three spellings that are the same thing.
 *
 * `className="…"` is the obvious one. `className={"…"}` and a template literal are the same string
 * wearing braces, and a guard that caught only the first would be bypassed by a keystroke — not
 * maliciously, just by whoever reaches for interpolation to append one modifier.
 *
 * **The boundary, stated because it is not zero.** A literal smuggled through a call —
 * `className={cn(styles.row(), "mt-1")}` — is not caught, and neither is a class string exported
 * from a `.ts` file. Both are real, and both need a heuristic for "looks like Tailwind" that would
 * fire on ordinary prose. This catches the spellings that can be recognised exactly.
 */
const LITERAL_CLASS_NAME = /className=(?:"[^"]*"|\{\s*(?:"[^"]*"|'[^']*'|`[^`]*`)\s*\})/g;

test("no component writes a class list by hand", () => {
  const offenders = sources().flatMap((file) => {
    const matches = readFileSync(`${SRC}${file}`, "utf8").match(LITERAL_CLASS_NAME);

    return matches === null ? [] : matches.map((match) => `${file}: ${match}`);
  });

  expect(offenders).toEqual([]);
});

test.each([
  ["a bare attribute", '<div className="flex items-center gap-2" />'],
  ["the same string in braces", '<div className={"flex items-center gap-2"} />'],
  ["a template literal", "<div className={`flex items-center gap-2`} />"],
])("the scan notices %s", (_spelling, planted) => {
  expect(planted.match(LITERAL_CLASS_NAME)).toHaveLength(1);
});

test.each([
  ["a slot call", "<div className={styles.row()} />"],
  ["a slot call with a variant", "<div className={styles.chip({ active: true })} />"],
  ["a className passed through from props", "<Icon className={className} />"],
])("it does not mistake %s for a literal", (_shape, allowed) => {
  expect(allowed.match(LITERAL_CLASS_NAME)).toBeNull();
});
