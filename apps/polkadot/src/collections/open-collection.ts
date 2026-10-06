import { openContentWindow, withSummaryMinimum, type WindowPlacement } from "../canvas/open-window";
import { createProjectItem } from "../content/project-content";
import { content } from "../database/operations";
import { namingQueue } from "../naming-queue";
import { getNextRepeatTitle } from "../titles";
import { COLLECTION_KIND, collectionGateway, type CollectionQuestion } from "./collection-gateway";

const COLLECTION_SIZE = { height: 420, width: 300 } as const;
// A collection renders a summary, so its minimum cannot fall below the size detail restores from.
const COLLECTION_MINIMUM_SIZE = withSummaryMinimum({ height: 220, width: 220 });

async function openNewCollection(
  input: WindowPlacement &
    Readonly<{ projectId: string; question: CollectionQuestion; title: string }>,
) {
  const created = await namingQueue.add(async () => {
    const titles = await content.titles({ projectId: input.projectId });
    return createProjectItem({
      projectId: input.projectId,
      kind: COLLECTION_KIND,
      create: () =>
        collectionGateway.create({
          projectId: input.projectId,
          question: input.question,
          title: getNextRepeatTitle(input.title, titles),
        }),
    });
  });
  openCollectionWindow({
    dispatch: input.dispatch,
    collectionId: created.id,
    state: input.state,
    title: created.title,
  });
}

function openCollectionWindow(
  input: WindowPlacement & Readonly<{ collectionId: string; title: string }>,
) {
  openContentWindow({
    dispatch: input.dispatch,
    data: { itemId: input.collectionId },
    kind: "collection",
    minSize: COLLECTION_MINIMUM_SIZE,
    size: COLLECTION_SIZE,
    state: input.state,
    title: input.title,
  });
}

export { COLLECTION_MINIMUM_SIZE, COLLECTION_SIZE, openCollectionWindow, openNewCollection };
