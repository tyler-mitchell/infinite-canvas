import {
  createInfiniteCanvasWindow,
  getInfiniteCanvasWindowPlacementRect,
  getVisibleWorldRect,
  type InfiniteCanvasCommands,
  type InfiniteCanvasRect,
  type InfiniteCanvasState,
} from "@hyphened/infinite-canvas";

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

/**
 * The centred, cascading rect a window gets when nobody said where to put it.
 *
 * The cascade is what keeps a run of openings from stacking into one silhouette, and it is only
 * right for openings the user did not aim: a drop landed somewhere on purpose, and nudging it 28px
 * because it happens to be the fourth window would move it away from the pointer that placed it.
 */
function getCascadedRect(
  input: WindowPlacement & Readonly<{ minSize: WindowSize; size: WindowSize }>,
) {
  const ordinal = input.state.windows.length + 1;
  const offset = ((ordinal - 1) % 6) * 28;
  const baseRect = getInfiniteCanvasWindowPlacementRect(
    getVisibleWorldRect(input.state.camera, input.state.viewport, 0),
    "center",
    input.size,
    input.minSize,
  );

  return { ...baseRect, x: baseRect.x + offset, y: baseRect.y + offset };
}

/**
 * Whether a window is already showing this content item.
 *
 * A structural read rather than the registry's ArkType schema, and deliberately so: importing
 * `ContentWindowData` here would close a cycle, since the registry reaches for every kind's body
 * and those bodies reach back for this opener. The shape being asked about is one field, and the
 * guard is the whole of the check rather than a cast buried in a comparison.
 */
const showsItem = (data: unknown, itemId: string) =>
  typeof data === "object" &&
  data !== null &&
  (data as Readonly<{ itemId?: unknown }>).itemId === itemId;

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
  const existing = input.state.windows.find((window) => showsItem(window.data, input.data.itemId));

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
      rect: input.rect ?? getCascadedRect(input),
      title: input.title,
    }),
  );
}

export { openContentWindow };
export type { WindowPlacement, WindowSize };
