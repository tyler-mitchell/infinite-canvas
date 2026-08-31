import { CodeShikiExtension, ShikiTokenizer } from "@lexical/code-shiki";
import { ClickableLinkExtension, LinkExtension } from "@lexical/link";
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

const noteEditor = tv({
  slots: {
    bold: "font-medium text-[var(--ink)]",
    // Block and inline code need separate theme keys.
    codeBlock:
      "my-2 block overflow-x-auto rounded-[6px] p-3 font-mono text-[12px] leading-[1.6] break-words whitespace-pre-wrap data-[wrap=false]:break-normal data-[wrap=false]:whitespace-pre",
    // flex-1 lets long notes grow beyond the window scroller.
    content: "flex-1 text-[13.5px] leading-[1.7] text-[var(--ink-muted)] outline-none",
    h1: "mt-0 mb-2 text-[17px] font-medium tracking-[-0.015em] text-[var(--ink)]",
    h2: "mt-4 mb-1.5 text-[14px] font-medium text-[var(--ink)]",
    inlineCode:
      "rounded-[4px] bg-[var(--surface-hover)] px-1 py-0.5 font-mono text-[12px] text-[var(--ink)]",
    link: "text-[var(--accent)] underline underline-offset-2",
    mention: "cursor-pointer rounded-[4px] bg-[var(--accent-wash)] px-1 py-px text-[var(--accent)]",
    listItem: "my-0.5",
    ol: "my-2 list-decimal pl-5",
    paragraph: "[&+p]:mt-3",
    placeholder:
      "pointer-events-none absolute inset-0 text-[13.5px] leading-[1.7] text-[var(--ink-faint)] select-none",
    quote: "my-2 border-l-2 border-[var(--accent)] pl-3 text-[var(--ink-faint)]",
    root: "group/note relative flex flex-1 flex-col",
    ul: "my-2 list-disc pl-5",
  },
});

const styles = noteEditor();

const EDITOR_THEME: EditorThemeClasses = {
  code: styles.codeBlock(),
  heading: { h1: styles.h1(), h2: styles.h2() },
  link: styles.link(),
  list: { listitem: styles.listItem(), ol: styles.ol(), ul: styles.ul() },
  mention: styles.mention(),
  paragraph: styles.paragraph(),
  quote: styles.quote(),
  text: { bold: styles.bold(), code: styles.inlineCode() },
};

const EDITOR_EXTENSIONS = [
  RichTextExtension,
  ListExtension,
  LinkExtension,
  // Links open in a new tab so the canvas stays open.
  configExtension(ClickableLinkExtension, { newTab: true }),
  // Shiki loads grammars on demand.
  configExtension(CodeShikiExtension, {
    tokenizer: { ...ShikiTokenizer, defaultTheme: "vitesse-dark" },
  }),
];

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
  // Build the extension once. Recreating it rebuilds the editor.
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
    <LexicalExtensionComposer contentEditable={null} extension={extension}>
      <div className={styles.root()}>
        {/* The editable region has a persistent accessible name. */}
        {/* ContentEditable owns its placeholder. */}
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
