import { $createCodeNode, $isCodeNode, CodeNode } from "@lexical/code";
import {
  getCodeLanguageOptions,
  loadCodeLanguage,
  normalizeCodeLanguage,
} from "@lexical/code-shiki";
import { useLexicalComposerContext } from "@lexical/react/LexicalComposerContext";
import {
  $createTextNode,
  $getNodeByKey,
  $getRoot,
  $getState,
  $setState,
  createState,
  type LexicalEditor,
} from "lexical";
import {
  Check,
  ChevronDown,
  Copy,
  CopyPlus,
  MoreHorizontal,
  Trash2,
  WrapText,
  X,
} from "lucide-react";
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
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "ui";
import { tv } from "ui/tv";

import { FLOATING_SURFACE } from "#/material";

/**
 * Controls a code block carries: language, copy, and an overflow menu.
 *
 * Positioned from `offsetTop` and `offsetLeft`. `getBoundingClientRect` gives post-transform
 * pixels, which the canvas scale would then apply a second time.
 */

const chrome = tv({
  slots: {
    /** Spans the block so the controls can sit in its corner without measuring a width. */
    frame: "pointer-events-none absolute",
    copied: "text-[var(--accent)]",
    failed: "text-[var(--danger)]",
    label: "font-mono text-[11px] text-[var(--ink-muted)]",
    languageRow: "flex max-h-[18rem] flex-col overflow-hidden",
    row: `${FLOATING_SURFACE} pointer-events-auto absolute top-1.5 right-1.5 flex items-center gap-0.5 rounded-[8px] p-0.5 opacity-0 transition-opacity duration-100 ease-[var(--ease-swift)] group-hover/note:opacity-100 focus-within:opacity-100`,
    tick: "ml-auto size-3 text-[var(--accent)]",
  },
});

const styles = chrome();

/** `[id, displayName]`, from Shiki's bundled grammar list rather than a table kept here. */
const LANGUAGES = getCodeLanguageOptions();

/** Wrapping is on unless a block was told otherwise, which is what a narrow window wants. */
const wrapState = createState("wrap", { parse: (value) => value !== false });

type BlockPlacement = Readonly<{
  height: number;
  key: string;
  left: number;
  top: number;
  width: number;
  wrap: boolean;
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
                wrap: $getState(child, wrapState),
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
          <Button aria-label={`Code language: ${label}`} size="sm" variant="ghost">
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

/** Named by outcome so the label, the glyph, and what a screen reader hears cannot disagree. */
const COPY_LABEL = {
  copied: "Code copied",
  failed: "Could not copy the code",
  idle: "Copy code",
} as const;

/*
 * The failing half was silent.
 *
 * `writeText` rejects for reasons the page does not control — an unfocused document is the common
 * one, and it is exactly what a programmatic press produces. With only a `then`, the press changed
 * nothing at all: no glyph, no message, and a reader who believes the code is on the clipboard.
 * The label carries the outcome, and focus is on this button when it changes, so the outcome is
 * spoken without a second announcement for it.
 */
function CopyButton({ editor, nodeKey }: Readonly<{ editor: LexicalEditor; nodeKey: string }>) {
  const [outcome, setOutcome] = useState<keyof typeof COPY_LABEL>("idle");

  useEffect(() => {
    if (outcome === "idle") {
      return;
    }

    const timer = setTimeout(() => {
      setOutcome("idle");
    }, 1200);

    return () => {
      clearTimeout(timer);
    };
  }, [outcome]);

  return (
    <Button
      aria-label={COPY_LABEL[outcome]}
      onClick={() => {
        const text = editor.read("latest", () => {
          const node = $getNodeByKey(nodeKey);

          return $isCodeNode(node) ? node.getTextContent() : "";
        });

        void navigator.clipboard.writeText(text).then(
          () => {
            setOutcome("copied");
          },
          () => {
            setOutcome("failed");
          },
        );
      }}
      size="icon-sm"
      title={COPY_LABEL[outcome]}
      variant="ghost"
    >
      {outcome === "copied" ? <Check className={styles.copied()} /> : null}
      {outcome === "failed" ? <X className={styles.failed()} /> : null}
      {outcome === "idle" ? <Copy /> : null}
    </Button>
  );
}

function BlockMenu({
  editor,
  nodeKey,
  wrap,
}: Readonly<{ editor: LexicalEditor; nodeKey: string; wrap: boolean }>) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        render={
          <Button aria-label="Code block options" size="icon-sm" variant="ghost">
            <MoreHorizontal />
          </Button>
        }
      />
      <DropdownMenuContent align="end">
        <DropdownMenuItem
          onClick={() => {
            editor.update(() => {
              const node = $getNodeByKey(nodeKey);

              if ($isCodeNode(node)) {
                $setState(node, wrapState, !wrap);
              }
            });
          }}
        >
          <WrapText />
          Wrap lines
          {wrap ? <Check className={styles.tick()} /> : null}
        </DropdownMenuItem>
        <DropdownMenuItem
          onClick={() => {
            editor.update(() => {
              const node = $getNodeByKey(nodeKey);

              if (!$isCodeNode(node)) {
                return;
              }

              const copy = $createCodeNode(node.getLanguage());

              copy.append($createTextNode(node.getTextContent()));
              node.insertAfter(copy);
            });
          }}
        >
          <CopyPlus />
          Duplicate
        </DropdownMenuItem>
        <DropdownMenuItem
          onClick={() => {
            editor.update(() => {
              $getNodeByKey(nodeKey)?.remove();
            });
          }}
          variant="destructive"
        >
          <Trash2 />
          Delete
        </DropdownMenuItem>
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

  // Lexical does not observe attributes, so this survives until the element itself is rebuilt.
  useEffect(() => {
    for (const placement of placements) {
      const element = editor.getElementByKey(placement.key);

      if (element !== null) {
        element.dataset.wrap = String(placement.wrap);
      }
    }
  }, [editor, placements]);

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
            <CopyButton editor={editor} nodeKey={placement.key} />
            <BlockMenu editor={editor} nodeKey={placement.key} wrap={placement.wrap} />
          </div>
        </div>
      ))}
    </>
  );
}
