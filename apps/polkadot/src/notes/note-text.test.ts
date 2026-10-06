import { expect, test } from "vite-plus/test";

import { getNoteLines, getNoteOpeningLine, getNoteText } from "./note-text";

// The fixture shape comes from a Lexical editor state.
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
  expect(getNoteText(toSerializedNote("a\n\nb"))).toBe("a\nb");
  expect(getNoteText(toSerializedNote("  indented"))).toBe("indented");
});

test("the composed state is the shape the reader walks, not merely something it tolerates", () => {
  // This assertion fails if the fixture serializes to an empty object.
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

// These fixtures came from a live Lexical editor.
const REAL_NOTE_WITH_MENTION =
  '{"root":{"children":[{"children":[{"detail":0,"format":0,"mode":"normal","style":"","text":"see ","type":"text","version":1},{"detail":0,"format":0,"mode":"segmented","style":"","text":"@Untitled 7","type":"mention","version":1,"noteId":"content_item:gg17mnwpmw6uucxm1cpf"}],"direction":null,"format":"","indent":0,"type":"paragraph","version":1,"textFormat":0,"textStyle":""}],"direction":null,"format":"","indent":0,"type":"root","version":1}}';

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

test("the envelope is the overwhelming majority of what was being indexed", () => {
  expect(REAL_NOTE_WITH_MENTION.length).toBe(445);
  expect(getNoteText(REAL_NOTE_WITH_MENTION)).toBe("see @Untitled 7");
  expect(getNoteText(REAL_NOTE_WITH_MENTION).length / REAL_NOTE_WITH_MENTION.length).toBeLessThan(
    0.05,
  );
});

test("none of the format's own vocabulary survives extraction", () => {
  const extracted = getNoteText(REAL_NOTE_WITH_MENTION);

  for (const noise of ["paragraph", "version", "format", "normal", "detail", "content_item"]) {
    expect(extracted).not.toContain(noise);
  }
});

test("a mention is words, because it is what the note says", () => {
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

test("anything that is not a serialized state reads as empty rather than throwing", () => {
  for (const bad of ["", "   ", "not json", "{}", "[]", "null", '{"root":"nope"}', '{"root":{}}']) {
    expect(() => getNoteText(bad)).not.toThrow();
    expect(getNoteText(bad)).toBe("");
    expect(getNoteOpeningLine(bad)).toBeNull();
  }
});

test("plain prose that was never a serialized state does not read as prose", () => {
  expect(getNoteText("just some words")).toBe("");
});
