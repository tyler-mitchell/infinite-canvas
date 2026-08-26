import { openContentWindow, type WindowPlacement } from "../canvas/open-window";
import { collectionGateway } from "./collection-gateway";

/**
 * Put a collection on the canvas.
 *
 * Taller than it is wide, unlike every other kind here, because a list is read down. A note opens
 * landscape because prose wraps and a picture opens at its own proportions; a column of titles in a
 * 360×240 box shows six rows and then stops, which makes the window look like it is hiding things.
 */

const COLLECTION_SIZE = { height: 420, width: 300 } as const;
/**
 * Above the semantic-LOD band's restore threshold, like a note's and unlike an image's.
 *
 * This kind declares no summary today, so the lane never engages and the floor is not load-bearing
 * *yet* — but the moment a summary is added, a floor below the band would strand the window as a
 * card it can never come back from. Cheaper to be above it from the start than to discover that
 * later through the bug.
 */
const COLLECTION_MINIMUM_SIZE = { height: 220, width: 220 } as const;

async function openNewCollection(
  input: WindowPlacement & Readonly<{ listsKind: string; projectId: string; title: string }>,
) {
  const created = await collectionGateway.create({
    listsKind: input.listsKind,
    projectId: input.projectId,
    title: input.title,
  });

  openContentWindow({
    actions: input.actions,
    data: { itemId: created.id },
    kind: "collection",
    minSize: COLLECTION_MINIMUM_SIZE,
    size: COLLECTION_SIZE,
    state: input.state,
    title: created.title,
  });
}

export { COLLECTION_MINIMUM_SIZE, COLLECTION_SIZE, openNewCollection };
