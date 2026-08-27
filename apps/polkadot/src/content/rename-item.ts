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
import { setProjectItemTitle } from "./project-content";

/**
 * How each kind saves a new title, or absent when nothing can save one for it.
 *
 * A map rather than a chain of conditions, and the entries are the whole rule: a kind is renameable
 * here exactly when it has a writer that persists the change. `content.save` needs the record's
 * content, revision and search text together, so only a kind's own gateway can compose one.
 *
 * **This began as a note-only guard and was wrong by one kind.** The library rail asks
 * `kind === "note"`, that assumption was carried into this function, and reading the gateways
 * afterwards showed `collectionGateway.save` takes a title — so collections were being refused a
 * rename the database was perfectly willing to store. Images and links genuinely have no writer:
 * their gateways expose `create`, `list` and `read` and nothing else, so a rename would live in the
 * cache until the next read and then vanish.
 *
 * A kind that grows a writer gets renaming by adding a line here, rather than by finding the
 * condition that excluded it.
 */
const TITLE_WRITERS: Readonly<Record<string, (item: ContentItemRecord, title: string) => void>> = {
  [COLLECTION_KIND]: (item, title) => {
    /*
     * The question is passed back unchanged. `content.save` replaces the whole record, so composing
     * a save without it would rename the collection and empty it in the same write — the same trap
     * `renameNote` documents for a note's text.
     */
    const collection = toCollection(item);

    void collectionGateway.save({
      collectionId: collection.id,
      question: collection.content,
      revision: collection.revision,
      title,
    });
  },
  [IMAGE_KIND]: (item, title) => {
    void imageGateway.rename({ item, title });
  },
  [LINK_KIND]: (item, title) => {
    void linkGateway.rename({ item, title });
  },
  /*
   * Converted rather than spread: `renameNote` seeds its store from what it is handed and then saves
   * that content, so a stub `{ text: "" }` would erase the note's body. `toNote` asserts the real
   * stored content, which is what the listing holds — and reaching this entry at all is what makes
   * that assertion safe.
   */
  [NOTE_KIND]: (item, title) => {
    renameNote(toNote(item), title, noteGateway);
  },
};

/**
 * Giving something a name, in the one place that knows everywhere a name is written down.
 *
 * A rename lands in three places because three of them hold the old one: the kind's own store owns
 * the saved record, the project listing is what the library reads, and the window title is the
 * far-zoom summary and the accessible name. Miss one and the name is right in some surfaces and
 * stale in others, which is a defect nobody notices until they are looking at two of them at once.
 *
 * **This existed twice, inside two click handlers, and the copies had already drifted.** The library
 * rail trimmed the text and refused an empty or unchanged name; the palette committed the raw draft,
 * so whitespace could become a title. The rail asked whether the item was a note before handing it
 * to `renameNote`; the palette did not, and `toNote` runs `NoteContent.assert`, which throws on
 * anything that is not one. Neither was reachable except by pointing at it.
 *
 * **Which kinds are renameable is a fact about the database rather than a policy**, and it is
 * `TITLE_WRITERS` above that states it. `setProjectItemTitle` writes to the cached listing rather
 * than to storage, so a kind with no writer would look renamed until the next read and then revert.
 * Refusing says so instead; those kinds rename through their window chrome, which owns their
 * gateway.
 *
 * Returns the refusal or nothing, the same shape `AppAction.run` uses, so the verb built on this
 * hands a caller the reason without restating it.
 */
const renameProjectItem = (
  input: Readonly<{
    actions: InfiniteCanvasCommands<WindowKind>;
    item: ContentItemRecord;
    state: InfiniteCanvasState<WindowKind>;
    title: string;
  }>,
): string | undefined => {
  const next = input.title.trim();

  if (next === "") {
    return "Refused: a name cannot be blank.";
  }

  if (next === input.item.title) {
    // Not a refusal a caller needs to act on, but not a rename either. Saying nothing happened is
    // more honest than reporting a write that was never made.
    return "Refused: that is already its name.";
  }

  const write = TITLE_WRITERS[input.item.kind];

  if (write === undefined) {
    /*
     * Unreachable for every kind this app currently has, and kept anyway.
     *
     * It used to fire for images and links, telling a caller to rename them "from its own window" —
     * a route that did not exist, since an image window has no controls at all and a link window has
     * exactly one, "Open in browser". Rather than correct the sentence, both gateways grew a
     * `rename`, so the message is now what it always should have been: a report about a kind nobody
     * has taught this app to save, which is a thing only a fifth kind can be.
     *
     * The kind is quoted rather than given an article; interpolating after "a" produced "a image".
     */
    return `Refused: nothing here can save a new title for a "${input.item.kind}" — its kind has no writer yet.`;
  }

  write(input.item, next);
  setProjectItemTitle(input.item.id, next);

  const windowId = input.state.windows.find(
    (window) => getContentWindowItemId(window) === input.item.id,
  )?.id;

  if (windowId !== undefined) {
    input.actions.setWindowTitle({ title: next, windowId });
  }

  return undefined;
};

export { renameProjectItem };
