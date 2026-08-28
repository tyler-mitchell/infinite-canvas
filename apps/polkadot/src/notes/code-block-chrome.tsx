import { $isCodeNode, CodeNode } from "@lexical/code";
import {
  getCodeLanguageOptions,
  loadCodeLanguage,
  normalizeCodeLanguage,
} from "@lexical/code-shiki";
import { useLexicalComposerContext } from "@lexical/react/LexicalComposerContext";
import { $getNodeByKey, $getRoot, type LexicalEditor } from "lexical";
import { Check, ChevronDown, Copy } from "lucide-react";
import { useEffect, useState } from "react";
import {
  Button,
  Command,
  CommandEmpty,
  CommandInput,
  CommandItem,
  CommandList,
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuTrigger,
} from "ui";
import { tv } from "ui/tv";

/**
 * The language picker and copy control a code block carries, in the corner Notion puts them.
 *
 * Positioned from `offsetTop` and `offsetLeft`, never `getBoundingClientRect`. Lexical's own
 * playground menu uses client rects, which are in post-transform pixels — inside this app's scaled
 * canvas those would place the chrome further from the block the further you zoom. Offsets are
 * layout coordinates and a CSS transform does not touch them.
 */

const chrome = tv({
  slots: {
    /** Spans the block so the controls can sit in its corner without measuring a width. */
    frame: "pointer-events-none absolute",
    label: "font-mono text-[11px] text-[var(--ink-muted)]",
    languageRow: "flex max-h-[18rem] flex-col overflow-hidden",
    row: "pointer-events-auto absolute top-1.5 right-1.5 flex items-center gap-0.5 opacity-0 transition-opacity duration-100 ease-[var(--ease-swift)] group-hover/note:opacity-100 focus-within:opacity-100",
    tick: "ml-auto size-3 text-[var(--accent)]",
  },
});

const styles = chrome();

/** `[id, displayName]`, from Shiki's bundled grammar list rather than a table kept here. */
const LANGUAGES = getCodeLanguageOptions();

type BlockPlacement = Readonly<{
  height: number;
  key: string;
  left: number;
  top: number;
  width: number;
}>;

const readPlacements = (editor: LexicalEditor): readonly BlockPlacement[] =>
  editor.read("latest", () =>
    $getRoot()
      .getChildren()
      .flatMap((child) => {
        if (!$isCodeNode(child)) {
          return [];
        }

        const element = editor.getElementByKey(child.getKey());

        return element === null
          ? []
          : [
              {
                height: element.offsetHeight,
                key: child.getKey(),
                left: element.offsetLeft,
                top: element.offsetTop,
                width: element.offsetWidth,
              },
            ];
      }),
  );

function LanguagePicker({ editor, nodeKey }: Readonly<{ editor: LexicalEditor; nodeKey: string }>) {
  /*
   * Normalised before the lookup. A fence writes its alias — ```js — and Shiki's options are keyed
   * by canonical id, so matching the raw value labelled every JavaScript block "Plain text".
   */
  const current = editor.read("latest", () => {
    const node = $getNodeByKey(nodeKey);

    return $isCodeNode(node) ? normalizeCodeLanguage(node.getLanguage() ?? "") : "";
  });
  const label = LANGUAGES.find(([id]) => id === current)?.[1] ?? "Plain text";

  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        render={
          <Button size="sm" variant="ghost">
            <span className={styles.label()}>{label}</span>
            <ChevronDown />
          </Button>
        }
      />
      <DropdownMenuContent>
        <Command className={styles.languageRow()}>
          <CommandInput placeholder="Search for a language…" />
          <CommandList>
            <CommandEmpty>No language matches that.</CommandEmpty>
            {LANGUAGES.map(([id, name]) => (
              <CommandItem
                key={id}
                onSelect={() => {
                  editor.update(() => {
                    const node = $getNodeByKey(nodeKey);

                    if ($isCodeNode(node)) {
                      node.setLanguage(id);
                    }
                  });
                  // Grammars arrive on demand; this marks the node dirty once one lands.
                  void loadCodeLanguage(id, editor, nodeKey);
                }}
                value={name}
              >
                {name}
                {id === current ? <Check className={styles.tick()} /> : null}
              </CommandItem>
            ))}
          </CommandList>
        </Command>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

export function CodeBlockChrome() {
  const [editor] = useLexicalComposerContext();
  const [placements, setPlacements] = useState<readonly BlockPlacement[]>([]);

  useEffect(() => {
    const sync = () => {
      setPlacements(readPlacements(editor));
    };

    sync();

    return editor.registerUpdateListener(sync);
  }, [editor]);

  useEffect(
    () =>
      editor.registerMutationListener(
        CodeNode,
        () => {
          setPlacements(readPlacements(editor));
        },
        { skipInitialization: false },
      ),
    [editor],
  );

  return (
    <>
      {placements.map((placement) => (
        <div
          className={styles.frame()}
          key={placement.key}
          style={{
            height: placement.height,
            left: placement.left,
            top: placement.top,
            width: placement.width,
          }}
        >
          <div className={styles.row()}>
            <LanguagePicker editor={editor} nodeKey={placement.key} />
            <Button
              aria-label="Copy code"
              onClick={() => {
                const text = editor.read("latest", () => {
                  const node = $getNodeByKey(placement.key);

                  return $isCodeNode(node) ? node.getTextContent() : "";
                });

                void navigator.clipboard.writeText(text);
              }}
              size="icon-sm"
              title="Copy code"
              variant="ghost"
            >
              <Copy />
            </Button>
          </div>
        </div>
      ))}
    </>
  );
}
