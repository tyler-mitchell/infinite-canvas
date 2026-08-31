import type { InfiniteCanvasCommands } from "@hyphened/infinite-canvas";

import type { WindowKind } from "../canvas/window-registry";
import { getNextNumberedTitle } from "../titles";

// Default titles use the names that already exist.
function createDesktop(
  input: Readonly<{
    actions: InfiniteCanvasCommands<WindowKind>;
    existingTitles: readonly string[];
    title?: string;
  }>,
): string {
  const workspaceId = globalThis.crypto.randomUUID();
  const chosen = input.title?.trim();

  input.actions.executeCommand({
    title:
      chosen === undefined || chosen === ""
        ? getNextNumberedTitle("Desktop", input.existingTitles)
        : chosen,
    type: "workspace.create",
    workspaceId,
  });

  return workspaceId;
}

export { createDesktop };
