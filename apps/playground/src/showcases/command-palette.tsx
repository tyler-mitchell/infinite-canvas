import {
  getInfiniteCanvasContextualCommands,
  getInfiniteCanvasWindowPresence,
  useInfiniteCanvasActions,
  useInfiniteCanvasState,
  type InfiniteCanvasWindowPresenceItem,
} from "@infinite-canvas/react";
import { useEffect, useMemo, useRef, useState } from "react";

/**
 * A command palette over `getInfiniteCanvasContextualCommands`.
 *
 * That function has been public since the agent-handle work and **nothing consumed it**. Its
 * result already carries everything a palette needs — `label`, `description`, `hotkeys`,
 * `group`, and `enabled` computed against the live state — so this is roughly sixty lines over
 * an API that existed. The framework's whole command layer was documented and undiscoverable;
 * a palette makes it the former without making it the latter.
 *
 * Playground glue, not a framework export. A palette is UI, and this framework is headless.
 * What the framework owes it is the *vocabulary*, and that it already had.
 */

const PALETTE_HOTKEY = "k";

/**
 * Focus must go back to the canvas, never to `<body>`.
 *
 * The framework's own Close and Minimize controls hand focus back before they unmount, for
 * this exact reason: focus falling to `<body>` silently kills every hotkey, with nothing to
 * tell the user why. A palette that closes is the same unmount.
 */
const returnFocusToCanvas = (): void => {
  document.querySelector<HTMLElement>("[data-infinite-canvas-command-scope='surface']")?.focus();
};

type ContextualCommand = ReturnType<typeof getInfiniteCanvasContextualCommands>[number];

/**
 * One navigable row. A discriminated union rather than two parallel lists, so the arrow keys
 * traverse a single sequence and `Enter` has exactly one thing to do with whatever is selected.
 */
type PaletteEntry =
  | Readonly<{ command: ContextualCommand; kind: "command" }>
  | Readonly<{ kind: "window"; window: InfiniteCanvasWindowPresenceItem }>;

/**
 * A hotkey is a string like `"Mod+Shift+ArrowLeft"` **or** a parsed `{ key, mod, shift, … }`
 * object — `@tanstack/hotkeys` accepts either, so a descriptor may carry either. Rendering the
 * union straight into JSX prints `[object Object]` for the second, which is the sort of thing
 * that ships because nobody opens the route.
 */
const formatHotkey = (hotkey: ContextualCommand["hotkeys"][number]): string => {
  if (typeof hotkey === "string") {
    return hotkey;
  }

  return [
    hotkey.mod === true ? "Mod" : null,
    hotkey.ctrl === true ? "Ctrl" : null,
    hotkey.meta === true ? "Meta" : null,
    hotkey.alt === true ? "Alt" : null,
    hotkey.shift === true ? "Shift" : null,
    hotkey.key,
  ]
    .filter((part) => part !== null)
    .join("+");
};

const matches = (command: ContextualCommand, query: string): boolean => {
  if (query === "") {
    return true;
  }

  const haystack = `${command.label} ${command.description} ${command.id}`.toLowerCase();

  // Substring, not fuzzy. Fuzzy ranking is taste, and taste belongs to the consumer — which,
  // for this file, is the playground. A framework that shipped a matcher would be shipping an
  // opinion nobody asked for.
  return query
    .toLowerCase()
    .split(/\s+/)
    .every((term) => haystack.includes(term));
};

/**
 * Owns `Mod+K` and nothing else.
 *
 * The dialog is a separate component so that a **closed** palette holds no subscription. The
 * framework's own rule — subscribe to what you read, not to the state — applies to overlays
 * too: `useInfiniteCanvasState` re-renders on every camera tick, and a palette nobody has
 * opened has no business reconciling sixty times a second while you pan.
 *
 * Takes no props. `contextualCommands` on the overlay context is exactly
 * `getInfiniteCanvasContextualCommands(state)`, and both are public, so the palette does not
 * need the context — which also sidesteps its invariance in `Payload` and lets one component
 * mount inside any canvas on any route.
 */
export function CommandPalette() {
  const [isOpen, setIsOpen] = useState(false);

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      // `Mod+K` is not a chord the canvas owns, and every web application with a palette binds
      // it — which is the evidence that browsers let the page cancel it. `Mod+Alt+Arrow` is
      // not, and would have switched the browser's tab as well as running the command.
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === PALETTE_HOTKEY) {
        event.preventDefault();
        setIsOpen((open) => !open);
      }
    };

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
  const actions = useInfiniteCanvasActions();
  const [query, setQuery] = useState("");
  const [selectedIndex, setSelectedIndex] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  const contextualCommands = useMemo(() => getInfiniteCanvasContextualCommands(state), [state]);
  const filtered = contextualCommands.filter((command) => matches(command, query));
  // Available first, and only the available ones are navigable. Hiding the rest would make the
  // palette lie about what the framework can do; letting you run them would make it lie about
  // what it can do *now*. Showing them, greyed and inert, is the only version that teaches.
  const available = filtered.filter((command) => command.enabled);
  const unavailable = filtered.filter((command) => !command.enabled);

  /**
   * The switcher half. `getInfiniteCanvasWindowPresence` has been public all along and this is
   * the first thing to enumerate windows for navigation — the minimap answers "where am I"
   * geometrically and the offscreen indicators answer it peripherally, but neither answers
   * "where is the window called Notes", which is the question you actually have at 160 windows.
   *
   * Windows rank **above** commands, including on an empty query. In a spatial canvas the
   * common intent is "take me to X", and it was until now the one thing the palette could not
   * do. Sorted by stack order, so the palette agrees with what is on top.
   */
  const windows = useMemo(
    () =>
      getInfiniteCanvasWindowPresence(state).windows.filter(
        (window) => query === "" || window.title.toLowerCase().includes(query.toLowerCase()),
      ),
    [query, state],
  );

  // One flat navigable list so Arrow keys cross the section boundary without the user having to
  // know there is one. Two independent indices would make Down stop dead at the end of a
  // section, which is the sort of thing that reads as a bug rather than as a design.
  const entries: readonly PaletteEntry[] = [
    ...windows.map((window) => ({ kind: "window" as const, window })),
    ...available.map((command) => ({ command, kind: "command" as const })),
  ];
  const active = entries[Math.min(selectedIndex, entries.length - 1)];

  const runEntry = (entry: PaletteEntry) => {
    if (entry.kind === "command") {
      actions.executeCommand(entry.command.command);
    } else {
      // A minimized window has no rect to navigate to, so restore before focusing — otherwise
      // the camera flies to where the window is not, which is worse than not moving.
      if (entry.window.mode === "minimized") {
        actions.restoreWindow(entry.window.id);
      }

      actions.focusWindow(entry.window.id);
      actions.navigateToWindow({ windowId: entry.window.id });
    }

    onClose();
  };

  return (
    <div
      className="pointer-events-auto absolute inset-0 z-[100] flex items-start justify-center bg-black/40 pt-24 backdrop-blur-[2px]"
      onPointerDown={(event) => {
        // The overlay is inside the canvas's React tree, so a pointerdown here bubbles to the
        // canvas root, which would read it as an empty-canvas gesture and start a marquee
        // behind the palette. Nothing in the canvas should hear a click on a modal.
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
              // The canvas binds bare arrows to nudge. It ignores anything from an `input`
              // (`ignoreInputs`, and `input` is in its exclusion selector), so this steals
              // nothing — but `preventDefault` still stops the caret from jumping.
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
