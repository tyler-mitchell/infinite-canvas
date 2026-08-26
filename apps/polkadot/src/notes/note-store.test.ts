import { expect, test } from "vite-plus/test";

import { notes$, renameNote, stopNoteWriters, type NoteGateway } from "./note-store";

/**
 * The one save path that can lose a note's body without erroring.
 *
 * `renameNote` seeds its store from the record it is handed when nothing is loaded, and then saves
 * *that* content — so a caller holding a partial record erases the note. It typechecks, the write
 * succeeds, nothing is logged, and the text is simply gone. It was reachable the moment the library
 * listing stopped holding full `NoteRecord`s, and both callers now convert with `toNote`.
 *
 * The write is debounced, so these assert the observable, which `editNote` updates synchronously.
 * The gateway is never reached and is a stub.
 */

const gateway = {} as NoteGateway;

const seed = (id: string, text: string, title: string) => {
  notes$[id].set({
    error: null,
    note: { content: { text }, id, revision: 3, title },
    status: "ready",
  });
};

/** A record whose envelope is right and whose content is a lie — what a partial listing produces. */
const stub = (id: string, title: string) => ({
  content: { text: "" },
  id,
  revision: 3,
  title,
});

test("renaming a loaded note keeps its body", () => {
  seed("content_item:kept", "the body that must survive", "Before");

  renameNote(stub("content_item:kept", "Before"), "After", gateway);

  expect(notes$["content_item:kept"].peek()?.note?.content.text).toBe("the body that must survive");
  expect(notes$["content_item:kept"].peek()?.note?.title).toBe("After");

  stopNoteWriters();
});

test("the stored text wins over the record handed in, even when they disagree", () => {
  // The guard itself: the loaded entry is the authority for content, not the caller's copy. Without
  // this, a caller with a stale or partial record silently overwrites what is on screen.
  seed("content_item:disagree", "stored", "Name");

  renameNote(
    {
      content: { text: "caller's idea of the text" },
      id: "content_item:disagree",
      revision: 3,
      title: "Name",
    },
    "Renamed",
    gateway,
  );

  expect(notes$["content_item:disagree"].peek()?.note?.content.text).toBe("stored");

  stopNoteWriters();
});

test("with nothing loaded, the record handed in *is* the authority — so it must be real", () => {
  /*
   * Not a defect, and pinned so it stays visible: renaming a note that was never opened has no
   * stored copy to read, and seeding from the caller's record is what makes a rename immediate
   * rather than waiting on a round trip.
   *
   * The cost is that the caller's record is the only content there is. Hand it a stub and the note
   * becomes a stub. That is why `toNote` exists at both call sites, and why this test asserts the
   * empty text rather than quietly passing.
   */
  renameNote(stub("content_item:cold", "Cold"), "Renamed", gateway);

  expect(notes$["content_item:cold"].peek()?.note?.content.text).toBe("");
  expect(notes$["content_item:cold"].peek()?.note?.title).toBe("Renamed");

  stopNoteWriters();
});
