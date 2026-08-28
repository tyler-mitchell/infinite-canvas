/**
 * The words in a note, out of the editor state that stores them.
 *
 * A note's `content.text` is not text. It is `JSON.stringify(editorState.toJSON())` — the whole
 * document as nested nodes, each carrying `type`, `format`, `detail`, `mode`, `style`, `version`
 * and `direction` alongside whatever was actually typed. A real note measured in the browser on
 * 2026-08-27 held fifteen characters of prose inside four hundred and forty-five of envelope.
 *
 * Nothing had ever read that string as anything but an opaque blob, and two features were wrong
 * because of it: `getNoteSearchText` indexed the envelope, so what a note is *about* was a rounding
 * error in its own index entry; and the far-zoom summary drew the window title, which the chrome
 * already says.
 *
 * **No Lexical import.** The serialized state is plain JSON with a documented shape, and reading it
 * needs a walk rather than an engine — so a summary, a search filter, a test, or a server can ask
 * what a note says without instantiating an editor. `note-editor.tsx` remains the only file that
 * names the engine, which is the boundary it declares for itself; this is the other side of it, and
 * the coupling that remains is to the *format*, stated here so it is somebody's rather than nobody's.
 */

/**
 * A serialized node, as much of one as this needs to know.
 *
 * Structural rather than imported: every Lexical node serializes to an object with a `type`, text
 * nodes add `text`, and element nodes add `children`. Custom nodes — this app's `MentionNode` — are
 * text nodes with extra fields, so they are read by the same rule that reads a plain one and a
 * mention's words count as words. That is the right answer: `@Untitled 7` is what the note says.
 */
type SerializedNode = Readonly<{
  children?: readonly unknown[];
  text?: unknown;
  type?: unknown;
}>;

/**
 * Node types that end a line.
 *
 * Without this every block runs into the next and "the first line of a note" is the whole note.
 * Listed rather than inferred from "has children", because an inline element with children — a
 * link — is part of the line it sits in, not a line of its own.
 */
const BLOCK_TYPES = new Set([
  "code",
  "heading",
  "listitem",
  "paragraph",
  "quote",
  "table",
  "tablerow",
]);

const isNode = (value: unknown): value is SerializedNode =>
  typeof value === "object" && value !== null;

function collect(node: SerializedNode, lines: string[]) {
  if (typeof node.text === "string") {
    lines[lines.length - 1] = `${lines[lines.length - 1] ?? ""}${node.text}`;

    return;
  }

  if (node.type === "linebreak") {
    lines.push("");

    return;
  }

  for (const child of node.children ?? []) {
    if (isNode(child)) {
      collect(child, lines);
    }
  }

  // After the children, so a block's own text lands on its line before the next one opens.
  if (typeof node.type === "string" && BLOCK_TYPES.has(node.type)) {
    lines.push("");
  }
}

/**
 * Every line of prose in a note, in document order, with empty ones dropped.
 *
 * Returns `[]` for an empty note and for a string that is not a serialized state at all — a note
 * saved before the editor existed, a truncated write, anything. Reading a note must never throw:
 * the two callers are a search filter and a summary card, and neither has a sensible answer to an
 * exception except to render nothing, which is what an empty array already does.
 */
function getNoteLines(serialized: string): readonly string[] {
  if (serialized.trim() === "") {
    return [];
  }

  let parsed: unknown;

  try {
    parsed = JSON.parse(serialized);
  } catch {
    return [];
  }

  if (!isNode(parsed)) {
    return [];
  }

  const root = (parsed as Readonly<{ root?: unknown }>).root;

  if (!isNode(root)) {
    return [];
  }

  const lines: string[] = [""];

  collect(root, lines);

  return lines.map((line) => line.trim()).filter((line) => line !== "");
}

/** What a note says, as one string. Blocks are joined by newlines, so line structure survives. */
const getNoteText = (serialized: string) => getNoteLines(serialized).join("\n");

/**
 * The opening line, for a card too small to hold the note.
 *
 * `null` rather than `""` when there is nothing: an empty note and a note whose text failed to
 * parse are both "this says nothing", and a caller deciding whether to draw an element wants one
 * check rather than a truthiness convention.
 */
const getNoteOpeningLine = (serialized: string): string | null =>
  getNoteLines(serialized)[0] ?? null;

/**
 * Prose back into the shape the editor stores, which is the inverse of everything above.
 *
 * The same argument this file already makes, run the other way: the serialized state is plain JSON
 * with a documented shape, so **writing** it needs a walk rather than an engine. Importing Lexical
 * to compose one paragraph would put the editor in the dependency graph of every caller that has a
 * sentence and no DOM — a tool call, a test, a future importer — and `note-editor.tsx` stays the one
 * file that names the engine.
 *
 * One paragraph per line, which is what pressing return produces.
 *
 * **The fields are copied from a state the engine actually emitted**, not from memory of the format
 * — `note-text.test.ts` keeps such a state as a fixture and says why: writing one by hand is how a
 * parser passes its own tests and fails on the only input that matters. So `direction` is `null`
 * rather than `"ltr"` (Lexical computes direction from content and writes null until it has), and a
 * paragraph carries `textFormat` and `textStyle`. The first draft of this had guessed `"ltr"` and
 * omitted `textStyle`, which the fixture beside it immediately contradicted.
 *
 * Round-trips through `getNoteText` exactly for text whose lines are non-blank and untrimmed-clean.
 * Blank lines and leading whitespace do not survive, because the reader drops them by design — a
 * summary card and a search index both want prose rather than layout. Stated here because it is a
 * real limit of the pair rather than a bug in either half.
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

export { getNoteLines, getNoteOpeningLine, getNoteText, toSerializedNote };
