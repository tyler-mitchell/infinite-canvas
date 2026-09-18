import { createFileRoute } from "@tanstack/react-router";
import type { Observable } from "@legendapp/state";
import { observer } from "@legendapp/state/react";
import { useState } from "react";
import { createCanvasState, type Canvas, type WindowState } from "@hyphened/infinite-canvas/next";
import {
  CanvasTools,
  CanvasViewport,
  WindowDragHandle,
} from "@hyphened/infinite-canvas/next/react";
import "@hyphened/infinite-canvas/next/theme.css";
import { CanvasCommands } from "../showcases/canvas-commands";
import { WindowControls } from "../showcases/sample-canvas";

export const Route = createFileRoute("/custom-frames")({
  component: CustomFramesShowcase,
  staticData: {
    showcase: {
      description: "Application-owned window presentation with shared canvas interaction.",
      order: 2,
      title: "Custom windows",
    },
  },
});

const CustomWindow = observer(function CustomWindow({
  canvas,
  window,
}: {
  canvas: Canvas;
  window: Observable<WindowState>;
}) {
  const id = window.id.get();
  const kind = window.kind.get();
  const active = canvas.computed.view.activeWindowId.get() === id;
  const selected = canvas.computed.selection.targets[`window:${id}`].get() !== undefined;
  if (kind === "terminal")
    return (
      <section
        data-active={active || undefined}
        className="flex h-full flex-col overflow-hidden rounded-md border border-emerald-300/25 bg-[#04110b] shadow-xl data-active:ring-1 data-active:ring-emerald-300/35"
      >
        <WindowDragHandle className="flex h-9 shrink-0 items-center justify-between border-b border-emerald-300/20 bg-[#06281b]/80 px-3">
          <div className="flex min-w-0 items-center gap-2">
            <span
              className={`size-2 shrink-0 rounded-full ${active ? "bg-emerald-300" : "bg-emerald-300/30"}`}
            />
            <span className="font-mono text-xs text-emerald-100/75">{window.title.get()}</span>
          </div>
          <WindowControls canvas={canvas} window={window} />
        </WindowDragHandle>
        <div
          data-canvas-scroll="native"
          className="min-h-0 flex-1 space-y-1.5 overflow-auto p-4 font-mono text-[11px] text-emerald-100/60"
        >
          {[
            "The application supplies the surface and title.",
            "WindowDragHandle connects pointer input to the model.",
            "Controls call the same commands as agent tools.",
            "Content keeps its own DOM and local state.",
          ].map((line) => (
            <p key={line}>
              <span className="text-emerald-300/50">$ </span>
              {line}
            </p>
          ))}
        </div>
      </section>
    );
  if (kind === "signal")
    return (
      <section
        data-selected={selected || undefined}
        className="flex h-full flex-col overflow-hidden rounded-xl border border-violet-300/25 bg-[#0b0816] shadow-xl data-selected:ring-1 data-selected:ring-violet-300/35"
      >
        <WindowDragHandle className="relative flex h-10 shrink-0 items-center justify-center border-b border-violet-300/15">
          <span className="text-[10px] tracking-[0.2em] text-violet-200/60">
            {window.title.get()}
          </span>
          <div className="absolute right-2">
            <WindowControls canvas={canvas} window={window} />
          </div>
        </WindowDragHandle>
        <div
          data-canvas-scroll="native"
          className="grid min-h-0 flex-1 content-start grid-cols-2 gap-2 overflow-auto p-4"
        >
          {["alpha", "beta", "gamma", "delta"].map((channel, index) => (
            <div
              key={channel}
              className="rounded-sm border border-violet-200/15 bg-violet-200/[0.04] p-3"
            >
              <div className="font-mono text-[9px] uppercase tracking-widest text-violet-200/50">
                {channel}
              </div>
              <div className="mt-1.5 font-mono text-sm text-violet-100/80">
                {String(57 + index * 31).padStart(3, "0")}
              </div>
            </div>
          ))}
        </div>
      </section>
    );
  return (
    <section className="flex h-full flex-col border border-white/20 bg-neutral-900">
      <WindowDragHandle className="flex h-9 shrink-0 items-center justify-between border-b border-white/10 px-3">
        <span className="text-xs">{window.title.get()}</span>
        <WindowControls canvas={canvas} window={window} />
      </WindowDragHandle>
      <p className="p-4 text-xs leading-relaxed text-white/60">
        Each presentation uses the same camera, selection, movement, and resize operations.
      </p>
    </section>
  );
});

function CustomFramesShowcase() {
  const [canvas] = useState(() =>
    createCanvasState({
      windowDefinitions: { default: {}, signal: {}, terminal: {} },
      document: {
        canvasView: {
          camera: { center: { x: 330, y: 170 }, zoom: 0.85 },
          stackingOrder: ["window:default-1", "window:signal-1", "window:terminal-1"],
        },
        content: {
          windows: {
            "terminal-1": {
              kind: "terminal",
              title: "ops/tail",
              rect: { x: 20, y: 20, width: 430, height: 280 },
            },
            "signal-1": {
              kind: "signal",
              title: "Signal monitor",
              rect: { x: 510, y: 90, width: 360, height: 280 },
            },
            "default-1": {
              kind: "default",
              title: "Plain window",
              rect: { x: 200, y: 360, width: 340, height: 220 },
            },
          },
        },
      },
    }),
  );
  return (
    <div className="absolute inset-0">
      <CanvasViewport
        canvas={canvas}
        emptyCanvasDrag="marquee"
        className="[&_[data-slot=canvas-window]]:bg-transparent [&_[data-slot=canvas-window]]:shadow-none"
        renderWindow={(window) => <CustomWindow canvas={canvas} window={window} />}
      >
        <CanvasCommands canvas={canvas} />
        <CanvasTools canvas={canvas} />
      </CanvasViewport>
    </div>
  );
}
