import { expect, test } from "vite-plus/test";

import { notes$, renameNote, stopNoteWriters, type NoteGateway } from "./note-store";

const gateway = {} as NoteGateway;

const seed = (id: string, text: string, title: string) => {
  notes$[id].set({
    error: null,
    note: { content: { text }, id, revision: 3, title },
    status: "ready",
  });
};

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
  renameNote(stub("content_item:cold", "Cold"), "Renamed", gateway);

  expect(notes$["content_item:cold"].peek()?.note?.content.text).toBe("");
  expect(notes$["content_item:cold"].peek()?.note?.title).toBe("Renamed");

  stopNoteWriters();
});
