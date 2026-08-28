import type { InfiniteCanvasHotkeyAction, InfiniteCanvasState } from "@hyphened/infinite-canvas";

import { disconnectRelations, relations$ } from "../relations/relation-store";
import { getSelectedRelations } from "./connector-geometry";
import type { WindowKind } from "./window-registry";

/**
 * Cutting a connector with the key everyone already reaches for.
 *
 * Selecting a connector has been the framework's job since the edge resolver landed — clicking one
 * runs through the same selection machinery that selects a window. Removing it was the palette's
 * only, which means the shortest route to undoing a line you just drew was `Mod+K`, a search, and a
 * row. Nobody does that; they press Backspace and conclude the edge cannot be removed.
 *
 * The chord itself is the framework's to police, which is why this is an `InfiniteCanvasHotkeyAction`
 * rather than a listener on `window`. Backspace inside a note body must reach Lexical and delete a
 * character, and the framework's command-surface scoping already answers that — a raw listener would
 * have had to restate the exclusion list, and would have got it wrong the first time an editor
 * appeared somewhere new.
 *
 * All that is Polkadot's here is the policy: what a connector is, what removing one means, and that
 * with nothing selected the key does nothing.
 */

const getRelationsToCut = (state: InfiniteCanvasState<WindowKind>) =>
  getSelectedRelations(state.selection, relations$.peek());

/**
 * `peek` rather than a subscription, throughout.
 *
 * These run inside a keypress, where the current value is the only thing that matters and a
 * re-render is not — the same bargain the edge resolver strikes for pointer events.
 */
function getConnectorHotkeyActions(
  projectId: string,
): readonly InfiniteCanvasHotkeyAction<WindowKind>[] {
  return [
    {
      description: "Remove the selected connections between notes.",
      // Both, because a Mac keyboard's Delete key sends Backspace and a full keyboard's sends
      // Delete, and the user pressing either means the same thing by it.
      hotkeys: ["Backspace", "Delete"],
      id: "connection.cut",
      isEnabled: (state) => getRelationsToCut(state).length > 0,
      label: "Cut Connection",
      // One act, so cutting several offers one undo that restores all of them rather than the last.
      run: (state) => {
        void disconnectRelations({ projectId, relations: getRelationsToCut(state) });
      },
    },
  ];
}

export { getConnectorHotkeyActions };
