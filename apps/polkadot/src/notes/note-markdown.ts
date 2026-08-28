import { CodeHighlightNode, CodeNode } from "@lexical/code";
import { createHeadlessEditor } from "@lexical/headless";
import { AutoLinkNode, LinkNode } from "@lexical/link";
import { ListItemNode, ListNode } from "@lexical/list";
import {
  $convertFromMarkdownString,
  $convertToMarkdownString,
  TRANSFORMERS,
} from "@lexical/markdown";
import { HeadingNode, QuoteNode } from "@lexical/rich-text";

import { MentionNode } from "./mention-node";

/**
 * A note as markdown, through the editor rather than beside it.
 *
 * `note.read` and `note.write` are how anything that cannot see the screen edits a note, and they
 * spoke plain text: every line came back a paragraph, so a caller fixing one word replaced every
 * code block, heading, list and quote with a paragraph. `note-text-round-trip.test.ts` pins that.
 *
 * `createHeadlessEditor` runs the real engine with no DOM, which is the shape `@lexical/headless`
 * documents for exactly this. The conversion is the editor's own — same `TRANSFORMERS` the typing
 * shortcuts use — so what a caller reads is what the editor would have written, and a second parser
 * cannot drift from it.
 *
 * **The node list is the coupling that matters.** A node the editor registers and this does not is
 * dropped on parse, silently: the state loads, the block is gone, and the write puts back a note
 * without it. It mirrors `note-editor.tsx`'s extensions, and `CodeHighlightNode` is here because
 * `CodeNode` holds them as children even though nothing here highlights.
 *
 * `note-text.ts` is deliberately *not* replaced. It declares no Lexical import so a search filter
 * can ask what a note says without an engine, and it runs per keystroke over the whole library.
 * This is the other job — the document rather than the words — and pays an editor for it.
 */

const NOTE_NODES = [
  AutoLinkNode,
  CodeHighlightNode,
  CodeNode,
  HeadingNode,
  LinkNode,
  ListItemNode,
  ListNode,
  MentionNode,
  QuoteNode,
];

const readInEditor = <Result>(input: Readonly<{ act: () => Result; state?: string }>): Result => {
  const editor = createHeadlessEditor({
    nodes: NOTE_NODES,
    onError: (error: Error) => {
      throw error;
    },
  });

  if (input.state !== undefined && input.state !== "") {
    editor.setEditorState(editor.parseEditorState(input.state));
  }

  let result: Result | undefined;

  // `discrete` so the update has run by the time this returns; the default defers it.
  editor.update(
    () => {
      result = input.act();
    },
    { discrete: true },
  );

  return result as Result;
};

/** What the editor would export, so a caller reads the note rather than its envelope. */
const noteToMarkdown = (serialized: string): string =>
  readInEditor({ act: () => $convertToMarkdownString(TRANSFORMERS), state: serialized });

/** The inverse, so a fenced block comes back a code block and a `#` line comes back a heading. */
const markdownToNote = (markdown: string): string => {
  const editor = createHeadlessEditor({
    nodes: NOTE_NODES,
    onError: (error: Error) => {
      throw error;
    },
  });

  editor.update(
    () => {
      $convertFromMarkdownString(markdown, TRANSFORMERS);
    },
    { discrete: true },
  );

  return JSON.stringify(editor.getEditorState().toJSON());
};

export { markdownToNote, noteToMarkdown };
