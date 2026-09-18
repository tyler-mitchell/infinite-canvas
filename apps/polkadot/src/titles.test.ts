import { expect, test } from "vite-plus/test";

import { getNextNumberedTitle, getNextRepeatTitle, getNextSuffixedTitle } from "./titles";

test.each([
  { label: "Links", titles: ["Notes", "swatch.png"], expected: "Links" },
  { label: "Links", titles: ["Links", "Links 2"], expected: "Links 3" },
  { label: "Links", titles: ["Links archive", "Linkstwo"], expected: "Links" },
  { label: "Notes (2024)", titles: ["Notes 2024 2"], expected: "Notes (2024)" },
  { label: "a.b", titles: ["axb 5"], expected: "a.b" },
  {
    label: "Connected to Router Docs",
    titles: ["Connected to Router Docs"],
    expected: "Connected to Router Docs 2",
  },
])("repeated label $label yields $expected", ({ label, titles, expected }) => {
  expect(getNextRepeatTitle(label, titles)).toBe(expected);
});

test.each([
  { mark: "copy", title: "Q3", takenTitles: [], expected: "Q3 copy" },
  { mark: "copy", title: "Q3", takenTitles: ["Q3", "Q3 copy"], expected: "Q3 copy 2" },
  { mark: "copy", title: "Q3 copy", takenTitles: ["Q3", "Q3 copy"], expected: "Q3 copy 2" },
  {
    mark: "copy",
    title: "Q3 copy 2",
    takenTitles: ["Q3", "Q3 copy", "Q3 copy 2"],
    expected: "Q3 copy 3",
  },
  { mark: "copy", title: "Q3", takenTitles: ["Q3 copy", "Q3 copy 5"], expected: "Q3 copy 6" },
  { mark: "copy", title: "Q3", takenTitles: ["Q3 copy"], expected: "Q3 copy 2" },
  { mark: "copy", title: "Q3 (draft)", takenTitles: [], expected: "Q3 (draft) copy" },
  {
    mark: "copy",
    title: "Q3 (draft)",
    takenTitles: ["Q3 (draft) copy"],
    expected: "Q3 (draft) copy 2",
  },
  { mark: "copy", title: "copy of Q3", takenTitles: [], expected: "copy of Q3 copy" },
  {
    mark: "(recovered)",
    title: "Main canvas",
    takenTitles: [],
    expected: "Main canvas (recovered)",
  },
  {
    mark: "(recovered)",
    title: "Main canvas",
    takenTitles: ["Main canvas", "Main canvas (recovered)"],
    expected: "Main canvas (recovered) 2",
  },
  {
    mark: "(recovered)",
    title: "Main canvas",
    takenTitles: ["Main canvas (recovered)", "Main canvas (recovered) 5"],
    expected: "Main canvas (recovered) 6",
  },
  {
    mark: "(recovered)",
    title: "Main canvas (recovered)",
    takenTitles: ["Main canvas (recovered)"],
    expected: "Main canvas (recovered) 2",
  },
  {
    mark: "(recovered)",
    title: "Main canvas (recovered) 2",
    takenTitles: ["Main canvas (recovered)", "Main canvas (recovered) 2"],
    expected: "Main canvas (recovered) 3",
  },
  {
    mark: "(recovered)",
    title: "Main canvas",
    takenTitles: ["Main canvas (recovered)"],
    expected: "Main canvas (recovered) 2",
  },
  {
    mark: "(recovered)",
    title: "Q3 (draft)",
    takenTitles: ["Q3 (draft) (recovered)"],
    expected: "Q3 (draft) (recovered) 2",
  },
  {
    mark: "(recovered)",
    title: "(recovered) notes",
    takenTitles: [],
    expected: "(recovered) notes (recovered)",
  },
  {
    mark: "(recovered)",
    title: "Main canvas (recovered) 4",
    takenTitles: [],
    expected: "Main canvas (recovered)",
  },
])("suffixing $title yields $expected", ({ expected, ...input }) => {
  expect(getNextSuffixedTitle(input)).toBe(expected);
});

test.each(["View", "Canvas", "Project", "Untitled"])(
  "%s titles increment large ordinals exactly",
  (label) => {
    expect(getNextNumberedTitle(label, [`${label} 9007199254740992`])).toBe(
      `${label} 9007199254740993`,
    );
    expect(getNextNumberedTitle(label, [`${label} ${"9".repeat(320)}`])).toBe(
      `${label} 1${"0".repeat(320)}`,
    );
    expect(getNextNumberedTitle(label, ["Overview"])).toBe(`${label} 1`);
  },
);

test("repeat and suffix titles preserve large ordinals", () => {
  expect(getNextRepeatTitle("Links", ["Links", "Links 9007199254740992"])).toBe(
    "Links 9007199254740993",
  );
  expect(
    getNextSuffixedTitle({
      mark: "copy",
      title: "Main copy 9007199254740992",
      takenTitles: ["Main copy", "Main copy 9007199254740992"],
    }),
  ).toBe("Main copy 9007199254740993");
});

test("large title lists do not exceed the function argument limit", () => {
  const titles = Array.from({ length: 150_000 }, (_, index) => `Untitled ${index + 1}`);
  expect(getNextNumberedTitle("Untitled", titles)).toBe("Untitled 150001");
});

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
