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

// This node list matches the editor so conversion does not drop blocks.
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

// Mentions use record links so markdown preserves the note id.
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

  // discrete makes the update complete before this function returns.
  editor.update(
    () => {
      result = input.act();
    },
    { discrete: true },
  );

  return result as Result;
};

const noteToMarkdown = (serialized: string): string =>
  readInEditor({ act: () => $convertToMarkdownString(NOTE_TRANSFORMERS), state: serialized });

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
