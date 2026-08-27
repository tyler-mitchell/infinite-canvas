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

/** `className="…"` — a literal, as opposed to `className={…}` which is an expression. */
const LITERAL_CLASS_NAME = /className="[^"]*"/g;

test("no component writes a class list by hand", () => {
  const offenders = sources().flatMap((file) => {
    const matches = readFileSync(`${SRC}${file}`, "utf8").match(LITERAL_CLASS_NAME);

    return matches === null ? [] : matches.map((match) => `${file}: ${match}`);
  });

  expect(offenders).toEqual([]);
});

test("the scan would notice one being added", () => {
  const planted = `<div className="flex items-center gap-2" />`;

  expect(planted.match(LITERAL_CLASS_NAME)).toEqual([`className="flex items-center gap-2"`]);
});

test("it does not mistake a slot call for a literal", () => {
  const allowed = `<div className={styles.row()} />`;

  expect(allowed.match(LITERAL_CLASS_NAME)).toBeNull();
});
