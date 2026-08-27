/**
 * What the next thing is called, when nobody has typed a name.
 *
 * Three kinds default their names and each had its own answer: notes numbered from a scan,
 * collections from a scan added later, canvases from `list.length + 1`. The count is the wrong
 * instrument and `open-note.ts` had already said why — it is a fact about how many exist, not
 * about which names are taken, so deleting the middle one hands its name out again while a higher
 * one still holds it. Notes were fixed. Canvases were not, and the expression was written twice.
 *
 * So the scan lives here once, and the two policies that sit on it are named rather than left as a
 * difference between copies.
 */

/**
 * A label made safe to put in a pattern.
 *
 * None of these labels is a constant: a collection is named after an item the user titled, and a
 * mark is applied to whatever a canvas is called. Unescaped, `Notes (2024)` compiles to a group
 * matching `Notes 2024`, and a `.` matches any character.
 */
const escapeForPattern = (label: string) =>
  label.replaceAll(/[.*+?^${}()|[\]\\]/gu, String.raw`\$&`);

/** The ordinals already spoken for under `label`, ignoring anything that merely starts the same. */
function getUsedOrdinals(label: string, titles: readonly string[]): readonly number[] {
  const pattern = new RegExp(`^${escapeForPattern(label)} (\\d+)$`, "u");

  return titles.flatMap((title) => {
    const ordinal = pattern.exec(title)?.[1];

    return ordinal === undefined ? [] : [Number(ordinal)];
  });
}

/**
 * Always numbered — for a label that says nothing on its own.
 *
 * "Untitled" and "Canvas" are placeholders rather than names, so the first one is `Untitled 1`
 * rather than `Untitled`. One past the highest taken, never a count.
 */
function getNextNumberedTitle(label: string, titles: readonly string[]): string {
  return `${label} ${String(Math.max(0, ...getUsedOrdinals(label, titles)) + 1)}`;
}

/**
 * Bare first, numbered after — for a label that is already a real name.
 *
 * A collection is named for what it lists, so "Links" is meaningful and numbering it from one
 * would make the common case read worse to match a case that reads badly anyway. The first keeps
 * the bare name and repeats are numbered from two, which is the convention every file manager uses.
 */
function getNextRepeatTitle(label: string, titles: readonly string[]): string {
  return titles.includes(label)
    ? // The bare label is the first, so the next repeat is at least 2.
      `${label} ${String(Math.max(1, ...getUsedOrdinals(label, titles)) + 1)}`
    : label;
}

/**
 * A title wearing a mark — for making one thing from another and saying so.
 *
 * A recovery and a copy are the same shape, and both were written inline before they were written
 * here: `${canvasTitle} (recovered)` on the conflict button, `${title} copy` in the canvas
 * switcher. Each carried the same two failures, and the second is the one an appended suffix
 * always has.
 *
 * A repeat collides. Duplicate a canvas twice and both are "Q3 copy", in the switcher that exists
 * to tell them apart, so repeats are numbered — bare first, `2` after, which is what every file
 * manager does.
 *
 * And a mark applied to a marked title compounds: "Q3 copy copy", "Q3 (recovered) (recovered)". A
 * copy of a copy is still a copy *of the original*, so the mark is stripped before it is reapplied
 * and the numbering carries the difference — the same answer Finder gives, "Q3 copy 2".
 *
 * The mark is escaped on the way into the strip for the reason above; `(recovered)` is parentheses
 * to a pattern, and a hand-written regex per mark is exactly where that gets forgotten.
 */
function getNextSuffixedTitle(
  input: Readonly<{ mark: string; takenTitles: readonly string[]; title: string }>,
): string {
  // Both forms come off: the bare mark, and a numbered one from a repeat.
  const marked = new RegExp(` ${escapeForPattern(input.mark)}(?: \\d+)?$`, "u");

  return getNextRepeatTitle(`${input.title.replace(marked, "")} ${input.mark}`, input.takenTitles);
}

export { getNextNumberedTitle, getNextRepeatTitle, getNextSuffixedTitle };
