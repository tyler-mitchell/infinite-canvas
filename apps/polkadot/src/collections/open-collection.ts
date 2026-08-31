import { openContentWindow, type WindowPlacement } from "../canvas/open-window";
import { loadProjectContent } from "../content/project-content";
import { content } from "../database/operations";
import { withNamingLock } from "../naming-lock";
import { getNextRepeatTitle } from "../titles";
import { collectionGateway, type CollectionQuestion } from "./collection-gateway";

const COLLECTION_SIZE = { height: 420, width: 300 } as const;
// This size is greater than the LOD restore threshold.
const COLLECTION_MINIMUM_SIZE = { height: 220, width: 220 } as const;

const getNextCollectionTitle = (label: string, titles: readonly string[]) =>
  getNextRepeatTitle(label, titles);

async function openNewCollection(
  input: WindowPlacement &
    Readonly<{ projectId: string; question: CollectionQuestion; title: string }>,
) {
  // Serialize title selection to prevent duplicate names.
  return withNamingLock(async () => {
    const [offered, archived] = await Promise.all([
      content.list({ projectId: input.projectId }),
      content.listArchived({ projectId: input.projectId }),
    ]);
    const created = await collectionGateway.create({
      projectId: input.projectId,
      question: input.question,
      title: getNextCollectionTitle(
        input.title,
        [...offered, ...archived].map((item) => item.title),
      ),
    });

    openCollectionWindow({
      actions: input.actions,
      collectionId: created.id,
      state: input.state,
      title: created.title,
    });
    await loadProjectContent(input.projectId);
  });
}

function openCollectionWindow(
  input: WindowPlacement & Readonly<{ collectionId: string; title: string }>,
) {
  openContentWindow({
    actions: input.actions,
    data: { itemId: input.collectionId },
    kind: "collection",
    minSize: COLLECTION_MINIMUM_SIZE,
    size: COLLECTION_SIZE,
    state: input.state,
    title: input.title,
  });
}

export {
  COLLECTION_MINIMUM_SIZE,
  COLLECTION_SIZE,
  getNextCollectionTitle,
  openCollectionWindow,
  openNewCollection,
};
