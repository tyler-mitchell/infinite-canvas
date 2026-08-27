import { readdirSync, readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

import { expect, test } from "vite-plus/test";

/**
 * Every field this app renders says what it is.
 *
 * A control with no accessible name is the quietest defect a UI can have: it renders correctly,
 * typechecks, passes every visual review, and is simply unusable without sight. Audited on
 * 2026-08-27 by walking the running app's focusable elements — 77 of them, and **six had no name**:
 * three note titles, two note bodies, and the library search.
 *
 * The two note bodies were the real failure. `role="textbox"`, editable, and nothing at all to say
 * what they edit, because Lexical draws its placeholder as a sibling `div` rather than a
 * `placeholder` attribute, so there was not even a fallback to fall back to.
 *
 * The other four were subtler and worth naming, because they *looked* covered. `placeholder` is the
 * last resort of the accessible-name computation, so those fields did have names — and every note
 * title's name was the literal string "Untitled", the same on every note including the ones already
 * titled. Three notes open announced three identical fields. A name that cannot distinguish two
 * things is not a name.
 *
 * Buttons are deliberately not scanned here: an icon-only button carries `aria-label` and one with
 * a word in it is named by that word, so the rule is not uniform and a scan enforcing one would
 * fail on correct code.
 */

const SRC = fileURLToPath(new URL(".", import.meta.url));

/**
 * Everything between the tag and the end of its opening element.
 *
 * The first version took a fixed 120 characters, on the reasoning that `aria-label` sorts first
 * among lint-ordered props so a short window would always contain it. That is true of `aria-label`
 * and false of the other spellings: the project-removal dialog is named by `id` paired with a
 * `htmlFor`, and `id` sorts after `autoComplete` and `className`, landing past the cutoff. The
 * window reported it unnamed — a scan wrong in the direction that costs the most, since the
 * "correction" would have been to damage working code.
 *
 * Read to the end of the tag instead. Props are formatted one per line here, so the opening element
 * ends at the first line that is nothing but its closer; a single-line element closes on its own
 * first line.
 */
const openingTag = (rest: string) => {
  const lines = rest.split("\n");
  const closes = (line: string) => line.trim() === "/>" || line.trim() === ">";

  if (lines[0]?.includes(">") === true) {
    return lines[0];
  }

  const end = lines.findIndex(closes);

  return (end === -1 ? lines : lines.slice(0, end)).join("\n");
};

/** `<input` and `<ContentEditable`, the two tags in this app that render an editable field. */
const FIELD_TAGS = ["<input", "<ContentEditable"] as const;

const sources = (): readonly string[] =>
  readdirSync(SRC, { encoding: "utf8", recursive: true })
    .filter((entry) => entry.endsWith(".tsx") && !entry.endsWith(".test.tsx"))
    .map((entry) => entry.replaceAll("\\", "/"));

/**
 * Three ways to be named, not one, and the third is the reason this is not a one-line check.
 *
 * The first draft demanded `aria-label` and flagged the project-removal dialog, which is named by a
 * visible `<label htmlFor>` — the better mechanism of the two, since the name is on screen as well
 * as in the accessibility tree. "Fixing" it would have meant adding an `aria-label` that *overrides*
 * the visible label, so a scan that only knows one spelling does not just miss code, it argues for
 * worse code.
 */
const isNamed = (props: string, source: string) => {
  if (props.includes("aria-label")) {
    return true;
  }

  const id = /\bid="([^"]+)"/.exec(props)?.[1];

  return id !== undefined && source.includes(`htmlFor="${id}"`);
};

const unnamedFields = (source: string, file: string) =>
  FIELD_TAGS.flatMap((tag) =>
    source
      .split(tag)
      .slice(1)
      .map(openingTag)
      .filter((props) => !isNamed(props, source))
      .map(() => `${file}: ${tag} with no accessible name`),
  );

test("no field is rendered without an accessible name", () => {
  const offenders = sources().flatMap((file) =>
    unnamedFields(readFileSync(`${SRC}${file}`, "utf8"), file),
  );

  expect(offenders).toEqual([]);
});

test("the scan would notice a field losing its name", () => {
  const planted = `<input className={styles.title()} placeholder="Untitled" />`;

  expect(unnamedFields(planted, "planted.tsx")).toHaveLength(1);
});

test("it accepts a field that has one", () => {
  const named = `<input aria-label="Note title" className={styles.title()} />`;

  expect(unnamedFields(named, "named.tsx")).toEqual([]);
});

test("a visible label counts, and counts as the better answer", () => {
  const labelled = `<label htmlFor="confirm">Type the name</label><input id="confirm" />`;

  expect(unnamedFields(labelled, "labelled.tsx")).toEqual([]);
});

test("an id nothing points at is not a name", () => {
  const orphaned = `<input id="confirm" className={styles.input()} />`;

  expect(unnamedFields(orphaned, "orphaned.tsx")).toHaveLength(1);
});
