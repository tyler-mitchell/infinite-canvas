import { CodeShikiExtension, ShikiTokenizer } from "@lexical/code-shiki";
import { LinkExtension } from "@lexical/link";
import { ListExtension } from "@lexical/list";
import { TRANSFORMERS } from "@lexical/markdown";
import { ContentEditable } from "@lexical/react/LexicalContentEditable";
import { LexicalExtensionComposer } from "@lexical/react/LexicalExtensionComposer";
import { HistoryPlugin } from "@lexical/react/LexicalHistoryPlugin";
import { MarkdownShortcutPlugin } from "@lexical/react/LexicalMarkdownShortcutPlugin";
import { OnChangePlugin } from "@lexical/react/LexicalOnChangePlugin";
import { RichTextExtension } from "@lexical/rich-text";
import {
  configExtension,
  defineExtension,
  type EditorState,
  type EditorThemeClasses,
  type LexicalEditor,
} from "lexical";
import { useState } from "react";
import { tv } from "ui/tv";

import { CodeBlockChrome } from "./code-block-chrome";
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
    bold: "font-medium text-[var(--ink)]",
    /**
     * A recessed well, not the inline pill.
     *
     * Lexical renders both a code block and inline code as `<code>`, so a `[&_code]` rule hit both
     * and a fenced block drew as a pill: measured `display: inline` with `padding: 2px 4px`.
     *
     * No background or text colour: Shiki writes both as inline styles from its theme, and a
     * declaration that always loses is the defect this app's bar names first.
     */
    codeBlock:
      "my-2 block overflow-x-auto rounded-[6px] p-3 font-mono text-[12px] leading-[1.6] break-words whitespace-pre-wrap",
    // `flex-1` rather than `h-full`: a flex item keeps `min-height: auto`, so it fills the column
    // when the note is short and grows past it when the note is long. A height locks out the
    // second case, which is how a note longer than its window became unreadable.
    content: "flex-1 text-[13.5px] leading-[1.7] text-[var(--ink-muted)] outline-none",
    h1: "mt-0 mb-2 text-[17px] font-medium tracking-[-0.015em] text-[var(--ink)]",
    h2: "mt-4 mb-1.5 text-[14px] font-medium text-[var(--ink)]",
    inlineCode:
      "rounded-[4px] bg-[var(--surface-hover)] px-1 py-0.5 font-mono text-[12px] text-[var(--ink)]",
    link: "text-[var(--accent)] underline underline-offset-2",
    listItem: "my-0.5",
    ol: "my-2 list-decimal pl-5",
    /** Spacing belongs between paragraphs, so it is the sibling that gets it, not every one. */
    paragraph: "[&+p]:mt-3",
    placeholder:
      "pointer-events-none absolute inset-0 text-[13.5px] leading-[1.7] text-[var(--ink-faint)] select-none",
    quote: "my-2 border-l-2 border-[var(--accent)] pl-3 text-[var(--ink-faint)]",
    /** `group/note` is what reveals each code block's chrome; `relative` is what positions it. */
    root: "group/note relative flex flex-1 flex-col",
    ul: "my-2 list-disc pl-5",
  },
});

const styles = noteEditor();

/**
 * What Lexical stamps on each node it renders.
 *
 * This was `{}`, with the slot above styling rendered elements by tag. Tags cannot say what the
 * editor says: `code` and `text.code` are separate keys because they are separate nodes, and one
 * `[&_code]` rule collapsed them. Keying by node is the library's own mechanism — `@lexical/tailwind`
 * is a theme of Tailwind strings shaped exactly this way.
 *
 * Values come from `tv` slots, so classes still have one home and this stays a mapping.
 */
const EDITOR_THEME: EditorThemeClasses = {
  code: styles.codeBlock(),
  heading: { h1: styles.h1(), h2: styles.h2() },
  link: styles.link(),
  list: { listitem: styles.listItem(), ol: styles.ol(), ul: styles.ul() },
  paragraph: styles.paragraph(),
  quote: styles.quote(),
  text: { bold: styles.bold(), code: styles.inlineCode() },
};

/**
 * Only what no extension already brings.
 *
 * `RichTextExtension` ships heading and quote, `ListExtension` the list pair, `LinkExtension` the
 * link, `CodeExtension` the code pair. Each also registers its own behaviour, which is what a
 * mounted plugin used to do separately — the split the extensions doc calls easy to get wrong.
 */
const EDITOR_EXTENSIONS = [
  RichTextExtension,
  ListExtension,
  LinkExtension,
  /*
   * Shiki brings `CodeExtension` and `CodeIndentExtension` with it, so the nodes and Tab handling
   * arrive too. Its default theme is `one-light`, which would be a white slab on this ground.
   *
   * `vitesse-dark` is the least saturated dark theme Shiki bundles — warm greys rather than the
   * six-hue rainbow most editor themes use, which is the closest a real grammar gets to this app's
   * one-hue palette. Grammars load on demand, so nothing is bundled for a language nobody types.
   */
  configExtension(CodeShikiExtension, {
    tokenizer: { ...ShikiTokenizer, defaultTheme: "vitesse-dark" },
  }),
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
  /*
   * Built once, from the value at mount.
   *
   * `LexicalExtensionComposer` recreates the editor whenever this reference changes, and `value`
   * changes on every keystroke — an inline object would rebuild the editor mid-word.
   * `LexicalComposer` read its config once and hid that. Remounting stays the caller's job through
   * `key`, which is what it already does for an external write.
   */
  const [extension] = useState(() =>
    defineExtension({
      $initialEditorState: value === "" ? null : value,
      dependencies: EDITOR_EXTENSIONS,
      name: "polkadot-note",
      namespace: "polkadot-note",
      nodes: () => [MentionNode],
      theme: EDITOR_THEME,
    }),
  );

  return (
    // `contentEditable={null}`: the one below is ours, inside `RichTextPlugin`.
    <LexicalExtensionComposer contentEditable={null} extension={extension}>
      <div className={styles.root()}>
        {/*
          The editable region is named, which it was not.

          `role="textbox"`, editable, and nothing to say what it edits. Unlike the title field there
          was not even a fallback to fall back to: Lexical draws its placeholder as a sibling `div`
          rather than a `placeholder` attribute, so the name computation had nothing to reach for.
          The window around it is `role="group"` named after the note, so this says which field it
          is and no more — repeating the note's name here would announce it twice.
        */}
        {/*
          `ContentEditable` owns the placeholder now, and demands `aria-placeholder` beside it.
          It used to be a loose sibling `div` with nothing naming it — which the comment above
          describes as having no fallback for the name computation. This is that fallback.
        */}
        <ContentEditable
          aria-label="Note"
          aria-placeholder="Write something…"
          className={styles.content()}
          placeholder={<div className={styles.placeholder()}>Write something…</div>}
        />
        <HistoryPlugin />
        <MarkdownShortcutPlugin transformers={TRANSFORMERS} />
        <CodeBlockChrome />
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
    </LexicalExtensionComposer>
  );
}
