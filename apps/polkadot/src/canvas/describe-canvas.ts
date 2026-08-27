import {
  getInfiniteCanvasGroupProjection,
  getInfiniteCanvasGroupTitle,
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
        /*
         * The id is reported because it is the handle `window.reveal` takes, and it has to be.
         *
         * This said only `kind "title"`, on the belief — written down in `describe-content.ts` and
         * wrong — that titles distinguish open windows even though they do not distinguish stored
         * items. They do not distinguish either. Measured on a live canvas: two windows both titled
         * "Links", reported identically, and `window.reveal` took a title and revealed whichever
         * came first. A caller could see two entries and had no way to name the second one.
         *
         * Same `[id]` shape as the content listing, because it is the same act: a report you can
         * order from names its entries.
         */
        `${window.kind} "${window.title}" [${window.id}]`,
        window.id === state.activeWindowId ? "active" : null,
        selected.has(window.id) ? "selected" : null,
        hiddenWindowIds.has(window.id) ? "behind a tab" : null,
        // `normal` is the unremarkable case and saying it on every window would bury the others.
        window.mode === "normal" ? null : window.mode,
      ]
        .filter((part) => part !== null)
        .join(", "),
    );
  /*
   * Through the resolver, because a group's `title` is `null` when nobody named one.
   *
   * `null` means "named after what is in it" and `getInfiniteCanvasGroupTitle` composes that from
   * current membership. Read raw and interpolated, it produced the literal string `"null"` — a
   * template accepts it, so the typechecker had nothing to say, and the only reader affected is
   * one that cannot see the screen. Which is the whole point of this file: the described canvas is
   * the canvas, for anything reading rather than looking.
   */
  const groups = state.groups.map(
    // Handled like the windows above, and for the same reason: `group.setLayout`, `group.rename`
    // and `group.dissolve` all take a group id, and a name is not one. Two groups can carry the
    // same title as easily as two windows can — more easily, since an unnamed group is titled from
    // its members and two containers holding notes called the same thing compose the same string.
    (group) => `"${getInfiniteCanvasGroupTitle(group, state.windows)}" [${group.id}]`,
  );

  return [
    `Zoom ${Math.round(state.camera.zoom * 100)}%.`,
    windows.length === 0
      ? "No windows open."
      : `${windows.length} window(s): ${windows.join("; ")}.`,
    groups.length === 0 ? "No groups." : `${groups.length} group(s): ${groups.join(", ")}.`,
  ].join(" ");
}

export { describeCanvas };
