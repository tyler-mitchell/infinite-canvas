import { expect, test } from "vite-plus/test";

import { getNextCollectionTitle } from "./open-collection";

test("the first of a name keeps it — a collection's name means something on its own", () => {
  expect(getNextCollectionTitle("Links", [])).toBe("Links");
  expect(getNextCollectionTitle("Links", ["Notes", "swatch.png"])).toBe("Links");
});

test("a repeat is numbered from two, because the bare name is the first", () => {
  expect(getNextCollectionTitle("Links", ["Links"])).toBe("Links 2");
  expect(getNextCollectionTitle("Links", ["Links", "Links 2"])).toBe("Links 3");
});

test("numbering follows the highest taken, not the count", () => {
  expect(getNextCollectionTitle("Links", ["Links", "Links 3"])).toBe("Links 4");
});

test("a name that merely starts the same is not a repeat", () => {
  expect(getNextCollectionTitle("Links", ["Links archive", "Linkstwo"])).toBe("Links");
});

test("a label carrying regex punctuation is matched literally", () => {
  expect(getNextCollectionTitle("Notes (2024)", ["Notes (2024)"])).toBe("Notes (2024) 2");
  expect(getNextCollectionTitle("Notes (2024)", ["Notes 2024 2"])).toBe("Notes (2024)");
  expect(getNextCollectionTitle("a.b", ["axb 5"])).toBe("a.b");
});

test("a connected-to collection is numbered like any other", () => {
  expect(getNextCollectionTitle("Connected to Router Docs", ["Connected to Router Docs"])).toBe(
    "Connected to Router Docs 2",
  );
});
