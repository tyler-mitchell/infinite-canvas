import type {
  InfiniteCanvasDropPolicy,
  InfiniteCanvasNativeDropPayload,
} from "@hyphened/infinite-canvas/legacy";

import { openNewImage } from "../images/open-image";
import { getDraggedLinkName, LINK_SIZE, openNewLink } from "../links/open-link";
import type { WindowKind } from "./window-registry";

type CanvasDropPayload = InfiniteCanvasNativeDropPayload;

// The browser withholds image bytes until the drop, so the preview uses this size.
const DROPPED_IMAGE_SIZE = { height: 240, width: 360 } as const;

// Drag payloads expose MIME types before they expose contents.
function isImageDrop(payload: CanvasDropPayload) {
  return payload.type === "files" && payload.types.some((type) => type.startsWith("image/"));
}

function isLinkDrop(payload: CanvasDropPayload) {
  return payload.type === "text" && payload.types.includes("text/uri-list");
}

function createCanvasDropPolicy(
  projectId: string,
): InfiniteCanvasDropPolicy<WindowKind, CanvasDropPayload> {
  return {
    canDrop: ({ payload }) => ({
      accepted: isImageDrop(payload) || isLinkDrop(payload),
      reason: "Only images and links can be dropped on the canvas",
    }),
    onDrop: ({ dispatch, payload, placement, state, worldPoint }) => {
      const at = placement === null ? worldPoint : { x: placement.rect.x, y: placement.rect.y };

      if (payload.type === "text") {
        const name = payload.uris.length === 1 ? getDraggedLinkName(payload.text) : null;

        for (const url of payload.uris) {
          void openNewLink({ at, dispatch, name, projectId, state, url });
        }

        return;
      }

      for (const file of payload.files.filter((candidate) => candidate.type.startsWith("image/"))) {
        void openNewImage({ at, dispatch, file, projectId, state });
      }
    },
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
