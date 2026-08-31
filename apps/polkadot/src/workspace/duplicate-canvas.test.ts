import { expect, test } from "vite-plus/test";

import { getDuplicateCanvasTitle } from "./duplicate-canvas";

test("the first copy gets the bare mark, because it is a real name rather than a placeholder", () => {
  expect(getDuplicateCanvasTitle("Q3", [])).toBe("Q3 copy");
});

test("a second copy of the same canvas is numbered rather than duplicated", () => {
  expect(getDuplicateCanvasTitle("Q3", ["Q3", "Q3 copy"])).toBe("Q3 copy 2");
});

test("duplicating a copy copies the original, rather than compounding the mark", () => {
  expect(getDuplicateCanvasTitle("Q3 copy", ["Q3", "Q3 copy"])).toBe("Q3 copy 2");
  expect(getDuplicateCanvasTitle("Q3 copy 2", ["Q3", "Q3 copy", "Q3 copy 2"])).toBe("Q3 copy 3");
});

test("numbering continues past the highest taken, not from a count", () => {
  expect(getDuplicateCanvasTitle("Q3", ["Q3 copy", "Q3 copy 5"])).toBe("Q3 copy 6");
});

test("archived names count as taken, which is why the caller asks for both lists", () => {
  expect(getDuplicateCanvasTitle("Q3", ["Q3 copy"])).toBe("Q3 copy 2");
});

test("a canvas whose own name contains parentheses is matched literally", () => {
  expect(getDuplicateCanvasTitle("Q3 (draft)", [])).toBe("Q3 (draft) copy");
  expect(getDuplicateCanvasTitle("Q3 (draft)", ["Q3 (draft) copy"])).toBe("Q3 (draft) copy 2");
});

test("the mark is only stripped from the end, and only as a whole word", () => {
  expect(getDuplicateCanvasTitle("copy of Q3", [])).toBe("copy of Q3 copy");
  expect(getDuplicateCanvasTitle("Photocopy", [])).toBe("Photocopy copy");
});
