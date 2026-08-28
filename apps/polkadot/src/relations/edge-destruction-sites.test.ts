import { readdirSync, readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

import { expect, test } from "vite-plus/test";

/**
 * Every place that destroys an edge has to have decided what the person loses.
 *
 * Cutting is the removal that takes something away rather than filing it. Archiving is reversible
 * and says so; a canvas gets a dialog; a project gets a typed confirmation.
 * `fn::unrelate_content_items` deletes the row, and `history.undo` is the canvas's and does not
 * reach the database.
 *
 * **`disconnectRelations` now remembers its own inverse, and that narrows this without closing it.**
 * The offer restores the ends, the kind and the label, so a cut noticed at once costs nothing. It is
 * one entry deep and the notice clears itself after eight seconds, so a cut *not* noticed still ends
 * a kind someone chose and a sentence someone typed. Naming the loss before the act is what this
 * scan is about; recovery afterwards is a second thing, not a replacement for it.
 *
 * The surfaces that cut are not equivalent, which is the whole reason this is a scan rather than a
 * blanket rule:
 *
 * - The **library rail** cuts from a list, so the person cannot see the connector. It confirms, and
 *   the dialog quotes the claim.
 * - The **palette's two-note row** acts on an edge nobody selected, possibly off screen. It names the
 *   loss in the row title, because a modal on a keyboard surface that closes on select would
 *   interrupt the one flow it exists to make fast.
 * - The **palette's cut-selected row**, the **Backspace action** and the **connector rail** act on a
 *   connector the pointer selected, with its label drawn on the line. The person is looking at what
 *   they are destroying, and a dialog there would be a confirmation for a thing already in view.
 * - **`relation-store` itself** matches, because `disconnectItems` routes through the set verb. It
 *   reads the claim to describe the undo, which is the reasoning this asks for.
 *
 * So the invariant is not "confirm everywhere". It is that a file which destroys edges has either
 * reasoned about the claim or is listed below as acting on a visible selection. A new site fails
 * this until someone classifies it, which is the point — the failure mode being guarded against is a
 * new cut path that quietly destroys a sentence, and that is invisible in review.
 *
 * **This has caught one.** The connector rail was added cutting in a `forEach` over the selection,
 * one `disconnectItems` per edge; since the undo slot holds one entry, each cut overwrote the last
 * one's offer and a multi-edge cut silently kept only the final claim. `connector-hotkeys` had the
 * same loop and is exempt here, so the scan reached it through the new file. The fix was the set
 * verb both now call.
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
 *
 * `canvas-hud.tsx` is the connector rail, which appears only when a connector is selected and cuts
 * exactly what is selected — the same gesture as Backspace, from the place the selection happened.
 * Quoting the claim in the rail would repeat the label the connector layer already draws on the
 * line beneath it.
 *
 * This exempts the whole file, and the file holds every HUD surface. A future cut added to it for a
 * different gesture would pass unexamined; that is the file-granular limit stated above, accepted
 * here for the same reason it is accepted for the palette.
 */
const VISIBLE_SELECTION_SITES = new Set(["canvas-hud.tsx", "connector-hotkeys.ts"]);

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

    // The import alone is not a cut path; a call is. Both verbs, because the set verb is the one a
    // surface cutting a selection calls and a pattern naming only the pair verb would miss it.
    return /\bdisconnect(?:Items|Relations)\s*\(/.test(source);
  });

  // Guards the guard: a rename that made the pattern miss would leave this silently passing.
  expect(cutting.length).toBeGreaterThanOrEqual(5);

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
