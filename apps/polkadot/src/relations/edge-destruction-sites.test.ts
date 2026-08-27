import { readdirSync, readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

import { expect, test } from "vite-plus/test";

/**
 * Every place that destroys an edge has to have decided what the person loses.
 *
 * Disconnecting is the one removal in this app that destroys something. Archiving is reversible and
 * says so; a canvas gets a dialog; a project gets a typed confirmation. `fn::unrelate_content_items`
 * deletes the row, and `history.undo` is the canvas's and does not reach the database — so a kind
 * someone chose and a sentence someone typed leave with no way to ask for them back.
 *
 * Four surfaces cut edges and they are not equivalent, which is the whole reason this scan exists
 * rather than a blanket rule:
 *
 * - The **library rail** cuts from a list, so the person cannot see the connector. It confirms, and
 *   the dialog quotes the claim.
 * - The **palette's two-note row** acts on an edge nobody selected, possibly off screen. It names the
 *   loss in the row title, because a modal on a keyboard surface that closes on select would
 *   interrupt the one flow it exists to make fast.
 * - The **palette's cut-selected row** and the **Backspace action** both act on a connector the
 *   pointer selected, with its label drawn on the line. The person is looking at what they are
 *   destroying, and a dialog there would be a confirmation for a thing already in view.
 *
 * So the invariant is not "confirm everywhere". It is that a file which destroys edges has either
 * reasoned about the claim or is listed below as acting on a visible selection. A fifth site added
 * later fails this until someone classifies it, which is the point — the failure mode being guarded
 * against is a new cut path that quietly destroys a sentence, and that is invisible in review.
 *
 * **The honest limit:** this is file-granular, and `command-palette.tsx` holds one site of each kind.
 * A scan cannot tell them apart without parsing, and parsing to distinguish two call sites in one
 * file would be more machinery than the risk warrants. What it does catch is a whole new surface.
 */

const SRC = fileURLToPath(new URL("..", import.meta.url));

/**
 * Acts on a connector the pointer selected, so the label is already on screen.
 *
 * Listed by name rather than detected, because "is the thing visible" is a fact about the gesture
 * and not about the source. Adding to this list should require saying why out loud.
 */
const VISIBLE_SELECTION_SITES = new Set(["connector-hotkeys.ts"]);

/** Every `.ts`/`.tsx` under `src`, tests excluded — a test naming the verb is not a cut path. */
const sourceFiles = (directory: string): readonly string[] =>
  readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const path = `${directory}/${entry.name}`;

    if (entry.isDirectory()) {
      return sourceFiles(path);
    }

    return /\.tsx?$/.test(entry.name) && !entry.name.includes(".test.") ? [path] : [];
  });

test("every surface that cuts an edge has reasoned about what the cut destroys", () => {
  const cutting = sourceFiles(SRC).filter((path) => {
    const source = readFileSync(path, "utf8");

    // The import alone is not a cut path; a call is.
    return /\bdisconnectItems\s*\(/.test(source);
  });

  // Guards the guard: a rename that made the pattern miss would leave this silently passing.
  expect(cutting.length).toBeGreaterThanOrEqual(4);

  const unreasoned = cutting.filter((path) => {
    const name = path.split("/").pop() ?? "";

    if (VISIBLE_SELECTION_SITES.has(name)) {
      return false;
    }

    // `getRelationLabel` is the claim test every other surface shares — the same one the connector
    // draws by. Referencing it is the evidence that this site asked what would be lost.
    return !readFileSync(path, "utf8").includes("getRelationLabel");
  });

  expect(
    unreasoned.map((path) => path.slice(SRC.length)),
    "these cut an edge without asking what it claimed",
  ).toStrictEqual([]);
});
