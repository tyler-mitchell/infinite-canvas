import type { ContentItemRecord } from "../database/database.client";
import type { WindowPlacement } from "../canvas/open-window";
import { getImageSize, openImageWindow } from "../images/open-image";
import { imageGateway } from "../images/image-gateway";
import { openNoteWindow } from "../notes/open-note";

/**
 * Put a content item on the canvas, whatever kind it is.
 *
 * A collection's rows are destinations, so something has to turn "this record" into "this window",
 * and each kind opens differently enough that one call cannot serve them: a note has a size the app
 * chose, and an image has one only its own pixels know.
 *
 * A lookup keyed by kind rather than a switch, and it lives here rather than in the window registry
 * because the registry answers *how a kind draws* and this answers *how one is placed* — the
 * registry is loaded to render every window on every canvas, and it should not also be the thing
 * that reaches for an image decoder.
 *
 * An item whose kind has no opener is skipped rather than opened as something else. A collection
 * can list a kind that has no window yet, which is deliberate, and a row that quietly opened the
 * wrong sort of window would be worse than one that does nothing.
 */

type ItemOpener = (
  input: WindowPlacement & Readonly<{ item: ContentItemRecord }>,
) => void | Promise<void>;

const OPENERS: Readonly<Record<string, ItemOpener>> = {
  image: async ({ actions, item, state }) => {
    /*
     * Read and decode, because a picture's window is the shape of the picture.
     *
     * The alternative is opening every image at one default size and letterboxing until the user
     * drags it right, which is the thing `getImageSize` exists to avoid — and the bytes have to be
     * fetched for the body to draw anyway, so this costs the round trip nothing that was not
     * already owed.
     */
    const image = await imageGateway.read(item.id);

    if (image === null) {
      return;
    }

    openImageWindow({
      actions,
      imageId: image.id,
      size: await getImageSize(image.content.source),
      state,
      title: image.title,
    });
  },
  note: ({ actions, item, state }) => {
    openNoteWindow({ actions, noteId: item.id, state, title: item.title });
  },
};

function openItemWindow(input: WindowPlacement & Readonly<{ item: ContentItemRecord }>) {
  void OPENERS[input.item.kind]?.(input);
}

export { openItemWindow };
