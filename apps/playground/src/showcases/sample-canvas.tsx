import type { Observable } from "@legendapp/state";
import { observer } from "@legendapp/state/react";
import { Maximize2, Minus, Pin, X } from "lucide-react";
import type { ComponentType } from "react";
import { createCanvasState, type Canvas, type WindowState } from "@hyphened/infinite-canvas/next";
import {
  CommandTrigger,
  WindowDragHandle,
  useWindowDetail,
} from "@hyphened/infinite-canvas/next/react";

export function createSampleCanvas() {
  return createCanvasState({
    windowDefinitions: {
      archive: { minSize: { width: 320, height: 240 } },
      log: { minSize: { width: 360, height: 260 } },
      control: { minSize: { width: 360, height: 280 } },
    },
    document: {
      content: {
        windows: {
          "archive-window": {
            kind: "archive",
            title: "archive.index",
            rect: { x: -460, y: -220, width: 420, height: 320 },
          },
          "log-window": {
            kind: "log",
            title: "ops.event-stream",
            rect: { x: -80, y: 110, width: 470, height: 360 },
          },
          "control-window": {
            kind: "control",
            title: "runtime.controls",
            isPinned: true,
            rect: { x: 310, y: -120, width: 440, height: 340 },
          },
        },
      },
      canvasView: {
        activeWindowId: "control-window",
        stackingOrder: ["window:archive-window", "window:log-window", "window:control-window"],
      },
    },
  });
}

const buttonClass =
  "border border-white/10 bg-white/[0.04] px-3 py-2 text-left text-[11px] uppercase text-white/65 hover:bg-white/[0.08] disabled:opacity-35";

const ArchiveContent = () => (
  <div className="grid content-start gap-3 p-4 text-xs leading-relaxed text-white/65">
    <h2 className="text-[10px] uppercase text-cyan-100/80">Source surfaces</h2>
    {[
      "Window content uses normal React DOM.",
      "The canvas model owns geometry, selection, and interaction.",
      "The application supplies each window’s content and controls.",
    ].map((item) => (
      <p className="border-l border-cyan-100/25 bg-white/[0.035] px-3 py-2" key={item}>
        {item}
      </p>
    ))}
  </div>
);

const LogContent = () => (
  <div className="space-y-2 p-4 font-mono text-[11px] leading-relaxed text-white/60">
    {[
      "[state] document records and view state have separate owners",
      "[layout] world rectangles use one camera transform",
      "[input] pointer capture starts at the DOM boundary",
      "[history] document edits support undo and redo",
      "[content] each window renders application content",
    ].map((line) => (
      <p className="border-b border-white/10 pb-2" key={line}>
        {line}
      </p>
    ))}
  </div>
);

const ControlContent = observer(function ControlContent({
  canvas,
  window,
}: {
  canvas: Canvas;
  window: Observable<WindowState>;
}) {
  const id = window.id.get();
  const maximized = window.mode.get() === "maximized";
  const maximize = maximized ? canvas.commands.restoreWindow : canvas.commands.maximizeWindow;
  const scratch = {
    id: "scratch-window",
    kind: "archive",
    title: "scratch.note",
    rect: { x: 120, y: 240, width: 360, height: 280 },
  };
  return (
    <div className="flex flex-col gap-4 p-4 text-xs text-white/65">
      <h2 className="text-[10px] uppercase text-amber-200/80">Runtime controls</h2>
      <p>The application owns this content and calls the canvas commands.</p>
      <div className="grid grid-cols-2 gap-2">
        <CommandTrigger
          className={buttonClass}
          command={canvas.commands.pinWindow}
          input={{ window: id, isPinned: !window.isPinned.get() }}
        >
          {window.isPinned.get() ? "Unpin" : "Pin"}
        </CommandTrigger>
        <CommandTrigger
          className={buttonClass}
          command={canvas.commands.revealWindow}
          input={{ window: "log-window" }}
        >
          Focus log
        </CommandTrigger>
        <CommandTrigger className={buttonClass} command={maximize} input={{ window: id }}>
          {maximized ? "Restore" : "Maximize"}
        </CommandTrigger>
        <CommandTrigger className={buttonClass} command={canvas.commands.fitAll} input={{}}>
          Fit all
        </CommandTrigger>
        <CommandTrigger className={buttonClass} command={canvas.commands.fitSelection} input={{}}>
          Fit selection
        </CommandTrigger>
        <CommandTrigger
          className={buttonClass}
          command={canvas.commands.navigateCamera}
          input={{
            target: { type: "point", point: { x: 0, y: 0 } },
            behavior: { type: "centerAtZoom", zoom: 0.8 },
          }}
        >
          Center origin
        </CommandTrigger>
        <CommandTrigger
          className={buttonClass}
          command={canvas.commands.openWindow}
          input={scratch}
        >
          Open note
        </CommandTrigger>
      </div>
      <p className="border border-white/10 p-3 text-[11px] text-white/45">
        Active: {canvas.computed.view.activeWindowId.get() === id ? "yes" : "no"} ·{" "}
        {window.isPinned.get() ? "Pinned" : "Unpinned"}
      </p>
    </div>
  );
});

