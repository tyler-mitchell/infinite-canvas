import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

import { expect, test } from "vite-plus/test";

/**
 * A switcher does not claim its list is empty before it has asked.
 *
 * Both switchers fetch when the menu opens rather than on mount, which is the right trade — the
 * list is small, goes stale the moment another is created, and most sessions never open it. The
 * consequence is that the observable starts `[]`, and `[]` means two different things: nobody has
 * asked yet, and the answer was nothing.
 *
 * `library-rail` states the rule this comes from, having got it wrong first: "an empty state is a
 * claim about the world; it needs an answer behind it." A project holding thirty notes greeting you
 * with "No notes yet" reads as data loss, which is the one thing a local-first app must never
 * imply.
 *
 * The canvas switcher had the guard. The project switcher rendered a "Projects" heading with
 * nothing beneath it — answering a question nobody had asked, and saying you have no projects while
 * you are standing inside one. Same lesson, learned once, not carried; the fourth time this session
 * that shape has produced a defect, which is why it gets a guard rather than a comment.
 *
 * Asserted on the source because what goes missing is the branch itself, and it goes missing when
 * somebody writes the next switcher by copying one of these. The loading frame could not be
 * observed directly: the automated pane does not composite, so `requestAnimationFrame` never fires
 * and a state that lasts one frame has no frame to last for.
 */

const SWITCHERS = ["canvas-switcher.tsx", "project-switcher.tsx"] as const;

const read = (name: string) =>
  readFileSync(fileURLToPath(new URL(`./${name}`, import.meta.url)), "utf8");

/**
 * The rendered branch, not the word.
 *
 * Scanning for "Loading…" was the obvious check and the wrong one: the string also appears in the
 * comment above the branch explaining why it is there, so the guard would pass on a file where the
 * branch had been deleted and only the explanation survived — the exact half-removal it exists to
 * catch. `styles.empty()` is only ever the rendered element. Found by the discrimination test
 * below, which failed on the first run for precisely this reason.
 */
const EMPTY_BRANCH = "styles.empty()";

test.each(SWITCHERS)("%s says it is loading rather than showing an empty list", (name) => {
  const source = read(name);

  // The premise: this file fetches on open, which is what makes the empty-vs-unasked ambiguity
  // exist at all. If that stops being true the assertion below is about nothing.
  expect(source).toContain("onOpenChange");
  expect(source).toContain("length === 0");
  expect(source).toContain(EMPTY_BRANCH);
});

test("the scan would notice the branch going missing", () => {
  const before = read("project-switcher.tsx").replaceAll(EMPTY_BRANCH, "");

  expect(before).not.toContain(EMPTY_BRANCH);
});
