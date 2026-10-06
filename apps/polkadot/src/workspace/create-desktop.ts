import type { InfiniteCanvasDispatch } from "@hyphened/infinite-canvas/legacy";

import type { WindowKind } from "../canvas/window-registry";
import { getNextNumberedTitle } from "../titles";

// Default titles use the names that already exist.
function createDesktop(
  input: Readonly<{
    dispatch: InfiniteCanvasDispatch<WindowKind>;
    existingTitles: readonly string[];
    title?: string;
  }>,
): string {
  const workspaceId = globalThis.crypto.randomUUID();
  const chosen = input.title?.trim();

  input.dispatch({
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
