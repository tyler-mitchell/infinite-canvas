import { Dialog } from "@base-ui/react/dialog";
import { observer } from "@legendapp/state/react";
import { useHotkey } from "@tanstack/react-hotkeys";
import { useId, useState } from "react";
import type { Canvas } from "@hyphened/infinite-canvas";
import { CommandTrigger } from "@hyphened/infinite-canvas/react";

export const CanvasCommands = observer(function CanvasCommands({ canvas }: { canvas: Canvas }) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [selectedIndex, setSelectedIndex] = useState(0);
  const listId = useId();
  useHotkey("Mod+K", () => setOpen((value) => !value));
  const activeWindowId = canvas.computed.view.activeWindowId.get();
  const windowIds = canvas.computed.selectedWindows.map((window) => window.id.get());
  const containerIds = canvas.computed.selectedWindows
    .filter((window) => window.layout.get() !== undefined)
    .map((window) => window.id.get());
  const entries = [
    ...canvas.computed.workspaceWindows.map((window) => ({
      id: `window:${window.id.get()}`,
      label: window.title.get(),
      enabled: true,
      run: () => canvas.commands.revealWindow.run({ window: window.id.peek() }),
    })),
    ...[
      canvas.commands.fitAll,
      canvas.commands.fitSelection,
      canvas.commands.undo,
      canvas.commands.redo,
    ].map((command) => ({
      id: command.action,
      label: command.label,
      enabled: command.canRun({}),
      run: () => command.run({}),
    })),
    ...[
      canvas.commands.minimizeWindow,
      canvas.commands.maximizeWindow,
      canvas.commands.restoreWindow,
      canvas.commands.closeWindow,
    ].map((command) => ({
      id: command.action,
      label: command.label,
      enabled: command.canRun({ window: activeWindowId ?? "" }),
      run: () => command.run({ window: activeWindowId ?? "" }),
    })),
    ...Object.keys(canvas.configuration.layouts).map((type) => {
      const input = { windows: windowIds, layout: { type } };
      return {
        id: `groupWindows:${type}`,
        label: `Group as ${type}`,
        enabled: canvas.commands.groupWindows.canRun(input),
        run: () => canvas.commands.groupWindows.run(input),
      };
    }),
    ...containerIds.map((window) => ({
      id: `ungroupWindow:${window}`,
      label: "Ungroup",
      enabled: canvas.commands.ungroupWindow.canRun({ window }),
      run: () => canvas.commands.ungroupWindow.run({ window }),
    })),
  ].filter((entry) =>
    query
      .toLowerCase()
      .split(/\s+/)
      .every((term) => entry.label.toLowerCase().includes(term)),
  );
  const available = entries.filter((entry) => entry.enabled);
  const active = available[Math.min(selectedIndex, available.length - 1)];
  const close = () => {
    setOpen(false);
    setQuery("");
    setSelectedIndex(0);
  };
  return (
    <>
      <div
        data-canvas-control
        className="absolute top-4 left-4 z-70 flex gap-2 border border-white/10 bg-black/90 p-2 text-xs"
      >
        {[
          canvas.commands.fitAll,
          canvas.commands.fitSelection,
          canvas.commands.undo,
          canvas.commands.redo,
        ].map((command) => (
          <CommandTrigger key={command.action} command={command} input={{}} />
        ))}
        <button onClick={() => setOpen(true)}>Commands</button>
        <span>{canvas.computed.selectedWindows.length} selected</span>
      </div>
      <Dialog.Root
        open={open}
        onOpenChange={(value) => {
          if (value) setOpen(true);
          else close();
        }}
      >
        <Dialog.Portal>
          <Dialog.Backdrop className="fixed inset-0 z-90 bg-black/50" />
          <Dialog.Popup className="fixed top-24 left-1/2 z-100 w-[min(32rem,90vw)] -translate-x-1/2 rounded-xl border border-white/15 bg-neutral-950 p-3 text-white shadow-2xl">
            <Dialog.Title className="sr-only">Windows and commands</Dialog.Title>
            <input
              autoFocus
              role="combobox"
              aria-label="Search windows and commands"
              aria-expanded="true"
              aria-controls={listId}
              aria-activedescendant={active === undefined ? undefined : `${listId}-${active.id}`}
              className="w-full border-b border-white/10 bg-transparent px-3 py-3 outline-none"
              placeholder="Search windows and commands…"
              value={query}
              onChange={(event) => {
                setQuery(event.target.value);
                setSelectedIndex(0);
              }}
              onKeyDown={(event) => {
                if (event.key === "ArrowDown" || event.key === "ArrowUp") {
                  event.preventDefault();
                  setSelectedIndex((index) =>
                    Math.max(
                      0,
                      Math.min(available.length - 1, index + (event.key === "ArrowDown" ? 1 : -1)),
                    ),
                  );
                }
                if (event.key === "Enter" && active !== undefined) {
                  event.preventDefault();
                  void active.run();
                  close();
                }
              }}
            />
            <div
              id={listId}
              role="listbox"
              aria-label="Windows and commands"
              className="max-h-80 overflow-auto py-2"
            >
              {entries.map((entry) => (
                <button
                  key={entry.id}
                  id={`${listId}-${entry.id}`}
                  role="option"
                  aria-selected={active?.id === entry.id}
                  disabled={!entry.enabled}
                  className="block w-full rounded px-3 py-2 text-left text-sm aria-selected:bg-white/10 disabled:opacity-35"
                  onClick={() => {
                    void entry.run();
                    close();
                  }}
                >
                  {entry.label}
                </button>
              ))}
              {entries.length === 0 && <p className="p-3 text-sm text-white/50">No matches.</p>}
            </div>
            <Dialog.Close className="sr-only">Close</Dialog.Close>
          </Dialog.Popup>
        </Dialog.Portal>
      </Dialog.Root>
    </>
  );
});
