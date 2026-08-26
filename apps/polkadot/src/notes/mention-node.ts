import {
  TextNode,
  type EditorConfig,
  type LexicalNode,
  type NodeKey,
  type SerializedTextNode,
  type Spread,
} from "lexical";

/**
 * A note named inside another note's text.
 *
 * A `TextNode` subclass rather than a `DecoratorNode`, which is the shape Lexical's own mention
 * example uses and the right one here: a mention *is* text — it wraps at the end of a line, a
 * selection can run through it, and backspace deletes it like any other word. A decorator would be
 * a React island the caret has to step around, which is what you want for an embed and wrong for a
 * name in a sentence.
 *
 * The note's id travels with the node so the reference survives a rename: the text is only what the
 * note was called when it was mentioned, and nothing downstream resolves the note by that string.
 *
 * `isTextEntity` is what makes it behave as one unit — Lexical stops merging neighbouring text into
 * it, so typing after a mention writes a new node instead of silently extending the name.
 */

type SerializedMentionNode = Spread<{ noteId: string }, SerializedTextNode>;

const MENTION_TYPE = "mention";

class MentionNode extends TextNode {
  readonly __noteId: string;

  constructor(noteId: string, text: string, key?: NodeKey) {
    super(text, key);
    this.__noteId = noteId;
  }

  static override getType(): string {
    return MENTION_TYPE;
  }

  static override clone(node: MentionNode): MentionNode {
    return new MentionNode(node.__noteId, node.__text, node.__key);
  }

  static override importJSON(serialized: SerializedMentionNode): MentionNode {
    const node = new MentionNode(serialized.noteId, serialized.text);

    node.setFormat(serialized.format);
    node.setDetail(serialized.detail);
    node.setMode(serialized.mode);
    node.setStyle(serialized.style);

    return node;
  }

  override exportJSON(): SerializedMentionNode {
    return { ...super.exportJSON(), noteId: this.__noteId };
  }

  /**
   * `data-note-id` rather than a class alone, because the click handler that reaches the note reads
   * it straight off the event target — the DOM is where a click already is, and looking the node up
   * through Lexical to answer "which note is this" would be the longer way round to the same string.
   */
  override createDOM(config: EditorConfig): HTMLElement {
    const dom = super.createDOM(config);

    dom.className =
      "cursor-pointer rounded-[4px] bg-[var(--accent-wash)] px-1 py-px text-[var(--accent)]";
    dom.dataset.noteId = this.__noteId;

    return dom;
  }

  override isTextEntity(): boolean {
    return true;
  }

  override canInsertTextBefore(): boolean {
    return false;
  }

  override canInsertTextAfter(): boolean {
    return false;
  }
}

const $createMentionNode = (noteId: string, text: string) =>
  new MentionNode(noteId, text).setMode("segmented");

const $isMentionNode = (node: LexicalNode | null | undefined): node is MentionNode =>
  node instanceof MentionNode;

export { $createMentionNode, $isMentionNode, MentionNode };
export type { SerializedMentionNode };
