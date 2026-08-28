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

/**
 * Naming another note from inside a note.
 *
 * Everything about the interaction is `@lexical/react`'s: `useBasicTypeaheadTriggerMatch` decides
 * what counts as a trigger, `LexicalTypeaheadMenuPlugin` owns the query lifecycle, the keyboard
 * traversal and the anchor positioning. What is written here is only what the menu lists and what
 * choosing one does — hand-rolling any of the rest would be reimplementing a first-party plugin.
 *
 * **The menu is portalled into the framework's root, not `document.body`.** A note is rendered
 * inside `transform: scale(zoom)`, so anything positioned against the viewport resolves against the
 * scaled frame instead and lands in the wrong place at the wrong size — the trap `note-editor.tsx`
 * names in its own header. The plugin takes a `parent`, which is exactly that seam.
 */

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

/** How many notes the menu offers before it stops being a menu and becomes a list to read. */
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
  /** Called with the mentioned note once the mention is in the document. */
  onMention: (noteId: string) => void;
  portalRoot: HTMLElement | null;
}>) {
  const [editor] = useLexicalComposerContext();
  const query$ = useObservable<string | null>(null);
  const query = useValue(query$);
  const styles = mentions();
  // Whitespace allowed, so a note called "Weekly review" is reachable without typing it as one word.
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
              /*
               * `presentation` on the box, `option` on each row.
               *
               * This renders into the element Lexical gives it, which is a `role="listbox"`. A
               * listbox owns `option`s, and this put a plain `div` in between holding `button`s —
               * measured live: the listbox reported zero options while showing one note, so what a
               * screen reader was handed was an empty list. The wrapper is the styling box and says
               * so; the rows say what they are and which one is current.
               */
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
                      /*
                       * The id `aria-activedescendant` already points at.
                       *
                       * `LexicalMenu` writes `typeahead-item-${index}` onto the editor root as the
                       * highlight moves, and these rows carried no id — so the reference resolved to
                       * nothing and a screen reader arrowing the list was told nothing. Measured with
                       * the menu open: the root said `typeahead-item-0` while no such element
                       * existed. The format is Lexical's, not a choice.
                       */
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

        /*
         * After the edit, not inside it. The write is a database round trip and `editor.update` is
         * a synchronous transaction — starting async work from inside one couples the document's
         * commit to a network reply, and a failed write would leave the text and the graph
         * disagreeing with no way to tell which one lost.
         */
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
