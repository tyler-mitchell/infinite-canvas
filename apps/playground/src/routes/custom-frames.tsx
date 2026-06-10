import { createFileRoute } from "@tanstack/react-router";
import {
  createInfiniteCanvasState,
  createInfiniteCanvasWindow,
  defineInfiniteCanvasWindowRegistry,
  InfiniteCanvasDesktop,
  type InfiniteCanvasWindowFrameRenderContext,
} from "infinite-canvas";
import { exposeCanvasDevHandle } from "../showcases/dev-handle.ts";

export const Route = createFileRoute("/custom-frames")({
  component: CustomFramesShowcase,
  staticData: {
    showcase: {
      description: "renderFrame slots: custom chrome, framework interaction.",
      order: 2,
      title: "Custom frames",
    },
  },
});

type FrameKind = "default" | "signal" | "terminal";

const initialState = createInfiniteCanvasState<FrameKind>({
  camera: { center: { x: 330, y: 170 }, zoom: 0.85 },
  windows: [
    createInfiniteCanvasWindow({
      id: "terminal-1",
      kind: "terminal",
      rect: { height: 280, width: 430, x: 20, y: 20 },
      title: "ops/tail",
      zIndex: 2,
    }),
    createInfiniteCanvasWindow({
      id: "signal-1",
      kind: "signal",
      rect: { height: 280, width: 360, x: 510, y: 90 },
      title: "Signal Monitor",
      zIndex: 1,
    }),
    createInfiniteCanvasWindow({
      id: "default-1",
      kind: "default",
      rect: { height: 220, width: 340, x: 200, y: 360 },
      title: "Default chrome",
      zIndex: 0,
    }),
  ],
});

const registry = defineInfiniteCanvasWindowRegistry<FrameKind>({
  default: {
    kind: "default",
    overflowY: "auto",
    renderBody: () => (
      <div className="p-4 text-xs leading-relaxed text-white/60">
        This window keeps the built-in frame. Custom and default chrome share one world, one
        interaction system, one stacking model.
      </div>
    ),
  },
  signal: {
    kind: "signal",
    overflowY: "auto",
    renderBody: () => (
      <div className="grid grid-cols-2 gap-2 p-4">
        {["alpha", "beta", "gamma", "delta"].map((channel, index) => (
          <div
            className="rounded-sm border border-violet-200/15 bg-violet-200/[0.04] p-3"
            key={channel}
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
    ),
    renderFrame: renderSignalFrame,
  },
  terminal: {
    kind: "terminal",
    overflowY: "auto",
    renderBody: () => (
      <div className="space-y-1.5 p-4 font-mono text-[11px] text-emerald-100/60">
        {[
          "frame.Surface keeps the window in the DOM projection layer",
          "frame.Header keeps drag, focus, and selection wiring",
          "frame.Controls keeps pin/minimize/maximize/close actions",
          "frame.Body keeps raster + pointer policy contained",
        ].map((line) => (
          <div key={line}>
            <span className="text-emerald-300/50">$ </span>
            {line}
          </div>
        ))}
      </div>
    ),
    renderFrame: renderTerminalFrame,
  },
});

function renderTerminalFrame({
  frame,
  isActive,
  window,
}: InfiniteCanvasWindowFrameRenderContext<FrameKind>) {
  const { ActiveCorners, Body, Controls, Header, Surface, Title } = frame;

  return (
    <Surface
      className="rounded-md border-emerald-300/25 bg-[#04110b]"
      style={{
        boxShadow: isActive
          ? "0 0 0 1px rgba(110,231,183,0.35), 0 16px 56px rgba(16,185,129,0.16)"
          : "0 14px 40px rgba(0,0,0,0.4)",
      }}
    >
      <Header
        className="bg-[#06281b]/80"
        style={{
          borderBottomColor: isActive ? "rgba(110,231,183,0.6)" : "rgba(110,231,183,0.18)",
        }}
      >
        <div className="flex min-w-0 items-center gap-2">
          <span
            className={`h-2 w-2 shrink-0 rounded-full ${isActive ? "bg-emerald-300" : "bg-emerald-300/30"}`}
          />
          <Title className="font-mono normal-case text-emerald-100/75">{window.title}</Title>
        </div>
        <Controls />
      </Header>
      <Body />
      <ActiveCorners className="border-emerald-200/40" />
    </Surface>
  );
}

function renderSignalFrame({
  frame,
  isSelected,
}: InfiniteCanvasWindowFrameRenderContext<FrameKind>) {
  const { Body, Controls, Header, Surface, Title } = frame;

  return (
    <Surface
      className="rounded-xl border-violet-300/25 bg-[#0b0816]"
      style={{
        boxShadow: isSelected
          ? "0 0 0 1px rgba(196,181,253,0.35), 0 18px 60px rgba(139,92,246,0.18)"
          : "0 14px 40px rgba(0,0,0,0.35)",
      }}
    >
      <Header
        className="justify-center bg-transparent"
        style={{ borderBottomColor: "rgba(196,181,253,0.16)" }}
      >
        <Title className="tracking-[0.3em] text-violet-200/60" />
        <div className="absolute right-2">
          <Controls />
        </div>
      </Header>
      <Body />
    </Surface>
  );
}

function CustomFramesShowcase() {
  return (
    <div className="absolute inset-0">
      <InfiniteCanvasDesktop
        initialState={initialState}
        renderOverlay={(context) => {
          exposeCanvasDevHandle(context);
          return null;
        }}
        subtitle="Custom chrome through controlled frame slots; interaction stays framework-owned."
        title="Custom Frames"
        windowDefinitions={registry}
      />
    </div>
  );
}
