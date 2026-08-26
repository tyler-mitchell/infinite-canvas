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
