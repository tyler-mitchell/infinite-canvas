import { expect, test } from "vite-plus/test";

import { getNextNumberedTitle, getNextRepeatTitle, getNextSuffixedTitle } from "./titles";

/**
 * The scan three kinds share, and the one property that is the whole reason it exists.
 *
 * Canvases and projects were named `${list.length + 1}`. A count answers "how many are there",
 * and the question is "which names are taken" — the two agree until something is removed, which
 * is exactly when a switcher full of duplicates is least welcome.
 */

test("numbering follows the highest taken, never the count", () => {
  // The failing case, stated directly: three exist, the middle is gone, and a count would reissue
  // a name that is still in use.
  expect(getNextNumberedTitle("Canvas", ["Canvas 1", "Canvas 3"])).toBe("Canvas 4");
  expect(getNextRepeatTitle("Links", ["Links", "Links 3"])).toBe("Links 4");
});

test("a placeholder label is numbered from one, because it says nothing alone", () => {
  expect(getNextNumberedTitle("Untitled", [])).toBe("Untitled 1");
  expect(getNextNumberedTitle("Canvas", [])).toBe("Canvas 1");
  expect(getNextNumberedTitle("Project", ["Project 1"])).toBe("Project 2");
});

test("a real label keeps itself first and numbers only repeats", () => {
  expect(getNextRepeatTitle("Links", [])).toBe("Links");
  expect(getNextRepeatTitle("Links", ["Links"])).toBe("Links 2");
});

test("a name that merely starts the same is not a repeat", () => {
  expect(getNextNumberedTitle("Canvas", ["Canvas archive", "Canvasx 9"])).toBe("Canvas 1");
  expect(getNextRepeatTitle("Links", ["Linkstwo"])).toBe("Links");
});

/**
 * The third policy: a title wearing a mark.
 *
 * Two callers, one rule. A recovery and a copy were written inline in different files under
 * different words, and each carried the same two bugs — a repeat that collided, and a mark that
 * compounded when applied to something already marked.
 */

test("a mark applied to a marked title replaces it rather than stacking", () => {
  // "Q3 copy copy" and "Main canvas (recovered) (recovered)" were both live.
  expect(getNextSuffixedTitle({ mark: "copy", takenTitles: ["Q3 copy"], title: "Q3 copy" })).toBe(
    "Q3 copy 2",
  );
  expect(
    getNextSuffixedTitle({
      mark: "(recovered)",
      takenTitles: ["Main canvas (recovered)"],
      title: "Main canvas (recovered)",
    }),
  ).toBe("Main canvas (recovered) 2");
});

test("a numbered mark comes off too, so the base does not grow a segment per repeat", () => {
  expect(
    getNextSuffixedTitle({
      mark: "copy",
      takenTitles: ["Q3 copy", "Q3 copy 2"],
      title: "Q3 copy 2",
    }),
  ).toBe("Q3 copy 3");
});

test("the mark is escaped on the way into the strip", () => {
  /*
   * The reason this is shared rather than hand-written per caller. `(recovered)` unescaped is a
   * group, so " (recovered)" would strip the letters off any title ending in them — and every
   * added mark is another chance to forget. Here "Q3 (draft)" keeps its own parentheses.
   */
  expect(getNextSuffixedTitle({ mark: "(recovered)", takenTitles: [], title: "Q3 (draft)" })).toBe(
    "Q3 (draft) (recovered)",
  );
  expect(getNextSuffixedTitle({ mark: "a.b", takenTitles: [], title: "Q3 axb" })).toBe(
    "Q3 axb a.b",
  );
});

test("a title that merely ends in the mark's letters is not marked", () => {
  // The strip requires the separating space: "Photocopy" is somebody's name.
  expect(getNextSuffixedTitle({ mark: "copy", takenTitles: [], title: "Photocopy" })).toBe(
    "Photocopy copy",
  );
});

test("a label carrying regex punctuation is matched literally", () => {
  /*
   * The label is not always a constant — a connected-to collection is named after an item the user
   * titled. Unescaped, `Notes (2024)` compiles to a group matching `Notes 2024`, and `.` matches
   * any character, so the scan would count titles that are not repeats.
   */
  expect(getNextRepeatTitle("Notes (2024)", ["Notes (2024)"])).toBe("Notes (2024) 2");
  expect(getNextRepeatTitle("Notes (2024)", ["Notes 2024 7"])).toBe("Notes (2024)");
  expect(getNextNumberedTitle("a.b", ["axb 5"])).toBe("a.b 1");
});
