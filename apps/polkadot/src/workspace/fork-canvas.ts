import type { InfiniteCanvasDocument } from "@hyphened/infinite-canvas";

import type { WindowKind } from "../canvas/window-registry";
import * as database from "../database/operations";
import { namingQueue } from "../naming-queue";
import { getNextSuffixedTitle } from "../titles";

async function forkCanvas(
  input: Readonly<{
    canvasTitle: string;
    /** The snapshot uses the same serializer as persistence. */
    layout: InfiniteCanvasDocument<WindowKind>;
    projectId: string;
  }>,
) {
  return namingQueue.add(async () => {
    const titles = await database.canvases.titles(input.projectId);

    return database.canvases.create({
      layout: input.layout,
      projectId: input.projectId,
      title: getNextSuffixedTitle({
        mark: "(recovered)",
        title: input.canvasTitle,
        takenTitles: titles,
      }),
    });
  });
}

export { forkCanvas };
