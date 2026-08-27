import type { InfiniteCanvasState } from "@hyphened/infinite-canvas";

import type { WindowKind } from "./window-registry";

/**
 * What is on the canvas right now, in a sentence something can read.
 *
 * The vocabulary in `app-actions` is entirely verbs: every entry changes the canvas and none
 * reports it. That is complete for a pointer, which gets its answer by looking, and half a
 * vocabulary for anything that cannot see the screen — an agent could create a note and had no
 * way to find out whether it worked, or what was already there.
 *
 * A module function rather than an `AppAction`, and the distinction is the palette: `APP_ACTIONS`
 * is rendered as rows, so an entry that only returns text would be a row that does nothing when
 * you pick it. `AGENTS.md` already allows both homes — "the command vocabulary or a module
 * function" — and this is the case that separates them. `model-context` registers it as a tool
 * beside the verbs; nothing else calls it yet.
 *
 * Deliberately not a screenshot or a DOM dump. What a caller needs to decide its next move is
 * which windows exist, what kind each is, and which one is live.
 */
function describeCanvas(state: InfiniteCanvasState<WindowKind>): string {
  const selected = new Set(state.selection.windowIds);
  const windows = state.windows.map((window) =>
    [
      `${window.kind} "${window.title}"`,
      window.id === state.activeWindowId ? "active" : null,
      selected.has(window.id) ? "selected" : null,
      // `normal` is the unremarkable case and saying it on every window would bury the others.
      window.mode === "normal" ? null : window.mode,
    ]
      .filter((part) => part !== null)
      .join(", "),
  );
  const groups = state.groups.map((group) => `"${group.title}"`);

  return [
    `Zoom ${Math.round(state.camera.zoom * 100)}%.`,
    windows.length === 0
      ? "No windows open."
      : `${windows.length} window(s): ${windows.join("; ")}.`,
    groups.length === 0 ? "No groups." : `${groups.length} group(s): ${groups.join(", ")}.`,
  ].join(" ");
}

export { describeCanvas };
