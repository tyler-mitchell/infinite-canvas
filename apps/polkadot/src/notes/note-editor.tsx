import { ListItemNode, ListNode } from "@lexical/list";
import { LinkNode } from "@lexical/link";
import { TRANSFORMERS } from "@lexical/markdown";
import { LexicalComposer } from "@lexical/react/LexicalComposer";
import { ContentEditable } from "@lexical/react/LexicalContentEditable";
import { LexicalErrorBoundary } from "@lexical/react/LexicalErrorBoundary";
import { HistoryPlugin } from "@lexical/react/LexicalHistoryPlugin";
import { LinkPlugin } from "@lexical/react/LexicalLinkPlugin";
import { ListPlugin } from "@lexical/react/LexicalListPlugin";
import { MarkdownShortcutPlugin } from "@lexical/react/LexicalMarkdownShortcutPlugin";
import { OnChangePlugin } from "@lexical/react/LexicalOnChangePlugin";
import { RichTextPlugin } from "@lexical/react/LexicalRichTextPlugin";
import { HeadingNode, QuoteNode } from "@lexical/rich-text";
import { CodeNode } from "@lexical/code";
import type { EditorState, LexicalEditor } from "lexical";
import { tv } from "ui/tv";

import { MentionNode } from "./mention-node";
import { MentionPlugin, type Mentionable } from "./mention-plugin";

/**
 * The only place the editor engine is named.
 *
 * The contract is `{ value, onChange }` over a serialized editor state, so the engine underneath
 * is this file's decision alone.
 *
 * **Lexical rather than Tiptap**, chosen for control. Both are library-first — Meta ships
 * `@lexical/rich-text`, `list`, `link`, and `markdown` as first-party packages, so composing them
 * is not hand-rolling. What Lexical adds is `DecoratorNode`: arbitrary React rendered *inside* the
 * document, which is what a note referencing another note, an inline connector chip, or a live
 * embed will each need. ProseMirror can do it through NodeViews, less directly. Lexical is also
 * lighter per instance, which matters on a canvas holding many open notes, and has no commercial
 * extension tier.
 *
 * Editing inside a `transform: scale()` subtree is the known trap. Caret and selection work
 * because the window declares `textSelection: "native"`, which stops the canvas claiming the
 * pointer. Anything that *floats* — a format menu, a link popover — must mount through
 * `InfiniteCanvasPortal`, since `position: fixed` resolves against the scaled frame.
 */

const noteEditor = tv({
  slots: {
    // `flex-1` rather than `h-full`: a flex item keeps `min-height: auto`, so it fills the column
    // when the note is short and grows past it when the note is long. A height locks out the
    // second case, which is how a note longer than its window became unreadable.
    content:
      "flex-1 text-[13.5px] leading-[1.7] text-[var(--ink-muted)] outline-none [&_a]:text-[var(--accent)] [&_a]:underline [&_a]:underline-offset-2 [&_blockquote]:my-2 [&_blockquote]:border-l-2 [&_blockquote]:border-[var(--accent)] [&_blockquote]:pl-3 [&_blockquote]:text-[var(--ink-faint)] [&_code]:rounded-[4px] [&_code]:bg-[var(--surface-hover)] [&_code]:px-1 [&_code]:py-0.5 [&_code]:font-mono [&_code]:text-[12px] [&_code]:text-[var(--ink)] [&_h1]:mt-0 [&_h1]:mb-2 [&_h1]:text-[17px] [&_h1]:font-medium [&_h1]:tracking-[-0.015em] [&_h1]:text-[var(--ink)] [&_h2]:mt-4 [&_h2]:mb-1.5 [&_h2]:text-[14px] [&_h2]:font-medium [&_h2]:text-[var(--ink)] [&_li]:my-0.5 [&_ol]:my-2 [&_ol]:list-decimal [&_ol]:pl-5 [&_p+p]:mt-3 [&_strong]:font-medium [&_strong]:text-[var(--ink)] [&_ul]:my-2 [&_ul]:list-disc [&_ul]:pl-5",
    placeholder:
      "pointer-events-none absolute inset-0 text-[13.5px] leading-[1.7] text-[var(--ink-faint)] select-none",
    root: "relative flex flex-1 flex-col",
  },
});

/**
 * Theme classes Lexical stamps onto its own DOM.
 *
 * Empty on purpose: the slot styles above target the rendered elements directly, so there is one
 * place that decides what a note looks like rather than two.
 */
const EDITOR_THEME = {};

const EDITOR_NODES = [
  HeadingNode,
  QuoteNode,
  ListNode,
  ListItemNode,
  LinkNode,
  CodeNode,
  MentionNode,
];

/**
 * `mentions` keeps this file's boundary intact.
 *
 * The editor is handed a list of things that can be named and a callback for when one is — it is
 * told nothing about notes, relations or the database, so the engine stays the only thing this file
 * knows about. Whoever supplies the options decides what a mention *means*.
 */
export function NoteEditor({
  mentions,
  onChange,
  value,
}: Readonly<{
  mentions: Readonly<{
    onSelect: (id: string) => void;
    options: readonly Mentionable[];
    portalRoot: HTMLElement | null;
  }>;
  onChange: (value: string) => void;
  value: string;
}>) {
  const styles = noteEditor();

  return (
    <LexicalComposer
      initialConfig={{
        // Keyed by the note, so opening a different note in the same window rebuilds the editor
        // with that note's state instead of keeping the previous one.
        editorState: value === "" ? null : value,
        namespace: "polkadot-note",
        nodes: EDITOR_NODES,
        onError: (error: Error) => {
          throw error;
        },
        theme: EDITOR_THEME,
      }}
    >
      <div className={styles.root()}>
        {/*
          The editable region is named, which it was not.

          `role="textbox"`, editable, and nothing to say what it edits. Unlike the title field there
          was not even a fallback to fall back to: Lexical draws its placeholder as a sibling `div`
          rather than a `placeholder` attribute, so the name computation had nothing to reach for.
          The window around it is `role="group"` named after the note, so this says which field it
          is and no more — repeating the note's name here would announce it twice.
        */}
        <RichTextPlugin
          contentEditable={<ContentEditable aria-label="Note" className={styles.content()} />}
          ErrorBoundary={LexicalErrorBoundary}
          placeholder={<div className={styles.placeholder()}>Write something…</div>}
        />
        <HistoryPlugin />
        <ListPlugin />
        <LinkPlugin />
        <MarkdownShortcutPlugin transformers={TRANSFORMERS} />
        <MentionPlugin
          notes={mentions.options}
          onMention={mentions.onSelect}
          portalRoot={mentions.portalRoot}
        />
        <OnChangePlugin
          ignoreSelectionChange
          onChange={(editorState: EditorState, _editor: LexicalEditor) => {
            onChange(JSON.stringify(editorState.toJSON()));
          }}
        />
      </div>
    </LexicalComposer>
  );
}
