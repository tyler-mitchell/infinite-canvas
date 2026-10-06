import type { InfiniteCanvasDispatch, InfiniteCanvasState } from "@hyphened/infinite-canvas/legacy";

import { getContentWindowItemId, type WindowKind } from "../canvas/window-registry";
import {
  COLLECTION_KIND,
  collectionGateway,
  toCollection,
} from "../collections/collection-gateway";
import type { ContentItemRecord } from "../database/database.client";
import { IMAGE_KIND, imageGateway } from "../images/image-gateway";
import { LINK_KIND, linkGateway } from "../links/link-gateway";
import { NOTE_KIND, noteGateway, toNote } from "../notes/note-gateway";
import { renameNote } from "../notes/note-store";
import { updateProjectItem } from "./project-content";
import { batch } from "@legendapp/state";

// A null result means that the writer updates its own revision.
type TitleWriter = (
  item: ContentItemRecord,
  title: string,
) => Promise<Readonly<{ id: string; revision: number }>> | null;

const TITLE_WRITERS: Readonly<Record<string, TitleWriter>> = {
  // The save includes the question because it replaces the complete record.
  [COLLECTION_KIND]: (item, title) => {
    const collection = toCollection(item);

    return collectionGateway.save({
      collectionId: collection.id,
      question: collection.content,
      revision: collection.revision,
      title,
    });
  },
  [IMAGE_KIND]: (item, title) => imageGateway.rename({ item, title }),
  [LINK_KIND]: (item, title) => linkGateway.rename({ item, title }),
  // The complete record prevents renameNote from erasing the note body.
  [NOTE_KIND]: (item, title) => {
    renameNote(toNote(item), title, noteGateway);

    return null;
  },
};

// A rename updates storage, then the project listing and the open window.
// The refusal string is the one result channel: `content.rename` returns it to
// its caller, and a write that storage rejects comes back the same way.
const renameProjectItem = async (
  input: Readonly<{
    dispatch: InfiniteCanvasDispatch<WindowKind>;
    item: ContentItemRecord;
    state: InfiniteCanvasState<WindowKind>;
    title: string;
  }>,
): Promise<string | undefined> => {
  const next = input.title.trim();

  if (next === "") {
    return "Refused: a name cannot be blank.";
  }

  if (next === input.item.title) {
    return "Refused: that is already its name.";
  }

  const write = TITLE_WRITERS[input.item.kind];

  if (write === undefined) {
    return `Refused: nothing here can save a new title for a "${input.item.kind}" — its kind has no writer yet.`;
  }

  try {
    const saved = write(input.item, next);
    // The note writer updates its own cached record.
    if (saved !== null) {
      const record = await saved;
      updateProjectItem({ id: record.id, revision: record.revision, title: next });
    }
  } catch (error) {
    return `Refused: the rename did not save. ${String(error)}`;
  }

  batch(() => {
    for (const window of input.state.windows) {
      if (getContentWindowItemId(window) === input.item.id) {
        input.dispatch({ title: next, type: "window.setTitle", windowId: window.id });
      }
    }
  });

  return undefined;
};

const RENAMEABLE_KINDS: readonly string[] = Object.keys(TITLE_WRITERS);

export { RENAMEABLE_KINDS, renameProjectItem };
