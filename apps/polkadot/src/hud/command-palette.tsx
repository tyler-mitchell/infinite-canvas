import {
  focusInfiniteCanvasCommandSurface,
  getInfiniteCanvasContextualCommands,
  getInfiniteCanvasWindowPresence,
  useInfiniteCanvasActions,
  useInfiniteCanvasState,
  type InfiniteCanvasCommandGroup,
} from "@hyphened/infinite-canvas";
import { useObservable, useValue } from "@legendapp/state/react";
import { createHotkeyHandler, formatForDisplay } from "@tanstack/hotkeys";
import {
  CornerDownLeft,
  FilePlus2,
  Frame,
  MousePointerSquareDashed,
  Move3d,
  Search,
  SquareStack,
  Undo2,
} from "lucide-react";
import { useEffect, type ComponentType, type ReactNode } from "react";
import {
  CommandDialog,
  CommandEmpty,
  CommandFooter,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
  CommandShortcut,
} from "ui";
import { tv } from "ui/tv";

import type { WindowKind } from "../canvas/window-registry";
import { openNewNote } from "../notes/open-note";

/**
 * One surface over three vocabularies: the windows on this canvas, what Polkadot can do, and what
 * the canvas can do right now.
 *
 * The canvas half is read from the framework rather than restated — `getInfiniteCanvasContextualCommands`
 * carries label, description, hotkeys, group, and enablement against live state, and
 * `getInfiniteCanvasWindowPresence` enumerates windows for navigation.
 *
 * `cmdk` owns filtering, ranking, roving focus, and the listbox roles; the Base UI dialog owns
 * modality and focus restore.
 */

const PALETTE_HOTKEY = "Mod+K";

/** The dialog restores focus to whatever opened it, and a hotkey is not an element — so without
 * this, focus lands on `<body>` where every canvas shortcut is dead and nothing says why. */
const returnFocusToCanvas = () => {
  focusInfiniteCanvasCommandSurface(
    document.querySelector<HTMLElement>("[data-infinite-canvas-command-scope='surface']"),
  );
};

/** The framework groups every command; the glyph follows that rather than being decoration. */
const GROUP_ICON: Record<InfiniteCanvasCommandGroup, ComponentType> = {
  canvas: Frame,
  edit: Undo2,
  selection: MousePointerSquareDashed,
  view: Move3d,
  window: SquareStack,
};

const palette = tv({
  slots: {
    description: "truncate text-[12px] text-[var(--ink-faint)]",
    footerHint: "flex items-center gap-1.5 text-[11px] text-[var(--ink-faint)]",
    footerKey:
      "grid h-4 min-w-4 place-items-center rounded bg-[var(--surface-hover)] px-1 font-mono text-[10px] text-[var(--ink-muted)]",
    key: "grid h-5 min-w-5 place-items-center rounded-[5px] bg-[var(--surface-hover)] px-1.5 font-mono text-[10px] text-[var(--ink-muted)]",
    // `command-item-icon` is the hook Polkadot's stylesheet tints on the selected row.
    tile: "grid size-6 shrink-0 place-items-center rounded-[7px] bg-[var(--surface)] text-[var(--ink-faint)] transition-colors duration-100 [&_svg]:size-3.5",
    title: "shrink-0 text-[13px] text-[var(--ink)]",
    titleRow: "flex min-w-0 flex-1 items-baseline gap-2",
  },
});

