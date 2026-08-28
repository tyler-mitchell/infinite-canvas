import { expect, test } from "vite-plus/test";

import { getNoteLines, getNoteOpeningLine, getNoteText } from "./note-text";

/**
 * The writer these tests read back, kept here because nothing ships it any more.
 *
 * It was production code until `note.write` moved to markdown; now its only job is to build states
 * for the reader to walk. **The fields are copied from a state the engine actually emitted**, not
 * from memory of the format — the fixture further down is that state, and it is what caught the
 * first draft guessing `direction: "ltr"` (Lexical writes `null` until content gives it one) and
 * omitting `textStyle`.
 */
const toSerializedNote = (text: string): string =>
  JSON.stringify({
    root: {
      children: text.split("\n").map((line) => ({
        children:
          line === ""
            ? []
            : [
                {
                  detail: 0,
                  format: 0,
                  mode: "normal",
                  style: "",
                  text: line,
                  type: "text",
                  version: 1,
                },
              ],
        direction: null,
        format: "",
        indent: 0,
        textFormat: 0,
        textStyle: "",
        type: "paragraph",
        version: 1,
      })),
      direction: null,
      format: "",
      indent: 0,
      type: "root",
      version: 1,
    },
  });

/**
 * The pair, round-tripped — which is the only thing that makes writing without the engine safe.
 *
 * `toSerializedNote` composes the editor's storage format by hand, on the argument this file's
 * subject already makes for reading it: the shape is documented JSON, so it needs a walk rather than
 * Lexical. The risk of that argument is a state the editor cannot open, and the cheapest evidence
 * against it is that the reader written independently gets the same prose back out.
 *
 * The browser is what proves the editor opens it; this proves the two halves agree.
 */
test("prose survives a round trip through the stored form", () => {
  for (const text of [
    "A single line.",
    "First line.\nSecond line.",
    'Punctuation: commas, dashes — and "quotes".',
    "@Untitled 7 mentioned in passing",
    "100% of {braces} and \\backslashes\\",
  ]) {
    expect(getNoteText(toSerializedNote(text))).toBe(text);
  }
});

test("an empty note serializes to something the reader calls empty", () => {
  expect(getNoteText(toSerializedNote(""))).toBe("");
  expect(getNoteOpeningLine(toSerializedNote(""))).toBeNull();
});

test("blank lines and indentation do not survive, and that is the reader's rule not a fault", () => {
  /*
   * Stated rather than hidden. `getNoteLines` trims and drops empties by design — a summary card and
   * a search index both want prose, not layout — so the round trip is exact for clean lines and
   * lossy for spacing. A caller told "one line per paragraph" is not misled by this; a caller
   * promised fidelity would be.
   */
  expect(getNoteText(toSerializedNote("a\n\nb"))).toBe("a\nb");
  expect(getNoteText(toSerializedNote("  indented"))).toBe("indented");
});

test("the composed state is the shape the reader walks, not merely something it tolerates", () => {
  // Guards the guard: a serializer emitting `{}` would round-trip "" through both halves happily.
  const parsed = JSON.parse(toSerializedNote("hello")) as {
    root: {
      children: { children: { text: string; type: string }[]; type: string }[];
      type: string;
    };
  };

  expect(parsed.root.type).toBe("root");
  expect(parsed.root.children[0]?.type).toBe("paragraph");
  expect(parsed.root.children[0]?.children[0]).toMatchObject({ text: "hello", type: "text" });
});

test("what is composed carries the same fields the engine itself emits", () => {
  /*
   * Against the captured state below rather than against memory of the format — the exact mistake
   * this file's fixture docstring warns about, and one the first draft of `toSerializedNote` made:
   * it guessed `direction: "ltr"` and omitted `textStyle`, and the real note two screens down says
   * `null` and `""`. Lexical fills defaults on load, so neither would have thrown; they would have
   * differed silently from every note a person typed.
   */
  type Serialized = Readonly<{
    root: Record<string, unknown> & { children: readonly Record<string, unknown>[] };
  }>;

  const composed = JSON.parse(toSerializedNote("x")) as Serialized;
  const real = JSON.parse(REAL_NOTE_WITH_MENTION) as Serialized;

  expect(Object.keys(composed.root).sort()).toStrictEqual(Object.keys(real.root).sort());

  const composedParagraph = composed.root.children[0] ?? {};
  const realParagraph = real.root.children[0] ?? {};

  expect(Object.keys(composedParagraph).sort()).toStrictEqual(Object.keys(realParagraph).sort());
  expect(composedParagraph.direction).toBe(realParagraph.direction);
});

/**
 * Fixtures are real serialized states, not hand-written ones.
 *
 * The first is copied verbatim out of a live Lexical editor in the running app on 2026-08-27 —
 * `editor.getEditorState().toJSON()` on the note titled "Untitled 6". Writing the fixture by hand
 * from memory of the format is how a parser passes its tests and fails on the only input that
 * matters; every field below, including the ones this module ignores, is there because the engine
 * actually emits it.
 */
const REAL_NOTE_WITH_MENTION =
  '{"root":{"children":[{"children":[{"detail":0,"format":0,"mode":"normal","style":"","text":"see ","type":"text","version":1},{"detail":0,"format":0,"mode":"segmented","style":"","text":"@Untitled 7","type":"mention","version":1,"noteId":"content_item:gg17mnwpmw6uucxm1cpf"}],"direction":null,"format":"","indent":0,"type":"paragraph","version":1,"textFormat":0,"textStyle":""}],"direction":null,"format":"","indent":0,"type":"root","version":1}}';

