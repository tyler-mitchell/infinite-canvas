import {
  createInfiniteCanvasWindow,
  getInfiniteCanvasContentWorldRect,
  getInfiniteCanvasOccluderWorldRects,
  getInfiniteCanvasVacantRect,
  getInfiniteCanvasWindowPlacementRect,
  isInfiniteCanvasWindowInActiveWorkspace,
  type InfiniteCanvasCommands,
  type InfiniteCanvasRect,
  type InfiniteCanvasState,
} from "@hyphened/infinite-canvas";

import { showsContentItem } from "./content-window-data";
import type { WindowData, WindowKind } from "./window-registry";

/**
 * Put a window on the canvas, in the middle of what the user is looking at.
 *
 * Placement is the part that drifts when each kind works it out again, and none of it is about what
 * the window contains: where the camera is pointing, how far to cascade so a run of openings does
 * not stack into one silhouette, and how to keep the result inside the visible world. A kind
 * supplies the three things that are genuinely its own — its size, its data, and its name.
 */

type WindowSize = Readonly<{ height: number; width: number }>;

type WindowPlacement = Readonly<{
  actions: InfiniteCanvasCommands<WindowKind>;
  state: InfiniteCanvasState<WindowKind>;
}>;

/** Room enough to read one window as separate from the next, rather than merely not overlapping. */
const WINDOW_GAP = 24;

/**
 * The rect a window gets when nobody said where to put it: the middle of the view, moved to the
 * nearest free spot if something is already there.
 *
 * **This used to cascade, and a cascade is a bounded desktop's answer.** Offsetting each opening
 * 28px from the last is right where space is scarce and a neat pile is honest. Here space is the
 * one thing there is no shortage of, and the result was a 92% overlap on the second note and a
 * wrap back onto the first on the seventh — watched, not reasoned: two notes fitted to 123% sat
 * almost exactly on top of each other.
 *
 * The deeper flaw was that it counted rather than looked. The offset came from how many windows
 * existed, never from where they were, so opening into a corner the user had already filled
 * overlapped regardless of the empty canvas beside it.
 *
 * The policy is still this app's — a new window wants the middle of what you are looking at — and
 * `getInfiniteCanvasVacantRect` only answers whether that spot is free and which nearby one is.
 * Aimed openings still bypass this entirely: a drop landed somewhere on purpose, and moving it
 * because a window happens to be there would take it away from the pointer that placed it.
 */
function getPlacedRect(
  input: WindowPlacement & Readonly<{ minSize: WindowSize; size: WindowSize }>,
) {
  /*
   * The part of the world this app's own chrome is not sitting on — not the whole visible rect.
   *
   * A window is as hidden behind the library rail as behind another window, and the rail is not an
   * occupant: it is screen-space furniture, so what it leaves is the complement of a band. Every
   * such band is already declared through `viewportInsets`, and every camera verb already respects
   * them; placement was the surface still asking the wider question.
   *
   * The centre rarely lands under the rail on its own, which is why this survived. The *search*
   * does: `getInfiniteCanvasVacantRect` steps cells across whatever bounds it is given, so with the
   * full visible rect the leftmost column starts at the viewport edge, behind the rail. Open onto a
   * busy middle and the nearest free cell is one nobody can see — the note opens, the canvas looks
   * unchanged, and the rail is covering it.
   *
   * Same rule the connector anchor already follows, and the same rule the rest of this app learned
   * once: a derived view has to ask the question the verb asks.
   */
  const bounds = getInfiniteCanvasContentWorldRect(
    input.state.camera,
    input.state.viewport,
    input.state.viewportInsets,
  );

  return getInfiniteCanvasVacantRect({
    bounds,
    gapPx: WINDOW_GAP,
    occupied: [
      /*
       * The app's own floating chrome, as occupants rather than as an edge.
       *
       * The minimap is a corner, and `bounds` above is derived from insets — one number per edge,
       * so it can only describe a band. Declaring the map as a band reserved a full-width strip
       * nothing was covering; declaring it here is the other half of that trade, and the reason
       * the strip could be given back. A window is as hidden behind the map as behind another
       * window, which is exactly what an occupant means.
       */
      ...getInfiniteCanvasOccluderWorldRects(
        input.state.camera,
        input.state.viewport,
        input.state.viewportOccluders,
      ),
      /*
       * The shells, because a group takes up more room than its members do.
       *
       * A member's rect is the pane it was solved into, and the strip, the seams and the border
       * are none of them — so the band a tab strip occupies was invisible here and a new window
       * could open across it. The shell is the honest extent of a group.
       */
      ...input.state.groups.map((group) => group.rect),
      /*
       * Minimized windows are in the dock rather than on the canvas, so the space they would occupy
       * is free — placing around them would leave a hole nobody can see the reason for.
       *
       * That reason is not about minimizing. It is about whether the window is *there*, and a
       * window on another desktop is not there either: `state.windows` is every window on the
       * canvas rather than every window on the desktop being looked at, so this reserved space on
       * behalf of windows the user cannot see and left exactly the unexplained hole the line above
       * exists to prevent. Found by the guard in `window-visibility-reads.test.ts`.
       *
       * Windows hidden behind a tab need no filter here and would be wrong to add one for: their
       * rect is the pane inside a shell, and the shell's own rect is already in this list above.
       */
      ...input.state.windows
        .filter(
          (window) =>
            window.mode !== "minimized" &&
            isInfiniteCanvasWindowInActiveWorkspace(input.state, window.id),
        )
        .map((window) => window.rect),
    ],
    preferred: getInfiniteCanvasWindowPlacementRect(bounds, "center", input.size, input.minSize),
  });
}

function openContentWindow<Kind extends WindowKind>(
  input: WindowPlacement &
    Readonly<{
      data: WindowData[Kind];
      kind: Kind;
      minSize: WindowSize;
      /** Where it lands, when the caller knows — a drop, for one. Cascaded from the camera if not. */
      rect?: InfiniteCanvasRect;
      size: WindowSize;
      title: string;
    }>,
) {
  /*
   * Already open means go there, not open it twice.
   *
   * The library rail has always done this — it reveals when the note has a window and opens when it
   * does not — but it did it *itself*, so the rule lived in one caller rather than in the opening.
   * The moment a second surface opened items, collections, that surface did not have it: clicking a
   * collection row for a note already on the canvas made a second window bound to the same record.
   * Two windows on one note is not a feature this app offers; it is the state where editing in one
   * and reading the other looks like the save failed.
   *
   * So the rule lives where the opening does, and every caller gets it — the rail, the palette,
   * collections, and whatever opens items next. `window.reveal` rather than a bare focus, because
   * the window may be minimized or on another desktop, and revealing is the framework's one verb
   * for all of that.
   */
  const existing = input.state.windows.find((window) =>
    showsContentItem(window, input.data.itemId),
  );

  if (existing !== undefined) {
    input.actions.executeCommand({ type: "window.reveal", windowId: existing.id });

    return;
  }

  input.actions.openWindow(
    createInfiniteCanvasWindow<WindowKind, WindowData[Kind]>({
      data: input.data,
      id: globalThis.crypto.randomUUID(),
      kind: input.kind,
      minSize: input.minSize,
      rect: input.rect ?? getPlacedRect(input),
      title: input.title,
    }),
  );
}

export { openContentWindow };
export type { WindowPlacement, WindowSize };
