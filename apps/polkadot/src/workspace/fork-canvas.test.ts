import { expect, test } from "vite-plus/test";

import { getForkedCanvasTitle, stripRecoveryMark } from "./fork-canvas";

/**
 * What a fork of a conflicted canvas is called.
 *
 * The rule was `${canvasTitle} (recovered)`, written inline on the button. `create-canvas.ts`
 * exists because that same shape of inline naming was wrong for new canvases, and its docstring
 * closes with "`open-note.ts` found and recorded exactly this for notes; the lesson stayed with
 * notes." It stayed with `createCanvas` as well — this is the third copy.
 *
 * Both failures are ordinary, not edge cases: conflict the same canvas twice and you had two
 * canvases with one name, in the switcher that exists to tell them apart; fork a fork and the mark
 * compounded.
 */

test("the first fork gets the bare mark, because it is a real name rather than a placeholder", () => {
  expect(getForkedCanvasTitle("Main canvas", [])).toBe("Main canvas (recovered)");
});

test("a second fork of the same canvas is numbered rather than duplicated", () => {
  // The defect, stated: this returned "Main canvas (recovered)" a second time.
  expect(getForkedCanvasTitle("Main canvas", ["Main canvas", "Main canvas (recovered)"])).toBe(
    "Main canvas (recovered) 2",
  );
});

test("numbering continues past the highest taken, not from a count", () => {
  // The rule `titles.ts` exists to hold: a count is a fact about how many exist, not about which
  // names are taken, so deleting the middle one must not hand its name out again.
  expect(
    getForkedCanvasTitle("Main canvas", ["Main canvas (recovered)", "Main canvas (recovered) 5"]),
  ).toBe("Main canvas (recovered) 6");
});

test("forking a fork recovers the original, rather than compounding the mark", () => {
  // Was "Main canvas (recovered) (recovered)". A recovery of a recovery is still a recovery of the
  // same original; the numbering is what carries the difference.
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
  // Not a property of this function so much as of what it is handed — asserted here because the
  // failure it prevents surfaces long after the action: a name skipped now collides the moment
  // somebody restores the archived canvas holding it.
  expect(getForkedCanvasTitle("Main canvas", ["Main canvas (recovered)"])).toBe(
    "Main canvas (recovered) 2",
  );
});

test("a canvas whose own name contains parentheses is not mistaken for a fork", () => {
  // `titles.ts` escapes its label for this reason; the strip has to be as careful. "Q3 (draft)"
  // is somebody's name, not a mark this code put there.
  expect(stripRecoveryMark("Q3 (draft)")).toBe("Q3 (draft)");
  expect(getForkedCanvasTitle("Q3 (draft)", [])).toBe("Q3 (draft) (recovered)");
});

test("the mark is only stripped from the end", () => {
  // A canvas someone deliberately called "(recovered) notes" keeps its name.
  expect(stripRecoveryMark("(recovered) notes")).toBe("(recovered) notes");
});

test("stripping is idempotent, so a base is stable however often it is forked", () => {
  expect(stripRecoveryMark(stripRecoveryMark("Main canvas (recovered) 4"))).toBe("Main canvas");
});
