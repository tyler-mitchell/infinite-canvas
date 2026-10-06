import type { InfiniteCanvasPoint, InfiniteCanvasRect } from "@hyphened/infinite-canvas/legacy";

import { CANVAS_CHROME } from "../canvas/chrome";
import { openContentWindow, type WindowPlacement, type WindowSize } from "../canvas/open-window";
import { createProjectItem } from "../content/project-content";
import { IMAGE_KIND, imageGateway } from "./image-gateway";

const IMAGE_EXTENT = 360;
// Images have no LOD summary, so this size does not cross a restore threshold.
const IMAGE_MINIMUM_SIZE = { height: 96, width: 96 } as const;

// The image ratio sets the body size. The window also includes its header.
async function getImageSize(source: string): Promise<WindowSize> {
  const probe = new Image();
  probe.src = source;
  try {
    await probe.decode();
    const extent = Math.max(probe.naturalWidth, probe.naturalHeight);
    if (extent > 0) {
      const scale = IMAGE_EXTENT / extent;
      return {
        height:
          Math.max(IMAGE_MINIMUM_SIZE.height, Math.round(probe.naturalHeight * scale)) +
          CANVAS_CHROME.headerHeight,
        width: Math.max(IMAGE_MINIMUM_SIZE.width, Math.round(probe.naturalWidth * scale)),
      };
    }
    console.warn("Image dimensions are empty; using a square window.");
  } catch (error) {
    console.warn("Could not decode image dimensions; using a square window.", error);
  }
  return { height: IMAGE_EXTENT + CANVAS_CHROME.headerHeight, width: IMAGE_EXTENT };
}

function readFileAsDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();

    reader.addEventListener("error", () => {
      reject(reader.error ?? new Error(`Could not read ${file.name}.`));
    });
    reader.addEventListener("load", () => {
      // readAsDataURL returns a string, but FileReader.result also permits ArrayBuffer.
      if (typeof reader.result === "string") {
        resolve(reader.result);

        return;
      }

      reject(new Error(`Could not read ${file.name} as an image.`));
    });
    reader.readAsDataURL(file);
  });
}

// A drop supplies the origin. Decoded image dimensions supply the size.
async function openNewImage(
  input: WindowPlacement & Readonly<{ at?: InfiniteCanvasPoint; file: File; projectId: string }>,
) {
  const source = await readFileAsDataUrl(input.file);
  const [created, size] = await Promise.all([
    createProjectItem({
      projectId: input.projectId,
      kind: IMAGE_KIND,
      create: () =>
        imageGateway.create({
          description: input.file.name,
          projectId: input.projectId,
          source,
        }),
    }),
    getImageSize(source),
  ]);

  openImageWindow({
    dispatch: input.dispatch,
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
    dispatch: input.dispatch,
    data: { itemId: input.imageId },
    kind: "image",
    minSize: IMAGE_MINIMUM_SIZE,
    rect: input.rect,
    size: input.size,
    state: input.state,
    title: input.title,
  });
}

export { getImageSize, openImageWindow, openNewImage };
