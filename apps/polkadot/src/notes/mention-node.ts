import {
  $create,
  $getState,
  $setState,
  createState,
  TextNode,
  type EditorConfig,
  type LexicalNode,
} from "lexical";
// NodeState keeps noteId in serialized notes.
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

  // The click handler reads the note id from this DOM attribute.
  override createDOM(config: EditorConfig): HTMLElement {
    const dom = super.createDOM(config);

    dom.className = typeof config.theme.mention === "string" ? config.theme.mention : "";
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
