import { expect, test } from "vite-plus/test";

import { getNextNumberedTitle, getNextRepeatTitle, getNextSuffixedTitle } from "./titles";

test("numbering follows the highest taken, never the count", () => {
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

test("a mark applied to a marked title replaces it rather than stacking", () => {
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
  expect(getNextSuffixedTitle({ mark: "(recovered)", takenTitles: [], title: "Q3 (draft)" })).toBe(
    "Q3 (draft) (recovered)",
  );
  expect(getNextSuffixedTitle({ mark: "a.b", takenTitles: [], title: "Q3 axb" })).toBe(
    "Q3 axb a.b",
  );
});

test("a title that merely ends in the mark's letters is not marked", () => {
  expect(getNextSuffixedTitle({ mark: "copy", takenTitles: [], title: "Photocopy" })).toBe(
    "Photocopy copy",
  );
});

test("a label carrying regex punctuation is matched literally", () => {
  expect(getNextRepeatTitle("Notes (2024)", ["Notes (2024)"])).toBe("Notes (2024) 2");
  expect(getNextRepeatTitle("Notes (2024)", ["Notes 2024 7"])).toBe("Notes (2024)");
  expect(getNextNumberedTitle("a.b", ["axb 5"])).toBe("a.b 1");
});
