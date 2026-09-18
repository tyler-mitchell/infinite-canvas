import {
  getInfiniteCanvasContextualCommands,
  getInfiniteCanvasWindowPresence,
  useInfiniteCanvasDispatch,
  useInfiniteCanvasState,
  type InfiniteCanvasWindowPresenceItem,
} from "@hyphened/infinite-canvas";
import { createHotkeyHandler, formatForDisplay } from "@tanstack/hotkeys";
import { useEffect, useMemo, useRef, useState } from "react";

const PALETTE_HOTKEY = "Mod+K";

/** This function returns focus to the canvas so its hotkeys stay active. */
const returnFocusToCanvas = (): void => {
  document.querySelector<HTMLElement>("[data-infinite-canvas-command-scope='surface']")?.focus();
};

type ContextualCommand = ReturnType<typeof getInfiniteCanvasContextualCommands>[number];

type PaletteEntry =
  | Readonly<{ command: ContextualCommand; kind: "command" }>
  | Readonly<{ kind: "window"; window: InfiniteCanvasWindowPresenceItem }>;

const formatHotkey = (hotkey: ContextualCommand["hotkeys"][number]): string =>
  formatForDisplay(hotkey);

const matches = (command: ContextualCommand, query: string): boolean => {
  if (query === "") {
    return true;
  }

  const haystack = `${command.label} ${command.description} ${command.id}`.toLowerCase();

  return query
    .toLowerCase()
    .split(/\s+/)
    .every((term) => haystack.includes(term));
};

