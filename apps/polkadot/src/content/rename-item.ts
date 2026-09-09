import type { InfiniteCanvasCommands, InfiniteCanvasState } from "@hyphened/infinite-canvas";

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
import { setProjectItemRevision, setProjectItemTitle } from "./project-content";

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
    actions: InfiniteCanvasCommands<WindowKind>;
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

  const saved = write(input.item, next);

  // Direct writers return a revision. The note store updates its own.
  if (saved !== null) {
    try {
      const record = await saved;

      setProjectItemRevision(record.id, record.revision);
    } catch (error) {
      // Storage refused, most often on a revision conflict. Naming the screen
      // first would leave it showing a title storage does not have, which is
      // what made a lost rename look like a successful one.
      return `Refused: the rename did not save. ${String(error)}`;
    }
  }

  setProjectItemTitle({ itemId: input.item.id, title: next });

  const windowId = input.state.windows.find(
    (window) => getContentWindowItemId(window) === input.item.id,
  )?.id;

  if (windowId !== undefined) {
    input.actions.setWindowTitle({ title: next, windowId });
  }

  return undefined;
};

const RENAMEABLE_KINDS: readonly string[] = Object.keys(TITLE_WRITERS);

export { RENAMEABLE_KINDS, renameProjectItem };
