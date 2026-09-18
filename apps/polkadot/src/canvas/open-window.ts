import {
  createInfiniteCanvasWindow,
  DEFAULT_INFINITE_CANVAS_DETAIL_POLICY,
  type InfiniteCanvasDispatch,
  type InfiniteCanvasRect,
  type InfiniteCanvasState,
} from "@hyphened/infinite-canvas";

import { showsContentItem } from "./content-window-data";
import type { WindowData, WindowKind } from "./window-registry";

type WindowSize = Readonly<{ height: number; width: number }>;

type WindowPlacement = Readonly<{
  dispatch: InfiniteCanvasDispatch<WindowKind>;
  state: InfiniteCanvasState<WindowKind>;
}>;

const WINDOW_GAP = 24;

/*
 * The floor for any kind that renders a summary.
 *
 * Detail restores only above `fullAbovePx`, so a kind whose minimum sits at or below it enters
 * summary and cannot leave at 100% zoom. Nothing reports that: the window keeps working and simply
 * never shows its body again.
 *
 * Derived rather than written down, so the floor follows the policy if the policy moves.
 */
const SUMMARY_MINIMUM_SHORT_AXIS = DEFAULT_INFINITE_CANVAS_DETAIL_POLICY.fullAbovePx + 1;

/** Raises a minimum size to the floor a summary needs, and leaves a larger one alone. */
const withSummaryMinimum = (size: WindowSize): WindowSize => ({
  height: Math.max(size.height, SUMMARY_MINIMUM_SHORT_AXIS),
  width: Math.max(size.width, SUMMARY_MINIMUM_SHORT_AXIS),
});

function revealContentWindow(input: WindowPlacement & Readonly<{ itemId: string }>) {
  const existing = input.state.windows.find((window) => showsContentItem(window, input.itemId));
  if (existing === undefined) return false;
  input.dispatch({ type: "window.reveal", windowId: existing.id });
  return true;
}

function openContentWindow<Kind extends WindowKind>(
  input: WindowPlacement &
    Readonly<{
      data: WindowData[Kind];
      kind: Kind;
      minSize: WindowSize;
      /** This rectangle overrides automatic placement. */
      rect?: InfiniteCanvasRect;
      size: WindowSize;
      title: string;
    }>,
) {
  if (
    revealContentWindow({ dispatch: input.dispatch, itemId: input.data.itemId, state: input.state })
  )
    return;

  const windowId = globalThis.crypto.randomUUID();
  // Without a caller rect, the canvas places the window against its own current state.
  const rect = input.rect ?? { ...input.size, x: 0, y: 0 };

  input.dispatch({
    ...(input.rect === undefined
      ? { placement: { gapPx: WINDOW_GAP, region: "center" } as const }
      : {}),
    type: "window.open",
    window: createInfiniteCanvasWindow<WindowKind, WindowData[Kind]>({
      data: input.data,
      id: windowId,
      kind: input.kind,
      minSize: input.minSize,
      rect,
      title: input.title,
    }),
  });

  /*
   * A window the canvas placed can land outside the view, because free space is worth more than
   * staying on screen. Reveal it, so opening a note always shows the note. This is the same ending
   * as the branch above, where the note was already open.
   */
  if (input.rect === undefined) {
    input.dispatch({ type: "window.reveal", windowId });
  }
}

export { openContentWindow, revealContentWindow, SUMMARY_MINIMUM_SHORT_AXIS, withSummaryMinimum };
export type { WindowPlacement, WindowSize };
