import type { InfiniteCanvasCommands, InfiniteCanvasState } from "@hyphened/infinite-canvas";

import { getContentWindowItemId, type WindowKind } from "../canvas/window-registry";
import type { ContentItemRecord } from "../database/database.client";
import { NOTE_KIND, noteGateway, toNote } from "../notes/note-gateway";
import { renameNote } from "../notes/note-store";
import { setProjectItemTitle } from "./project-content";

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
 * **Only a note can be renamed here, and that is a fact about the database rather than a policy.**
 * `content.save` needs the record's content, revision and search text — a kind's own gateway is the
 * only thing that holds those — and `setProjectItemTitle` writes to the cached listing, not to
 * storage. So a non-note renamed through this path would look right until the next read and then
 * revert. Refusing says so instead; other kinds rename through their window chrome, which owns
 * their gateway.
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

  if (input.item.kind !== NOTE_KIND) {
    /*
     * The kind is stated rather than given an article. Interpolating after "a" produced "a image",
     * which a caller reads as carelessness in the one sentence telling it what to do instead — and
     * picking the article from the first letter would be a rule to maintain for four words.
     */
    return `Refused: only a note can be renamed here. This is a "${input.item.kind}", which is renamed from its window, because only a note's own writer can save the change.`;
  }

  /*
   * Converted rather than spread: `renameNote` seeds its store from what it is handed and then saves
   * that content, so a stub `{ text: "" }` would erase the note's body. `toNote` asserts the real
   * stored content, which is what the listing holds — and the kind guard above is what makes that
   * assertion safe.
   */
  renameNote(toNote(input.item), next, noteGateway);
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
