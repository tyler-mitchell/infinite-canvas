import { openContentWindow, type WindowPlacement } from "../canvas/open-window";
import { content } from "../database/operations";
import { getNextRepeatTitle } from "../titles";
import { collectionGateway, type CollectionQuestion } from "./collection-gateway";

/**
 * Put a collection on the canvas.
 *
 * Taller than it is wide, unlike every other kind here, because a list is read down. A note opens
 * landscape because prose wraps and a picture opens at its own proportions; a column of titles in a
 * 360×240 box shows six rows and then stops, which makes the window look like it is hiding things.
 */

const COLLECTION_SIZE = { height: 420, width: 300 } as const;
/** Above the LOD restore threshold. Written as insurance before this kind had a summary; now that
 * it has one, it is the only reason zooming out and back leaves a collection readable. */
const COLLECTION_MINIMUM_SIZE = { height: 220, width: 220 } as const;

/**
 * The next name nothing in this project is already using.
 *
 * A collection is named for what it lists — "Links", "Notes" — so every link collection ever made
 * was called "Links", and the library rail showed five identical rows with nothing to tell them
 * apart. Watched, on a project with four of them.
 *
 * `open-note.ts` already solved this for notes and its docstring records the same symptom in the
 * same words: a second note "indistinguishable in the library from the first". Its policy differs
 * on one point deliberately and this does not copy it. "Untitled" alone says nothing, so a note is
 * numbered from the first one; "Links" alone is a real name, so the first keeps it and only
 * repeats are numbered — the convention every file manager uses.
 *
 * Archived titles count, which is the reason to ask twice rather than read the cached listing.
 * Archived items keep their titles, so a name skipped here collides the moment someone restores —
 * a defect that surfaces long after the action that caused it, in a surface neither was in. That
 * is `open-note.ts`'s finding; taking the cheap read would have been shipping a known bug.
 */
const getNextCollectionTitle = (label: string, titles: readonly string[]) =>
  getNextRepeatTitle(label, titles);

async function openNewCollection(
  input: WindowPlacement &
    Readonly<{ projectId: string; question: CollectionQuestion; title: string }>,
) {
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
}

/**
 * Open one that already exists.
 *
 * Split out of `openNewCollection` because until now this kind could only be *made*, never
 * reopened: `open-item.ts` had no `collection` entry, so a collection listing a collection — which
 * `listsKind` permits and nothing prevented — was a row that did nothing when clicked. The size
 * belongs to the kind rather than to the act of creating one, which is what made the split obvious
 * once a second caller existed.
 */
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