/** The palette subscribes to canvas state only while it is open. */
export function CommandPalette() {
  const [isOpen, setIsOpen] = useState(false);

  useEffect(() => {
    // The hotkey package resolves Mod and requires exact modifiers.
    const handleKeyDown = createHotkeyHandler(PALETTE_HOTKEY, (event) => {
      event.preventDefault();
      setIsOpen((open) => !open);
    });

    window.addEventListener("keydown", handleKeyDown);

    return () => {
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, []);

  return isOpen ? (
    <CommandPaletteDialog
      onClose={() => {
        setIsOpen(false);
        returnFocusToCanvas();
      }}
    />
  ) : null;
}

function CommandPaletteDialog({ onClose }: { onClose: () => void }) {
  const state = useInfiniteCanvasState();
  const dispatch = useInfiniteCanvasDispatch();
  const [query, setQuery] = useState("");
  const [selectedIndex, setSelectedIndex] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  const contextualCommands = useMemo(() => getInfiniteCanvasContextualCommands(state), [state]);
  const filtered = contextualCommands.filter((command) => matches(command, query));
  // Only enabled commands can enter the keyboard navigation list.
  const available = filtered.filter((command) => command.enabled);
  const unavailable = filtered.filter((command) => !command.enabled);

  /** The keyboard navigation list puts windows before commands. */
  const windows = useMemo(
    () =>
      getInfiniteCanvasWindowPresence(state).windows.filter(
        (window) => query === "" || window.title.toLowerCase().includes(query.toLowerCase()),
      ),
    [query, state],
  );

  // One list lets arrow keys move across both sections.
  const entries: readonly PaletteEntry[] = [
    ...windows.map((window) => ({ kind: "window" as const, window })),
    ...available.map((command) => ({ command, kind: "command" as const })),
  ];
  const active = entries[Math.min(selectedIndex, entries.length - 1)];

  const runEntry = (entry: PaletteEntry) => {
    if (entry.kind === "command") {
      dispatch(entry.command.command);
    } else {
      // The palette restores minimized windows before camera navigation.
      if (entry.window.mode === "minimized") {
        dispatch({ type: "window.restore", windowId: entry.window.id });
      }

      dispatch({ type: "window.focus", windowId: entry.window.id });
      dispatch({
        request: { target: { type: "window", windowId: entry.window.id } },
        type: "camera.navigate",
      });
    }

    onClose();
  };

  return (
    <div
      className="pointer-events-auto absolute inset-0 z-[100] flex items-start justify-center bg-black/40 pt-24 backdrop-blur-[2px]"
      onPointerDown={(event) => {
        // stopPropagation blocks the modal event before the canvas can start a marquee.
        event.stopPropagation();

        if (event.target === event.currentTarget) {
          onClose();
        }
      }}
    >
      <div className="w-[min(32rem,90vw)] overflow-hidden rounded-xl border border-border bg-popover shadow-2xl">
        <input
          className="w-full border-b border-border bg-transparent px-4 py-3 text-sm text-foreground outline-none placeholder:text-muted-foreground"
          onChange={(event) => {
            setQuery(event.target.value);
            setSelectedIndex(0);
          }}
          onKeyDown={(event) => {
            if (event.key === "Escape") {
              onClose();
              return;
            }

            if (event.key === "Enter" && active !== undefined) {
              runEntry(active);
              return;
            }

            if (event.key === "ArrowDown" || event.key === "ArrowUp") {
              // preventDefault stops caret movement while the canvas ignores input events.
              event.preventDefault();
              setSelectedIndex((index) => {
                const next = event.key === "ArrowDown" ? index + 1 : index - 1;
                return Math.max(0, Math.min(next, entries.length - 1));
              });
            }
          }}
          placeholder="Search windows and commands…"
          ref={inputRef}
          value={query}
        />

        <div className="max-h-80 overflow-y-auto p-1.5">
          {entries.length === 0 && unavailable.length === 0 ? (
            <p className="px-3 py-6 text-center text-xs text-muted-foreground">
              Nothing matches “{query}”.
            </p>
          ) : null}

          {windows.length === 0 ? null : (
            <div className="px-3 pt-1 pb-1 font-mono text-[9px] tracking-widest text-muted-foreground uppercase">
              windows
            </div>
          )}

          {windows.map((window, index) => (
            <button
              className={[
                "flex w-full items-center justify-between gap-3 rounded-md px-3 py-2 text-left",
                index === Math.min(selectedIndex, entries.length - 1)
                  ? "bg-accent text-accent-foreground"
                  : "text-foreground/80",
              ].join(" ")}
              key={window.id}
              onClick={() => {
                runEntry({ kind: "window", window });
              }}
              onPointerEnter={() => {
                setSelectedIndex(index);
              }}
              type="button"
            >
              <span className="grid gap-0.5">
                <span className="text-xs font-medium">{window.title}</span>
                <span className="text-[10px] text-muted-foreground">{window.kind}</span>
              </span>
              <span className="flex shrink-0 gap-1.5 font-mono text-[9px] text-muted-foreground">
                {window.isActive ? <span className="text-emerald-300/80">active</span> : null}
                {window.mode === "minimized" ? <span>minimized</span> : null}
              </span>
            </button>
          ))}

          {available.length === 0 ? null : (
            <div className="px-3 pt-3 pb-1 font-mono text-[9px] tracking-widest text-muted-foreground uppercase">
              commands
            </div>
          )}

          {available.map((command, commandIndex) => (
            <button
              className={[
                "flex w-full items-center justify-between gap-3 rounded-md px-3 py-2 text-left",
                windows.length + commandIndex === Math.min(selectedIndex, entries.length - 1)
                  ? "bg-accent text-accent-foreground"
                  : "text-foreground/80",
              ].join(" ")}
              key={command.id}
              onClick={() => {
                runEntry({ command, kind: "command" });
              }}
              onPointerEnter={() => {
                setSelectedIndex(windows.length + commandIndex);
              }}
              type="button"
            >
              <span className="grid gap-0.5">
                <span className="text-xs font-medium">{command.label}</span>
                <span className="text-[10px] text-muted-foreground">{command.description}</span>
              </span>
              <span className="flex shrink-0 gap-1">
                {command.hotkeys.map(formatHotkey).map((hotkey) => (
                  <kbd
                    className="rounded border border-border bg-card px-1.5 py-0.5 font-mono text-[9px] text-muted-foreground"
                    key={hotkey}
                  >
                    {hotkey}
                  </kbd>
                ))}
              </span>
            </button>
          ))}

          {unavailable.length === 0 ? null : (
            <>
              <div className="px-3 pt-3 pb-1 font-mono text-[9px] tracking-widest text-muted-foreground uppercase">
                unavailable right now
              </div>
              {unavailable.map((command) => (
                <div
                  aria-disabled="true"
                  className="flex w-full items-center justify-between gap-3 rounded-md px-3 py-2 text-left opacity-40"
                  key={command.id}
                >
                  <span className="grid gap-0.5">
                    <span className="text-xs font-medium">{command.label}</span>
                    <span className="text-[10px] text-muted-foreground">{command.description}</span>
                  </span>
                </div>
              ))}
            </>
          )}
        </div>
      </div>
    </div>
  );
}
