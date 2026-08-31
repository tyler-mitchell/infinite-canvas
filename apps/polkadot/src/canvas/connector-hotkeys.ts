import type { InfiniteCanvasHotkeyAction, InfiniteCanvasState } from "@hyphened/infinite-canvas";

import { disconnectRelations, relations$ } from "../relations/relation-store";
import { getSelectedRelations } from "./connector-geometry";
import type { WindowKind } from "./window-registry";

const getRelationsToCut = (state: InfiniteCanvasState<WindowKind>) =>
  getSelectedRelations(state.selection, relations$.peek());

// Framework hotkey scope keeps editor keystrokes local.
function getConnectorHotkeyActions(
  projectId: string,
): readonly InfiniteCanvasHotkeyAction<WindowKind>[] {
  return [
    {
      description: "Remove the selected connections between notes.",
      hotkeys: ["Backspace", "Delete"],
      id: "connection.cut",
      isEnabled: (state) => getRelationsToCut(state).length > 0,
      label: "Cut Connection",
      // Return the write promise so tool calls wait for storage.
      run: (state) => disconnectRelations({ projectId, relations: getRelationsToCut(state) }),
    },
  ];
}

export { getConnectorHotkeyActions };
