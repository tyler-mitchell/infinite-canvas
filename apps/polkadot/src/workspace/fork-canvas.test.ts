import { expect, test } from "vite-plus/test";

import { getForkedCanvasTitle } from "./fork-canvas";

test("the first fork gets the bare mark, because it is a real name rather than a placeholder", () => {
  expect(getForkedCanvasTitle("Main canvas", [])).toBe("Main canvas (recovered)");
});

test("a second fork of the same canvas is numbered rather than duplicated", () => {
  expect(getForkedCanvasTitle("Main canvas", ["Main canvas", "Main canvas (recovered)"])).toBe(
    "Main canvas (recovered) 2",
  );
});

test("numbering continues past the highest taken, not from a count", () => {
  expect(
    getForkedCanvasTitle("Main canvas", ["Main canvas (recovered)", "Main canvas (recovered) 5"]),
  ).toBe("Main canvas (recovered) 6");
});

test("forking a fork recovers the original, rather than compounding the mark", () => {
  expect(getForkedCanvasTitle("Main canvas (recovered)", ["Main canvas (recovered)"])).toBe(
    "Main canvas (recovered) 2",
  );
});

test("forking a numbered fork keeps the same base too", () => {
  expect(
    getForkedCanvasTitle("Main canvas (recovered) 2", [
      "Main canvas (recovered)",
      "Main canvas (recovered) 2",
    ]),
  ).toBe("Main canvas (recovered) 3");
});

test("archived names count as taken, which is why the caller asks for both lists", () => {
  expect(getForkedCanvasTitle("Main canvas", ["Main canvas (recovered)"])).toBe(
    "Main canvas (recovered) 2",
  );
});

test("a canvas whose own name contains parentheses is not mistaken for a fork", () => {
  expect(getForkedCanvasTitle("Q3 (draft)", [])).toBe("Q3 (draft) (recovered)");
  expect(getForkedCanvasTitle("Q3 (draft)", ["Q3 (draft) (recovered)"])).toBe(
    "Q3 (draft) (recovered) 2",
  );
});

test("the mark is only stripped from the end", () => {
  expect(getForkedCanvasTitle("(recovered) notes", [])).toBe("(recovered) notes (recovered)");
});

test("a numbered fork still forks from the original base", () => {
  expect(getForkedCanvasTitle("Main canvas (recovered) 4", [])).toBe("Main canvas (recovered)");
});
