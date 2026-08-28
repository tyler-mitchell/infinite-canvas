import {
  $create,
  $getState,
  $setState,
  createState,
  TextNode,
  type EditorConfig,
  type LexicalNode,
} from "lexical";
import { tv } from "ui/tv";

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
 *
 * **The id is `NodeState`, not a property.** Lexical's nodes doc says to prefer it on v0.26+, and
 * `flat: true` keeps `noteId` at the top of the serialized node — byte-identical to the hand-written
 * `exportJSON` this replaced, so stored notes round-trip untouched. `$config` installs `clone` and
 * `importJSON`, and the base `exportJSON` carries the state, so four overrides and a constructor
 * become one declaration. `RubyNode` in Lexical's playground is the same shape.
 */

const mention = tv({
  base: "cursor-pointer rounded-[4px] bg-[var(--accent-wash)] px-1 py-px text-[var(--accent)]",
});

/** Default `""` so a node that never carried an id serializes without the key. */
const noteIdState = createState("noteId", {
  parse: (value) => (typeof value === "string" ? value : ""),
});

class MentionNode extends TextNode {
  $config() {
    return this.config("mention", {
      extends: TextNode,
      stateConfigs: [{ flat: true, stateConfig: noteIdState }],
    });
  }

  getNoteId(): string {
    return $getState(this, noteIdState);
  }

  /**
   * `data-note-id` rather than a class alone, because the click handler that reaches the note reads
   * it straight off the event target — the DOM is where a click already is, and looking the node up
   * through Lexical to answer "which note is this" would be the longer way round to the same string.
   */
  override createDOM(config: EditorConfig): HTMLElement {
    const dom = super.createDOM(config);

    dom.className = mention();
    dom.dataset.noteId = this.getNoteId();

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
  $setState($create(MentionNode).setTextContent(text).setMode("segmented"), noteIdState, noteId);

const $isMentionNode = (node: LexicalNode | null | undefined): node is MentionNode =>
  node instanceof MentionNode;

export { $createMentionNode, $isMentionNode, MentionNode };
