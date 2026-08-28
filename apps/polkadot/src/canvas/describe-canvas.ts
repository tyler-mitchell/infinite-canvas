import {
  getInfiniteCanvasGroupProjection,
  getInfiniteCanvasGroupTitle,
  getInfiniteCanvasGroupWindowIds,
  getSelectionTargets,
  isInfiniteCanvasWindowInActiveWorkspace,
  isWorldRectWithinViewport,
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
        /*
         * The fourth way a window is on the canvas without being on screen, and the comment above
         * counted three.
         *
         * Minimized, behind a tab and on another desktop are all *states*. This one is the camera:
         * a window can be admitted, normal and unhidden and still be a mile off the edge, and the
         * report said "3 window(s)" with no hint that none of them was in front of you. A caller
         * that cannot see the screen has then no reason to call `window.reveal`, which exists for
         * precisely this and takes the id reported two lines up.
         *
         * `isWorldRectWithinViewport` is the framework's own frustum test — the same predicate the
         * offscreen ring draws its chips from, so the sentence and the arrows cannot disagree.
         * Reported last because it is the most transient: it changes with every pan, where the
         * others change only when somebody acts.
         */
        isWorldRectWithinViewport(state.camera, state.viewport, window.rect) ? null : "offscreen",
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
  /*
   * What each group holds, which the group list did not say.
   *
   * Read back as a caller receives it, the two lists did not meet: twelve windows, three groups, and
   * nothing joining them. That is not just untidy — it makes the group verbs unusable on purpose.
   * `group.setLayout` does nothing to a group holding one window, correctly and by the framework's
   * own reckoning, and on this canvas two of the three hold exactly one. A caller could only find
   * that out by trying it and watching nothing happen.
   *
   * Members are named by handle rather than by title, because the titles are already in the window
   * list above and repeating them would double the report's length to say nothing new — and because
   * two of the windows here are both called "Links", so a title would not have said which.
   */
  const groups = state.groups.map((group) => {
    // Handled like the windows above, and for the same reason: `group.setLayout`, `group.rename`
    // and `group.dissolve` all take a group id, and a name is not one. Two groups can carry the
    // same title as easily as two windows can — more easily, since an unnamed group is titled from
    // its members and two containers holding notes called the same thing compose the same string.
    const members = getInfiniteCanvasGroupWindowIds(group.tree);

    return `"${getInfiniteCanvasGroupTitle(group, state.windows)}" [${group.id}] holding ${members.map((windowId) => `[${windowId}]`).join(", ")}`;
  });

  /*
   * That other desktops exist at all, which this did not say.
   *
   * The window list is filtered to the active desktop, and that filtering is right — "what is on
   * the canvas" means the one in front of you. Saying nothing about the rest is not: a caller was
   * shown a partial canvas described as the whole of it, with no way to learn otherwise and no
   * reason to ask. An omission a reader cannot detect is worse than a longer sentence.
   *
   * Only mentioned when there are any. `state.workspaces` is empty until somebody makes a desktop,
   * and "0 desktops" would invent a concept for every canvas that has never used one — the same
   * reason the framework treats no-workspaces as "everything is visible" rather than as a desktop.
   */
  const desktops = state.workspaces.map(
    (workspace) =>
      `"${workspace.title}" [${workspace.id}]${workspace.id === state.activeWorkspaceId ? " (current)" : ""}`,
  );

  /*
   * That a connection is selected, which the report did not say and its own tool description
   * promised.
   *
   * `canvas.describe` is registered as "zoom, the open windows and their kinds, groups, and the
   * selection", and the selection it described was the window half only. A connector fills
   * `selection.targets` and leaves `windowIds` empty, so a caller reading this was told nothing is
   * selected while one was — highlighted on screen, with a rail attached to it.
   *
   * Counted rather than named, and the split is deliberate. `describeRelations` states why a
   * connection belongs in the content report: an edge joins two *records* and outlives both
   * windows, so describing one here would describe it by its drawing. Which connection it is
   * belongs there, and that report marks it; that one is selected is a fact about this canvas.
   */
  const selectedConnections = getSelectionTargets(state.selection).filter(
    (target) => target.type === "edge",
  ).length;

  return [
    `Zoom ${Math.round(state.camera.zoom * 100)}%.`,
    desktops.length === 0
      ? null
      : `${desktops.length} desktop(s), showing only the current one's windows: ${desktops.join(", ")}.`,
    windows.length === 0
      ? "No windows open."
      : `${windows.length} window(s): ${windows.join("; ")}.`,
    groups.length === 0 ? "No groups." : `${groups.length} group(s): ${groups.join(", ")}.`,
    // Only when there are any, for the reason the desktop line is: naming a concept on every canvas
    // that has never used one teaches it as a thing to think about.
    selectedConnections === 0
      ? null
      : `${selectedConnections} connection(s) selected; content.list names them.`,
  ]
    .filter((sentence) => sentence !== null)
    .join(" ");
}

export { describeCanvas };
