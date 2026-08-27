import {
  getInfiniteCanvasGroupProjection,
  isInfiniteCanvasWindowInActiveWorkspace,
  type InfiniteCanvasState,
} from "@hyphened/infinite-canvas";

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
  /*
   * The two ways a window is on the canvas without being on screen, and this asked about neither.
   *
   * `mode` catches minimized and nothing else. A window behind a tab reports `mode: "normal"` and
   * carries the shell's whole content rect — measured here on a real canvas, a note and a
   * collection with byte-identical rects, of which one is drawn. A window on another desktop is
   * likewise ordinary to `state.windows`, which is every window on the canvas rather than every
   * window on the desktop you are looking at.
   *
   * Reported to a caller that cannot see the screen, both are worse than an omission: it is told
   * two things are in front of it and one of them is not. The framework answers both questions —
   * `hiddenWindowIds` and `isInfiniteCanvasWindowInActiveWorkspace` — and the connector layer,
   * the minimap, the offscreen ring and focus traversal all already ask them. This makes the same
   * mistake those made, one surface later, which is why the rule is worth restating here: a
   * derived view must ask the same question the verb asks.
   *
   * Another desktop's windows are dropped rather than labelled, because "what is on the canvas"
   * means the canvas in front of you; a tab's hidden sibling is labelled, because it is on this
   * canvas and one keystroke away.
   */
  const { hiddenWindowIds } = getInfiniteCanvasGroupProjection(state.groups, state.groupMetrics);
  const windows = state.windows
    .filter((window) => isInfiniteCanvasWindowInActiveWorkspace(state, window.id))
    .map((window) =>
      [
        `${window.kind} "${window.title}"`,
        window.id === state.activeWindowId ? "active" : null,
        selected.has(window.id) ? "selected" : null,
        hiddenWindowIds.has(window.id) ? "behind a tab" : null,
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
