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
 * The ordinals already spoken for under `label`, ignoring anything that merely starts the same.
 *
 * The label is escaped because it is not always a constant: a collection can be named after an
 * item the user titled, so `Notes (2024)` would otherwise compile to a group matching `Notes 2024`,
 * and a `.` would match any character.
 */
function getUsedOrdinals(label: string, titles: readonly string[]): readonly number[] {
  const pattern = new RegExp(
    `^${label.replaceAll(/[.*+?^${}()|[\]\\]/gu, String.raw`\$&`)} (\\d+)$`,
  );

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

export { getNextNumberedTitle, getNextRepeatTitle };
