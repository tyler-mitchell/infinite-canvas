import type { InfiniteCanvasSerializedState } from "@hyphened/infinite-canvas";

import type { WindowKind } from "../canvas/window-registry";
import * as database from "../database/operations";
import { withNamingLock } from "../naming-lock";
import { getNextSuffixedTitle } from "../titles";

function getForkedCanvasTitle(canvasTitle: string, takenTitles: readonly string[]): string {
  return getNextSuffixedTitle({ mark: "(recovered)", takenTitles, title: canvasTitle });
}

async function forkCanvas(
  input: Readonly<{
    canvasTitle: string;
    /** The snapshot uses the same serializer as persistence. */
    layout: InfiniteCanvasSerializedState<WindowKind>;
    projectId: string;
  }>,
) {
  // The naming lock prevents concurrent forks from choosing the same title.
  return withNamingLock(async () => {
    const [offered, archived] = await Promise.all([
      database.canvases.list(input.projectId),
      database.canvases.listArchived(input.projectId),
    ]);

    return database.canvases.create({
      layout: input.layout,
      projectId: input.projectId,
      title: getForkedCanvasTitle(
        input.canvasTitle,
        [...offered, ...archived].map((canvas) => canvas.title),
      ),
    });
  });
}

export { forkCanvas, getForkedCanvasTitle };
