import { expect, test } from "vite-plus/test";

import { getNextCollectionTitle } from "./open-collection";

/**
 * A collection is named for what it lists, so without this every one of a kind had one name.
 *
 * Watched in the library rail on a real project: five rows, four of them reading "Links", with
 * nothing on the row to tell them apart. `open-note.ts` records the identical symptom for notes
 * and fixed it there; collections never got the same treatment.
 */

test("the first of a name keeps it — a collection's name means something on its own", () => {
  // The point of departure from `Untitled n`. "Links" is a real name; numbering it from one would
  // make the common case worse to read in exchange for consistency with a case that reads badly.
  expect(getNextCollectionTitle("Links", [])).toBe("Links");
  expect(getNextCollectionTitle("Links", ["Notes", "swatch.png"])).toBe("Links");
});

test("a repeat is numbered from two, because the bare name is the first", () => {
  expect(getNextCollectionTitle("Links", ["Links"])).toBe("Links 2");
  expect(getNextCollectionTitle("Links", ["Links", "Links 2"])).toBe("Links 3");
});

test("numbering follows the highest taken, not the count", () => {
  // Deleting "Links 2" must not hand its name out again while "Links 3" still holds a number
  // above it — the same reasoning `open-note.ts` gives for not using a length.
  expect(getNextCollectionTitle("Links", ["Links", "Links 3"])).toBe("Links 4");
});

test("a name that merely starts the same is not a repeat", () => {
  expect(getNextCollectionTitle("Links", ["Links archive", "Linkstwo"])).toBe("Links");
});

test("a label carrying regex punctuation is matched literally", () => {
  /*
   * Not hypothetical: a connected-to collection is named after an item the user titled, so the
   * label reaches the pattern as arbitrary text. Unescaped, `Notes (2024)` compiles to a group
   * matching `Notes 2024`, and a `.` matches any character — so the count would be read off
   * titles that are not repeats at all.
   */
  expect(getNextCollectionTitle("Notes (2024)", ["Notes (2024)"])).toBe("Notes (2024) 2");
  expect(getNextCollectionTitle("Notes (2024)", ["Notes 2024 2"])).toBe("Notes (2024)");
  expect(getNextCollectionTitle("a.b", ["axb 5"])).toBe("a.b");
});

test("a connected-to collection is numbered like any other", () => {
  // Two collections of what one item connects to are as indistinguishable as two "Links".
  expect(getNextCollectionTitle("Connected to Router Docs", ["Connected to Router Docs"])).toBe(
    "Connected to Router Docs 2",
  );
});
