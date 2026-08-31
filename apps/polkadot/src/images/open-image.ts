import type { InfiniteCanvasPoint, InfiniteCanvasRect } from "@hyphened/infinite-canvas";

import { CANVAS_CHROME } from "../canvas/chrome";
import { openContentWindow, type WindowPlacement, type WindowSize } from "../canvas/open-window";
import { loadProjectContent } from "../content/project-content";
import { imageGateway } from "./image-gateway";

const IMAGE_EXTENT = 360;
// Images have no LOD summary, so this size does not cross a restore threshold.
const IMAGE_MINIMUM_SIZE = { height: 96, width: 96 } as const;

// The image ratio sets the body size. The window also includes its header.
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
    // A square window can show the decode error when the probe fails.
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
  await loadProjectContent(input.projectId);
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
