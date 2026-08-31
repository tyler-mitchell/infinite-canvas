import { useLexicalComposerContext } from "@lexical/react/LexicalComposerContext";
import {
  LexicalTypeaheadMenuPlugin,
  MenuOption,
  useBasicTypeaheadTriggerMatch,
} from "@lexical/react/LexicalTypeaheadMenuPlugin";
import { useObservable, useValue } from "@legendapp/state/react";
import { createPortal } from "react-dom";
import { tv } from "ui/tv";

import { $createMentionNode } from "./mention-node";

// The menu portal stays outside the canvas transform.
const mentions = tv({
  slots: {
    empty: "px-3 py-2 text-[12px] text-[var(--ink-faint)]",
    menu: "max-h-[220px] min-w-[180px] overflow-y-auto rounded-[var(--radius-md)] bg-[var(--surface-raised)] p-1 shadow-[var(--lift-2)]",
    option:
      "w-full cursor-pointer truncate rounded-[var(--radius-sm)] px-2 py-1.5 text-left text-[12.5px] text-[var(--ink-muted)]",
  },
  variants: {
    highlighted: {
      true: { option: "bg-[var(--surface-hover)] text-[var(--ink)]" },
    },
  },
});

const MENTION_LIMIT = 6;

type Mentionable = Readonly<{ id: string; title: string }>;

class NoteMentionOption extends MenuOption {
  readonly note: Mentionable;

  constructor(note: Mentionable) {
    super(note.id);
    this.note = note;
  }
}

export function MentionPlugin({
  notes,
  onMention,
  portalRoot,
}: Readonly<{
  notes: readonly Mentionable[];
  onMention: (noteId: string) => void;
  portalRoot: HTMLElement | null;
}>) {
  const [editor] = useLexicalComposerContext();
  const query$ = useObservable<string | null>(null);
  const query = useValue(query$);
  const styles = mentions();
  // Multiword note titles can match.
  const triggerFn = useBasicTypeaheadTriggerMatch("@", { allowWhitespace: true, minLength: 0 });
  const terms = (query ?? "").trim().toLowerCase();
  const options = notes
    .filter((note) => terms === "" || note.title.toLowerCase().includes(terms))
    .slice(0, MENTION_LIMIT)
    .map((note) => new NoteMentionOption(note));

  return (
    <LexicalTypeaheadMenuPlugin<NoteMentionOption>
      menuRenderFn={(anchorRef, { selectedIndex, selectOptionAndCleanUp, setHighlightedIndex }) =>
        anchorRef.current === null
          ? null
          : createPortal(
              /* The listbox owns each option. This wrapper is presentational. */
              <div className={styles.menu()} data-slot="mention-menu" role="presentation">
                {options.length === 0 ? (
                  <p className={styles.empty()} role="presentation">
                    No note by that name.
                  </p>
                ) : (
                  options.map((option, index) => (
                    <button
                      aria-selected={index === selectedIndex}
                      className={styles.option({ highlighted: index === selectedIndex })}
                      /* Lexical points aria-activedescendant at this id. */
                      id={`typeahead-item-${String(index)}`}
                      key={option.key}
                      onClick={() => {
                        setHighlightedIndex(index);
                        selectOptionAndCleanUp(option);
                      }}
                      onMouseEnter={() => {
                        setHighlightedIndex(index);
                      }}
                      ref={(element) => {
                        option.setRefElement(element);
                      }}
                      role="option"
                      type="button"
                    >
                      {option.note.title}
                    </button>
                  ))
                )}
              </div>,
              anchorRef.current,
            )
      }
      onQueryChange={(matching) => {
        query$.set(matching);
      }}
      onSelectOption={(option, nodeToReplace, closeMenu) => {
        editor.update(() => {
          const mention = $createMentionNode(option.note.id, `@${option.note.title}`);

          if (nodeToReplace === null) {
            return;
          }

          nodeToReplace.replace(mention);
          mention.selectNext();
        });

        // Start the database write after the editor transaction commits.
        onMention(option.note.id);
        closeMenu();
      }}
      options={options}
      parent={portalRoot ?? undefined}
      triggerFn={triggerFn}
    />
  );
}

export type { Mentionable };