/** An empty editor still serializes: one paragraph holding nothing. */
const REAL_EMPTY_NOTE =
  '{"root":{"children":[{"children":[],"direction":null,"format":"","indent":0,"type":"paragraph","version":1,"textFormat":0,"textStyle":""}],"direction":null,"format":"","indent":0,"type":"root","version":1}}';

const paragraph = (...texts: readonly string[]) => ({
  children: texts.map((text) => ({ detail: 0, format: 0, text, type: "text", version: 1 })),
  direction: null,
  format: "",
  indent: 0,
  type: "paragraph",
  version: 1,
});

const state = (...children: readonly object[]) =>
  JSON.stringify({
    root: { children, direction: null, format: "", indent: 0, type: "root", version: 1 },
  });

test("a real note yields its prose and nothing else", () => {
  expect(getNoteText(REAL_NOTE_WITH_MENTION)).toBe("see @Untitled 7");
});

/**
 * The measurement that motivated the module, as an assertion.
 *
 * Fifteen characters of prose in four hundred and forty-five of envelope. Before this, that whole
 * string was the note's search-index entry, so `format`, `paragraph`, `normal`, `version` and a raw
 * record id were all "words in this note", and the three that were real were 3% of it.
 */
test("the envelope is the overwhelming majority of what was being indexed", () => {
  expect(REAL_NOTE_WITH_MENTION.length).toBe(445);
  expect(getNoteText(REAL_NOTE_WITH_MENTION)).toBe("see @Untitled 7");
  expect(getNoteText(REAL_NOTE_WITH_MENTION).length / REAL_NOTE_WITH_MENTION.length).toBeLessThan(
    0.05,
  );
});

test("none of the format's own vocabulary survives extraction", () => {
  const extracted = getNoteText(REAL_NOTE_WITH_MENTION);

  // Each of these is a substring of the raw state and matched a search against it.
  for (const noise of ["paragraph", "version", "format", "normal", "detail", "content_item"]) {
    expect(extracted).not.toContain(noise);
  }
});

test("a mention is words, because it is what the note says", () => {
  // A `MentionNode` is a `TextNode` with a `noteId`, so it is read by the text rule — deliberately.
  // Dropping it would make "see @Untitled 7" unfindable by the only proper noun in it.
  expect(getNoteText(REAL_NOTE_WITH_MENTION)).toContain("@Untitled 7");
});

test("an empty note says nothing", () => {
  expect(getNoteText(REAL_EMPTY_NOTE)).toBe("");
  expect(getNoteLines(REAL_EMPTY_NOTE)).toEqual([]);
  expect(getNoteOpeningLine(REAL_EMPTY_NOTE)).toBeNull();
});

test("blocks are separate lines, so an opening line is one line", () => {
  const source = state(paragraph("First paragraph."), paragraph("Second paragraph."));

  expect(getNoteLines(source)).toEqual(["First paragraph.", "Second paragraph."]);
  expect(getNoteOpeningLine(source)).toBe("First paragraph.");
});

test("text runs inside one block stay on one line", () => {
  // Bold or italic splits a sentence into several text nodes; they are still one sentence.
  expect(getNoteLines(state(paragraph("A ", "bold", " word.")))).toEqual(["A bold word."]);
});

test("a heading opens the note the way a title would", () => {
  const source = state(
    { ...paragraph("Notes on the thing"), tag: "h1", type: "heading" },
    paragraph("Body follows."),
  );

  expect(getNoteOpeningLine(source)).toBe("Notes on the thing");
});

test("a list contributes one line per item", () => {
  const source = state({
    children: [
      { ...paragraph("first"), type: "listitem" },
      { ...paragraph("second"), type: "listitem" },
    ],
    direction: null,
    format: "",
    indent: 0,
    listType: "bullet",
    type: "list",
    version: 1,
  });

  expect(getNoteLines(source)).toEqual(["first", "second"]);
});

test("a soft break ends a line without ending the block", () => {
  const source = state({
    ...paragraph("before"),
    children: [
      { detail: 0, format: 0, text: "before", type: "text", version: 1 },
      { type: "linebreak", version: 1 },
      { detail: 0, format: 0, text: "after", type: "text", version: 1 },
    ],
  });

  expect(getNoteLines(source)).toEqual(["before", "after"]);
});

/**
 * Reading a note must never throw.
 *
 * The callers are a search filter that runs on every keystroke and a summary card the canvas draws
 * while panning. Neither has an answer to an exception except to render nothing, and a note whose
 * text predates the editor, or was truncated by a partial write, is a thing that can exist in a
 * local-first database nobody migrates on read.
 */
test("anything that is not a serialized state reads as empty rather than throwing", () => {
  for (const bad of ["", "   ", "not json", "{}", "[]", "null", '{"root":"nope"}', '{"root":{}}']) {
    expect(() => getNoteText(bad)).not.toThrow();
    expect(getNoteText(bad)).toBe("");
    expect(getNoteOpeningLine(bad)).toBeNull();
  }
});

test("plain prose that was never a serialized state does not read as prose", () => {
  // Stated rather than assumed: a bare sentence is not valid JSON, so it extracts to nothing. If a
  // pre-editor note format ever needs supporting, this is the test that will fail and say so.
  expect(getNoteText("just some words")).toBe("");
});
