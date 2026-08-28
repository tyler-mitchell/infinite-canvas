import { CodeHighlightNode, CodeNode } from "@lexical/code";
import { createHeadlessEditor } from "@lexical/headless";
import { LinkNode } from "@lexical/link";
import { ListItemNode, ListNode } from "@lexical/list";
import {
  $convertFromMarkdownString,
  $convertToMarkdownString,
  TRANSFORMERS,
  type TextMatchTransformer,
} from "@lexical/markdown";
import { HeadingNode, QuoteNode } from "@lexical/rich-text";

import { $createMentionNode, $isMentionNode, MentionNode } from "./mention-node";

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

/**
 * No `AutoLinkNode`, and that is a coupling rather than an omission.
 *
 * Nothing can produce one: `AutoLinkExtension` is not mounted, and `TRANSFORMERS`' `LINK` builds a
 * `LinkNode`. Listing a node the editor cannot make said this list mirrored the editor when it did
 * not.
 *
 * **Mounting autolink means more than adding it back.** `LINK.export` returns `null` for an
 * autolink, so an autolinked URL would export as its bare text with the link gone — silently, to
 * every caller of `note.read`, which is the loss this module exists to close. Whoever mounts it owes
 * a transformer for the node as well.
 */
const NOTE_NODES = [
  CodeHighlightNode,
  CodeNode,
  HeadingNode,
  LinkNode,
  ListItemNode,
  ListNode,
  MentionNode,
  QuoteNode,
];

/**
 * A mention, as an ordinary markdown link to the note's record.
 *
 * Without this the export writes the words and the import reads them back as text, so a caller
 * round-tripping a note turned every mention in it into plain words and the notes stopped being
 * connected. `TRANSFORMERS` has no transformer for it, and text-match is the documented seam.
 *
 * **The syntax is markdown's own link, not a new one.** `[@Quarterly](content_item:xyz)` reads as a
 * link anywhere else, which is the honest degradation for a reference to a record only this app can
 * resolve. The import is keyed to a `content_item:` destination rather than to the bracket shape, so
 * a real link whose text happens to start with `@` stays a link. It is listed before `TRANSFORMERS`
 * because `LINK` would otherwise claim the same text first.
 *
 * A mention carrying no id — the state's default — exports as `null` and falls through to its words,
 * because a link to nothing is worse than the text.
 */
const MENTION: TextMatchTransformer = {
  dependencies: [MentionNode],
  export: (node) => {
    if (!$isMentionNode(node) || node.getNoteId() === "") {
      return null;
    }

    return `[${node.getTextContent()}](${node.getNoteId()})`;
  },
  importRegExp: /\[([^\]]+)\]\((content_item:[\dA-Za-z]+)\)/,
  regExp: /\[([^\]]+)\]\((content_item:[\dA-Za-z]+)\)$/,
  replace: (textNode, match) => {
    const [, text, noteId] = match;

    if (text !== undefined && noteId !== undefined) {
      textNode.replace($createMentionNode(noteId, text));
    }
  },
  trigger: ")",
  type: "text-match",
};

const NOTE_TRANSFORMERS = [MENTION, ...TRANSFORMERS];

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
  readInEditor({ act: () => $convertToMarkdownString(NOTE_TRANSFORMERS), state: serialized });

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
      $convertFromMarkdownString(markdown, NOTE_TRANSFORMERS);
    },
    { discrete: true },
  );

  return JSON.stringify(editor.getEditorState().toJSON());
};

export { markdownToNote, noteToMarkdown };
