import type { InfiniteCanvasPoint, InfiniteCanvasRect } from "@hyphened/infinite-canvas";

import { CANVAS_CHROME } from "../canvas/chrome";
import { openContentWindow, type WindowPlacement, type WindowSize } from "../canvas/open-window";
import { imageGateway } from "./image-gateway";

/**
 * Put a picture on the canvas.
 *
 * Where the window lands is `openContentWindow`'s. What is an image's own: reading the file, and
 * the fact that a picture arrives already knowing what shape it wants to be.
 */

/** The long edge of a newly placed picture, before its own proportions are applied. */
const IMAGE_EXTENT = 360;
/**
 * Smaller than a note's floor, and it can be.
 *
 * A note's minimum is pinned above the semantic-LOD band because a note that demotes to a summary
 * must be able to come back. An image declares no summary, so the lane never engages for one and
 * there is no trap door to clear — the floor is only about a picture staying big enough to be a
 * picture.
 */
const IMAGE_MINIMUM_SIZE = { height: 96, width: 96 } as const;

/**
 * A picture's proportions, from the picture.
 *
 * Every other window on this canvas opens at a size the app chose, because nothing about a note
 * suggests one shape over another. An image is the opposite: it has exactly one correct shape, and
 * opening a panorama in a 360×240 box would letterbox it into a stripe the moment it appeared and
 * make the first thing the user does a resize.
 *
 * Decoding rather than trusting a stored dimension. The bytes are in hand, the browser is going to
 * decode them anyway to draw the picture, and a width recorded at creation is a second copy of a
 * fact the image already carries.
 *
 * The header's height is added back, because a window's rect is the whole window and the picture
 * only gets what is under the chrome. Without it a 3:1 image opened in a 3:1 *window*, whose body
 * was 32px shorter than that — so the picture arrived already letterboxed, by exactly the amount
 * the aspect calculation existed to avoid. Read from `CANVAS_CHROME` rather than written as 32,
 * since that constant is what the frame is actually drawn from.
 */
function getImageSize(source: string): Promise<WindowSize> {
  return new Promise((resolve) => {
    const probe = new Image();

    probe.addEventListener("load", () => {
      const scale = IMAGE_EXTENT / Math.max(probe.naturalWidth, probe.naturalHeight);

      resolve({
        height:
          Math.max(IMAGE_MINIMUM_SIZE.height, Math.round(probe.naturalHeight * scale)) +
          CANVAS_CHROME.headerHeight,
        width: Math.max(IMAGE_MINIMUM_SIZE.width, Math.round(probe.naturalWidth * scale)),
      });
    });
    /*
     * A square, rather than a rejection.
     *
     * If the bytes will not decode, the window still opens and its body says the picture is
     * unreadable — which is a far better outcome than an error where a picture was expected, with
     * nothing on the canvas to select, inspect, or delete.
     */
    probe.addEventListener("error", () => {
      resolve({ height: IMAGE_EXTENT + CANVAS_CHROME.headerHeight, width: IMAGE_EXTENT });
    });
    probe.src = source;
  });
}

function readFileAsDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();

    reader.addEventListener("error", () => {
      reject(reader.error ?? new Error(`Could not read ${file.name}.`));
    });
    reader.addEventListener("load", () => {
      // `readAsDataURL` always yields a string, but `result` is typed for every read method the
      // reader has. Checked rather than coerced: `String(anArrayBuffer)` would hand the record
      // "[object ArrayBuffer]" and store it as a picture.
      if (typeof reader.result === "string") {
        resolve(reader.result);

        return;
      }

      reject(new Error(`Could not read ${file.name} as an image.`));
    });
    reader.readAsDataURL(file);
  });
}

/**
 * `at` is where a drop landed, in world coordinates.
 *
 * Only the top-left is taken from it, not the size: the framework's drop placement is computed from
 * a size guessed before the bytes were decoded, and the picture's real proportions are known by the
 * time this runs. Keeping the point and replacing the extent puts the window where the pointer let
 * go while still giving it the shape the picture asked for.
 */
async function openNewImage(
  input: WindowPlacement & Readonly<{ at?: InfiniteCanvasPoint; file: File; projectId: string }>,
) {
  const source = await readFileAsDataUrl(input.file);
  const [created, size] = await Promise.all([
    imageGateway.create({
      description: input.file.name,
      projectId: input.projectId,
      source,
    }),
    getImageSize(source),
  ]);

  openImageWindow({
    actions: input.actions,
    imageId: created.id,
    rect: input.at === undefined ? undefined : { ...size, x: input.at.x, y: input.at.y },
    size,
    state: input.state,
    title: created.title,
  });
}

function openImageWindow(
  input: WindowPlacement &
    Readonly<{
      imageId: string;
      rect?: InfiniteCanvasRect;
      size: WindowSize;
      title: string;
    }>,
) {
  openContentWindow({
    actions: input.actions,
    data: { imageId: input.imageId },
    kind: "image",
    minSize: IMAGE_MINIMUM_SIZE,
    rect: input.rect,
    size: input.size,
    state: input.state,
    title: input.title,
  });
}

export { getImageSize, openImageWindow, openNewImage };
