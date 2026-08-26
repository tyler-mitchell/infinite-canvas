import type {
  InfiniteCanvasDropPolicy,
  InfiniteCanvasFileDropPayload,
} from "@hyphened/infinite-canvas";

import { openNewImage } from "../images/open-image";
import type { WindowKind } from "./window-registry";

/**
 * What this canvas accepts from outside the page.
 *
 * The framework does the whole drag: it hears the native events, resolves the world point, snaps
 * the landing rect against the windows already there, and draws the guides. What is left here is
 * the only part that is Polkadot's — which files mean something, and what to make of one.
 *
 * Nobody starts an OS file drag, so the payload is the framework's rather than this app's; the
 * canvas widens its own payload type to admit it and narrows on the tag.
 */

type CanvasDropPayload = InfiniteCanvasFileDropPayload;

/**
 * The size a dropped picture is *assumed* to be while it is still in flight.
 *
 * A guess, unavoidably: the bytes are withheld until the drop, so nothing can decode the image to
 * ask its proportions while the preview needs drawing. It is what the snap guides align and what
 * the preview rectangle shows, and the moment the file actually lands its real shape replaces the
 * extent — the drop point is kept, the guess is not.
 */
const DROPPED_IMAGE_SIZE = { height: 240, width: 360 } as const;

function isImageDrop(payload: CanvasDropPayload) {
  /*
   * Judged on `types`, which is all a drag will say before it lands.
   *
   * `some` rather than `every`: dragging three files where one is a picture should light the canvas
   * up for that one, not refuse the whole gesture. The drop handler filters again, so the files
   * that were not images are simply not opened.
   */
  return payload.types.some((type) => type.startsWith("image/"));
}

function createCanvasDropPolicy(
  projectId: string,
): InfiniteCanvasDropPolicy<WindowKind, CanvasDropPayload> {
  return {
    canDrop: ({ payload }) => ({
      accepted: isImageDrop(payload),
      // Carried on the interaction while the drag is still in flight, so a `.zip` can be turned
      // away at the edge of the canvas rather than after the user has committed to it.
      reason: "Only images can be dropped on the canvas",
    }),
    onDrop: ({ actions, payload, placement, state, worldPoint }) => {
      /*
       * The snapped rect's corner when the framework had a placement to snap, the raw world point
       * when it did not. Either way a point rather than a rect: the picture's own proportions are
       * about to be decoded and they, not the guess above, decide how big the window is.
       */
      const at = placement === null ? worldPoint : { x: placement.rect.x, y: placement.rect.y };

      for (const file of payload.files.filter((candidate) => candidate.type.startsWith("image/"))) {
        void openNewImage({ actions, at, file, projectId, state });
      }
    },
    placement: ({ payload }) => (isImageDrop(payload) ? { size: DROPPED_IMAGE_SIZE } : null),
  };
}

export { createCanvasDropPolicy, DROPPED_IMAGE_SIZE };
export type { CanvasDropPayload };
