import type {
  InfiniteCanvasDropPolicy,
  InfiniteCanvasNativeDropPayload,
} from "@hyphened/infinite-canvas";

import { openNewImage } from "../images/open-image";
import { getDraggedLinkName, LINK_SIZE, openNewLink } from "../links/open-link";
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

type CanvasDropPayload = InfiniteCanvasNativeDropPayload;

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
  return payload.type === "files" && payload.types.some((type) => type.startsWith("image/"));
}

/**
 * A link drag, judged the same way and just as early.
 *
 * `text/uri-list` is the format a browser puts an address in, and it is the one this canvas takes —
 * dragged prose arrives as `text/plain` alone and is refused at the edge, because a note made from
 * a sentence someone was dragging is a guess about what they meant. The address is withheld until
 * the drop, exactly as a file's bytes are, so the type is the whole of what can be judged in
 * flight and it is enough.
 */
function isLinkDrop(payload: CanvasDropPayload) {
  return payload.type === "text" && payload.types.includes("text/uri-list");
}

function createCanvasDropPolicy(
  projectId: string,
): InfiniteCanvasDropPolicy<WindowKind, CanvasDropPayload> {
  return {
    canDrop: ({ payload }) => ({
      accepted: isImageDrop(payload) || isLinkDrop(payload),
      // Carried on the interaction while the drag is still in flight, so a `.zip` can be turned
      // away at the edge of the canvas rather than after the user has committed to it.
      reason: "Only images and links can be dropped on the canvas",
    }),
    onDrop: ({ actions, payload, placement, state, worldPoint }) => {
      /*
       * The snapped rect's corner when the framework had a placement to snap, the raw world point
       * when it did not. Either way a point rather than a rect: for a picture, its own proportions
       * are about to be decoded and they, not the guess above, decide how big the window is.
       */
      const at = placement === null ? worldPoint : { x: placement.rect.x, y: placement.rect.y };

      if (payload.type === "text") {
        /*
         * The name comes from the drag when the drag brought one. A browser dragging a tab has a
         * page title and puts it in the uri-list's comment line, which is a far better card than
         * anything derivable from the address — and when there is no comment, `null` means the URL
         * names itself.
         *
         * Every address in the list opens, because dragging a selection of links is one gesture
         * meaning all of them. They share the name only when there is one of them: a title belongs
         * to the page it came from, and stamping it on four cards would be four cards claiming to
         * be the same page.
         */
        const name = payload.uris.length === 1 ? getDraggedLinkName(payload.text) : null;

        for (const url of payload.uris) {
          void openNewLink({ actions, at, name, projectId, state, url });
        }

        return;
      }

      for (const file of payload.files.filter((candidate) => candidate.type.startsWith("image/"))) {
        void openNewImage({ actions, at, file, projectId, state });
      }
    },
    /*
     * The size the preview rectangle and the snap guides use, per kind. A link's is exact rather
     * than a guess — unlike a picture, nothing about it is decoded on landing, so where the
     * preview sits is where the card sits.
     */
    placement: ({ payload }) => {
      if (isLinkDrop(payload)) {
        return { size: LINK_SIZE };
      }

      return isImageDrop(payload) ? { size: DROPPED_IMAGE_SIZE } : null;
    },
  };
}

export { createCanvasDropPolicy, DROPPED_IMAGE_SIZE };
export type { CanvasDropPayload };
