import { openCollectionWindow } from "../collections/open-collection";
import type { ContentItemRecord } from "../database/database.client";
import { imageGateway } from "../images/image-gateway";
import { getImageSize, openImageWindow } from "../images/open-image";
import { openLinkWindow } from "../links/open-link";
import { openNoteWindow } from "../notes/open-note";
import { revealContentWindow, type WindowPlacement } from "./open-window";

type ItemOpener = (
  input: WindowPlacement & Readonly<{ item: ContentItemRecord }>,
) => void | Promise<void>;

const OPENERS: Readonly<Record<string, ItemOpener>> = {
  collection: ({ dispatch, item, state }) => {
    openCollectionWindow({ collectionId: item.id, dispatch, state, title: item.title });
  },
  image: async ({ dispatch, item, state }) => {
    const image = await imageGateway.read(item.id);

    if (image === null) {
      return;
    }

    openImageWindow({
      dispatch,
      imageId: image.id,
      size: await getImageSize(image.content.source),
      state,
      title: image.title,
    });
  },
  link: ({ dispatch, item, state }) => {
    openLinkWindow({ dispatch, linkId: item.id, state, title: item.title });
  },
  note: ({ dispatch, item, state }) => {
    openNoteWindow({ dispatch, noteId: item.id, state, title: item.title });
  },
};

function openItemWindow(input: WindowPlacement & Readonly<{ item: ContentItemRecord }>) {
  if (revealContentWindow({ dispatch: input.dispatch, itemId: input.item.id, state: input.state }))
    return;
  return OPENERS[input.item.kind]?.(input);
}

function isOpenableItemKind(kind: string) {
  return kind in OPENERS;
}

export { isOpenableItemKind, openItemWindow };