export function CommandPalette({ projectId }: Readonly<{ projectId: string }>) {
  const isOpen$ = useObservable(false);
  const isOpen = useValue(isOpen$);

  useEffect(() => {
    const handleKeyDown = createHotkeyHandler(PALETTE_HOTKEY, (event) => {
      event.preventDefault();
      isOpen$.set(!isOpen$.peek());
    });

    window.addEventListener("keydown", handleKeyDown);

    return () => {
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [isOpen$]);

  const close = () => {
    isOpen$.set(false);
    returnFocusToCanvas();
  };

  return (
    <CommandDialog
      description="Search windows, actions, and canvas commands"
      onOpenChange={(open) => {
        if (open) {
          isOpen$.set(true);
        } else {
          close();
        }
      }}
      open={isOpen}
      title="Command palette"
    >
      {/* Mounted only while open. `useInfiniteCanvasState` re-renders on every camera tick, and a
          palette nobody opened has no business reconciling while the user pans. */}
      {isOpen ? <PaletteContent onClose={close} projectId={projectId} /> : null}
    </CommandDialog>
  );
}

function Row({
  description,
  icon: Icon,
  keys,
  onSelect,
  title,
  trailing,
  value,
}: Readonly<{
  description?: string;
  icon: ComponentType;
  keys?: readonly string[];
  onSelect: () => void;
  title: string;
  trailing?: ReactNode;
  value: string;
}>) {
  const styles = palette();

  return (
    <CommandItem onSelect={onSelect} value={value}>
      <span className={styles.tile()} data-slot="command-item-icon">
        <Icon />
      </span>
      <span className={styles.titleRow()}>
        <span className={styles.title()}>{title}</span>
        {description === undefined ? null : (
          <span className={styles.description()}>{description}</span>
        )}
      </span>
      {keys === undefined || keys.length === 0 ? (
        trailing
      ) : (
        <CommandShortcut>
          {keys.map((key) => (
            <kbd className={styles.key()} key={key}>
              {key}
            </kbd>
          ))}
        </CommandShortcut>
      )}
    </CommandItem>
  );
}

function PaletteContent({
  onClose,
  projectId,
}: Readonly<{ onClose: () => void; projectId: string }>) {
  const state = useInfiniteCanvasState<WindowKind>();
  const actions = useInfiniteCanvasActions<WindowKind>();
  const styles = palette();
  const windows = getInfiniteCanvasWindowPresence(state).windows;
  const available = getInfiniteCanvasContextualCommands(state).filter((command) => command.enabled);

  const run = (perform: () => void) => () => {
    perform();
    onClose();
  };

  return (
    <>
      <CommandInput autoFocus placeholder="Search windows, actions, and commands…" />
      <CommandList>
        <CommandEmpty>Nothing matches that.</CommandEmpty>

        {windows.length === 0 ? null : (
          <CommandGroup heading="Windows">
            {windows.map((window) => (
              <Row
                icon={Frame}
                key={window.id}
                onSelect={run(() => {
                  // A minimized window has no rect to fly to, so restore before navigating.
                  if (window.mode === "minimized") {
                    actions.restoreWindow(window.id);
                  }

                  actions.focusWindow(window.id);
                  actions.navigateToWindow({ windowId: window.id });
                })}
                title={window.title}
                trailing={
                  window.isActive ? <span className={styles.description()}>active</span> : null
                }
                value={`window ${window.title} ${window.kind}`}
              />
            ))}
          </CommandGroup>
        )}

        <CommandGroup heading="Actions">
          <Row
            icon={FilePlus2}
            onSelect={run(() => {
              void openNewNote({ actions, projectId, state });
            })}
            title="New note"
            value="new note create"
          />
        </CommandGroup>

        <CommandGroup heading="Canvas">
          {available.map((command) => (
            <Row
              description={command.description}
              icon={GROUP_ICON[command.group]}
              key={command.id}
              keys={command.hotkeys.map((hotkey) => formatForDisplay(hotkey))}
              onSelect={run(() => {
                actions.executeCommand(command.command);
              })}
              title={command.label}
              value={`${command.label} ${command.description} ${command.id}`}
            />
          ))}
        </CommandGroup>
      </CommandList>

      <CommandFooter>
        <span className={styles.footerHint()}>
          <kbd className={styles.footerKey()}>
            <CornerDownLeft />
          </kbd>
          Run
        </span>
        <span className={styles.footerHint()}>
          <kbd className={styles.footerKey()}>↑</kbd>
          <kbd className={styles.footerKey()}>↓</kbd>
          Navigate
        </span>
        <span className={styles.footerHint()}>
          <kbd className={styles.footerKey()}>esc</kbd>
          Close
        </span>
        <span className={styles.footerHint()}>
          <Search className="size-3" />
          {windows.length + available.length + 1}
        </span>
      </CommandFooter>
    </>
  );
}
