import { expect, test } from "vite-plus/test";

import { getNextNumberedTitle, getNextRepeatTitle } from "./titles";

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
