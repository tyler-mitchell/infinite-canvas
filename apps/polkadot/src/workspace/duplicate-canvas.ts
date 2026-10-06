import * as database from "../database/operations";
import { namingQueue } from "../naming-queue";
import { getNextSuffixedTitle } from "../titles";

// Active and archived names participate in default copy naming.
async function duplicateCanvas(
  input: Readonly<{ canvasId: string; canvasTitle: string; projectId: string }>,
) {
  return namingQueue.add(async () => {
    const titles = await database.canvases.titles(input.projectId);

    return database.canvases.duplicate({
      canvasId: input.canvasId,
      title: getNextSuffixedTitle({
        mark: "copy",
        title: input.canvasTitle,
        takenTitles: titles,
      }),
    });
  });
}

export { duplicateCanvas };
