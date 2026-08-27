import { expect, test } from "vite-plus/test";

import { getDuplicateCanvasTitle } from "./duplicate-canvas";

/**
 * What a copy of a canvas is called.
 *
 * The rule was `${title} copy`, written inline on the switcher's menu item — the same shape
 * `create-canvas.ts` exists to stop and `fork-canvas.ts` already fixed once under a different
 * word. Both failures that file names were live here, and neither is an edge case: duplicating
 * twice put two "Q3 copy" in the switcher that exists to tell them apart, and duplicating a copy
 * compounded the mark.
 */

test("the first copy gets the bare mark, because it is a real name rather than a placeholder", () => {
  expect(getDuplicateCanvasTitle("Q3", [])).toBe("Q3 copy");
});

test("a second copy of the same canvas is numbered rather than duplicated", () => {
  // The defect, stated: this returned "Q3 copy" a second time.
  expect(getDuplicateCanvasTitle("Q3", ["Q3", "Q3 copy"])).toBe("Q3 copy 2");
});

test("duplicating a copy copies the original, rather than compounding the mark", () => {
  // Was "Q3 copy copy", then "Q3 copy copy copy". Finder gives "Q3 copy 2" for the same gesture.
  expect(getDuplicateCanvasTitle("Q3 copy", ["Q3", "Q3 copy"])).toBe("Q3 copy 2");
  expect(getDuplicateCanvasTitle("Q3 copy 2", ["Q3", "Q3 copy", "Q3 copy 2"])).toBe("Q3 copy 3");
});

test("numbering continues past the highest taken, not from a count", () => {
  // The rule `titles.ts` exists to hold: a count says how many exist, not which names are taken.
  expect(getDuplicateCanvasTitle("Q3", ["Q3 copy", "Q3 copy 5"])).toBe("Q3 copy 6");
});

test("archived names count as taken, which is why the caller asks for both lists", () => {
  // The failure surfaces long after the action: a name skipped now collides the moment somebody
  // restores the archived canvas holding it, from the same menu that made this one.
  expect(getDuplicateCanvasTitle("Q3", ["Q3 copy"])).toBe("Q3 copy 2");
});

test("a canvas whose own name contains parentheses is matched literally", () => {
  // `titles.ts` escapes the mark and the label for this reason. Unescaped, "(draft)" is a group.
  expect(getDuplicateCanvasTitle("Q3 (draft)", [])).toBe("Q3 (draft) copy");
  expect(getDuplicateCanvasTitle("Q3 (draft)", ["Q3 (draft) copy"])).toBe("Q3 (draft) copy 2");
});

test("the mark is only stripped from the end, and only as a whole word", () => {
  // Someone's own name, not a mark this code put there. "Photocopy" ends in the letters without
  // ending in the mark, which is why the strip requires the space.
  expect(getDuplicateCanvasTitle("copy of Q3", [])).toBe("copy of Q3 copy");
  expect(getDuplicateCanvasTitle("Photocopy", [])).toBe("Photocopy copy");
});
