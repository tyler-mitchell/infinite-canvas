import type { InfiniteCanvasOverlayRenderContext } from "@infinite-canvas/react";
import { useEffect, useRef, useState } from "react";

/**
 * A command palette over `context.contextualCommands`.
 *
 * That array has been public since the agent-handle work and **nothing consumed it**. It
 * already carries everything a palette needs — `label`, `description`, `hotkeys`, `group`, and
 * `enabled` computed against the live state — so this is roughly sixty lines over an API that
 * existed. The framework's whole command layer was documented and undiscoverable; a palette
 * makes it the former without making it the latter.
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

type ContextualCommand = InfiniteCanvasOverlayRenderContext["contextualCommands"][number];

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
 * Generic in `Kind` deliberately. `InfiniteCanvasOverlayRenderContext<K>` is invariant in `K`
 * because `actions` *takes* windows of that kind, so a `<"pane">` context does not assign to
 * the erased one — the same variance that forced the framework to split
 * `InfiniteCanvasOverlayReadContext` out. A palette needs `actions.executeCommand`, which
 * lives on the write half, so it takes the parameter rather than the erasure.
 */
export function CommandPalette<Kind extends string>({
  context,
}: {
  context: InfiniteCanvasOverlayRenderContext<Kind>;
}) {
  const [isOpen, setIsOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [selectedIndex, setSelectedIndex] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      // `Mod+K` is not a chord the canvas owns, and every web application with a palette binds
      // it — which is the evidence that browsers let the page cancel it. `Mod+Alt+Arrow` is
      // not, and would have switched the browser's tab as well as running the command.
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === PALETTE_HOTKEY) {
        event.preventDefault();
        setIsOpen((open) => !open);
        setQuery("");
        setSelectedIndex(0);
      }
    };

    window.addEventListener("keydown", handleKeyDown);

    return () => {
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, []);

  useEffect(() => {
    if (isOpen) {
      inputRef.current?.focus();
    }
  }, [isOpen]);

  if (!isOpen) {
    return null;
  }

  const filtered = context.contextualCommands.filter((command) => matches(command, query));
  // Available first, and only the available ones are navigable. Hiding the rest would make the
  // palette lie about what the framework can do; letting you run them would make it lie about
  // what it can do *now*. Showing them, greyed and inert, is the only version that teaches.
  const available = filtered.filter((command) => command.enabled);
  const unavailable = filtered.filter((command) => !command.enabled);
  const active = available[Math.min(selectedIndex, available.length - 1)];

  const close = () => {
    setIsOpen(false);
    returnFocusToCanvas();
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
          close();
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
              close();
              return;
            }

            if (event.key === "Enter" && active !== undefined) {
              context.actions.executeCommand(active.command);
              close();
              return;
            }

            if (event.key === "ArrowDown" || event.key === "ArrowUp") {
              // The canvas binds bare arrows to nudge. It ignores anything from an `input`
              // (`ignoreInputs`, and `input` is in its exclusion selector), so this steals
              // nothing — but `preventDefault` still stops the caret from jumping.
              event.preventDefault();
              setSelectedIndex((index) => {
                const next = event.key === "ArrowDown" ? index + 1 : index - 1;
                return Math.max(0, Math.min(next, available.length - 1));
              });
            }
          }}
          placeholder="Search commands…"
          ref={inputRef}
          value={query}
        />

        <div className="max-h-80 overflow-y-auto p-1.5">
          {available.length === 0 && unavailable.length === 0 ? (
            <p className="px-3 py-6 text-center text-xs text-muted-foreground">
              No command matches “{query}”.
            </p>
          ) : null}

          {available.map((command, index) => (
            <button
              className={[
                "flex w-full items-center justify-between gap-3 rounded-md px-3 py-2 text-left",
                index === Math.min(selectedIndex, available.length - 1)
                  ? "bg-accent text-accent-foreground"
                  : "text-foreground/80",
              ].join(" ")}
              key={command.id}
              onClick={() => {
                context.actions.executeCommand(command.command);
                close();
              }}
              onPointerEnter={() => {
                setSelectedIndex(index);
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
