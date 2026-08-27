import { observable } from "@legendapp/state";

/**
 * The last thing done to this project's content that can be taken back.
 *
 * The canvas has `history.undo` and it covers the canvas: windows, groups, the camera. Nothing
 * covers the database, which is where the writing lives — archiving a note, and one day cutting a
 * connection, happen outside anything the framework's history knows about. Measured on 2026-08-27:
 * disconnecting two notes and pressing undo answers "Undo is not available right now."
 *
 * **One entry, not a stack, and that is the claim rather than a shortcut.** The need this answers is
 * "I just did that and I did not mean to", which is one step deep. A stack would raise how-deep and
 * how-long questions with no evidence behind either, and every answer would be invented — the same
 * speculative machinery that got a `restoreRelation` written and deleted earlier the same day.
 * A second reversible action replacing the first is the honest model: the older one is still
 * reachable the way it always was, through the archive list.
 *
 * **It carries its own inverse.** A record of "what happened" that a separate switch has to
 * interpret is two places that can disagree about one act; a closure that performs the reversal is
 * one. The verb that did the thing is also the only thing that knows how to undo it, which is the
 * same reason `AppAction.run` returns its own refusal rather than letting a caller guess.
 *
 * `describe` is a whole sentence rather than a noun, because the palette renders it as a row and a
 * row saying "Undo" beside the canvas's own "Undo" is two controls with one name. Naming the act —
 * "Undo archiving Quarterly notes" — is what keeps the two apart without a disambiguating label
 * neither would otherwise need.
 */

type UndoableAction = Readonly<{
  /** Reads as a palette row, so it names the act: "Undo archiving Quarterly notes". */
  describe: string;
  undo: () => Promise<void>;
}>;

const undoableAction$ = observable<UndoableAction | null>(null);

/** Offered until something replaces it or it is taken. */
const rememberUndoableAction = (action: UndoableAction) => {
  undoableAction$.set(action);
};

/**
 * Take it back, and stop offering it.
 *
 * Cleared before the reversal rather than after, so a slow database write cannot leave the row on
 * screen to be pressed twice — the second press would undo an undo, which nothing here models.
 */
const undoLastAction = async () => {
  // Held before the clear, so the reversal survives the observable being emptied under it.
  const undo = undoableAction$.peek()?.undo;

  if (undo === undefined) {
    return;
  }

  undoableAction$.set(null);
  await undo();
};

export { rememberUndoableAction, undoableAction$, undoLastAction };
export type { UndoableAction };
