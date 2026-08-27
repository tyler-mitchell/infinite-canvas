import type { InfiniteCanvasCommands } from "@hyphened/infinite-canvas";

import type { WindowKind } from "../canvas/window-registry";
import { getNextNumberedTitle } from "../titles";

/**
 * Make a desktop, named after the ones that already exist.
 *
 * Both surfaces that offered a new desktop — the switcher and the palette — wrote
 * `Desktop ${workspaces.length + 1}` inline, which is the same duplicated expression
 * `create-canvas.ts` was written to remove for canvases, and wrong the same two ways.
 *
 * A count is not a fact about which names are taken. Close "Desktop 2" of three and the next one
 * is called "Desktop 3" while a "Desktop 3" is still open, so two desktops answer to one name — and
 * a desktop is a thing you switch to *by name*, which is the case where that hurts most.
 * `getNextNumberedTitle` reads the highest ordinal actually spoken for.
 *
 * It is a module function rather than only a control's handler because a capability has to be
 * reachable by something that cannot click. `workspace.create` calls this, the switcher calls this,
 * and the palette calls this, so the naming rule is one decision instead of a coincidence between
 * three copies.
 */
function createDesktop(
  input: Readonly<{
    actions: InfiniteCanvasCommands<WindowKind>;
    /**
     * The names already taken, rather than the whole state.
     *
     * Naming needs exactly this, and the two controls that call it hold a workspace selector rather
     * than a state — asking for more than the rule reads would make them reach for it.
     */
    existingTitles: readonly string[];
    /** A name somebody chose. Absent means number it after the desktops that exist. */
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

  // Returned so a caller can enter the desktop it just made without having to look for it by name.
  return workspaceId;
}

export { createDesktop };