const content: Record<
  string,
  ComponentType<{ canvas: Canvas; window: Observable<WindowState> }>
> = {
  archive: ArchiveContent,
  log: LogContent,
  control: ControlContent,
};

export const WindowControls = observer(function WindowControls({
  canvas,
  window,
}: {
  canvas: Canvas;
  window: Observable<WindowState>;
}) {
  const id = window.id.get();
  const maximize =
    window.mode.get() === "maximized"
      ? canvas.commands.restoreWindow
      : canvas.commands.maximizeWindow;
  return (
    <div className="flex gap-2 [&_button]:cursor-pointer [&_button:disabled]:opacity-30 [&_svg]:size-3">
      <CommandTrigger
        command={canvas.commands.pinWindow}
        input={{ window: id, isPinned: !window.isPinned.get() }}
        aria-label={window.isPinned.get() ? "Unpin" : "Pin"}
        aria-pressed={window.isPinned.get()}
      >
        <Pin />
      </CommandTrigger>
      <CommandTrigger
        command={canvas.commands.minimizeWindow}
        input={{ window: id }}
        aria-label="Minimize"
      >
        <Minus />
      </CommandTrigger>
      <CommandTrigger command={maximize} input={{ window: id }} aria-label={maximize.label}>
        <Maximize2 />
      </CommandTrigger>
      <CommandTrigger
        command={canvas.commands.closeWindow}
        input={{ window: id }}
        aria-label="Close"
      >
        <X />
      </CommandTrigger>
    </div>
  );
});

export const SampleWindow = observer(function SampleWindow({
  canvas,
  window,
}: {
  canvas: Canvas;
  window: Observable<WindowState>;
}) {
  const kind = window.kind.get();
  const Content = kind === undefined ? undefined : content[kind];
  const detail = useWindowDetail();
  if (detail === "summary")
    return (
      <WindowDragHandle
        data-detail="summary"
        className="grid h-full place-items-center p-4 text-center font-mono text-4xl"
      >
        {window.title.get()}
      </WindowDragHandle>
    );
  return (
    <>
      <WindowDragHandle className="flex min-h-9 shrink-0 items-center justify-between border-b border-white/10 px-3">
        <span className="truncate font-mono text-[11px]">{window.title.get()}</span>
        <WindowControls canvas={canvas} window={window} />
      </WindowDragHandle>
      {kind !== undefined && (
        <div className="min-h-0 flex-1 overflow-auto" data-canvas-scroll="native">
          {Content === undefined ? (
            <p className="p-4">Unknown window kind: {kind}</p>
          ) : (
            <Content canvas={canvas} window={window} />
          )}
        </div>
      )}
    </>
  );
});

export const SampleDock = observer(function SampleDock({ canvas }: { canvas: Canvas }) {
  const windows = canvas.computed.workspaceWindows.filter(
    (window) => window.isPinned.get() || window.mode.get() === "minimized",
  );
  if (windows.length === 0) return null;
  return (
    <nav
      aria-label="Window dock"
      data-canvas-control
      className="absolute bottom-4 left-4 z-70 grid min-w-56 gap-1 border border-white/10 bg-black/90 p-2"
    >
      <h2 className="px-1 text-[9px] uppercase text-white/40">Dock</h2>
      {windows.map((window) => (
        <CommandTrigger
          key={window.id.get()}
          className={buttonClass}
          command={canvas.commands.revealWindow}
          input={{ window: window.id.get() }}
          aria-pressed={canvas.computed.view.activeWindowId.get() === window.id.get()}
        >
          {window.title.get()} · {window.mode.get() === "minimized" ? "Restore" : "Pinned"}
        </CommandTrigger>
      ))}
    </nav>
  );
});
