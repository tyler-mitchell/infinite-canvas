"use client";

import {
  InfiniteCanvasDesktop,
  createInfiniteCanvasState,
  createInfiniteCanvasWindow,
  defineInfiniteCanvasWindowRegistry,
  type InfiniteCanvasWindowFrameRenderContext,
} from "#/experiments/infinite-canvas";

type CustomFrameWindowKind = "instrument" | "ledger" | "standard";

const customFrameCanvasState = createInfiniteCanvasState<CustomFrameWindowKind>({
  camera: {
    center: {
      x: 320,
      y: 170,
    },
    zoom: 0.82,
  },
  windows: [
    createInfiniteCanvasWindow({
      id: "custom-instrument",
      kind: "instrument",
      rect: {
        height: 300,
        width: 420,
        x: 40,
        y: 40,
      },
      title: "Instrument.Frame",
      zIndex: 1,
    }),
    createInfiniteCanvasWindow({
      id: "custom-ledger",
      kind: "ledger",
      rect: {
        height: 280,
        width: 360,
        x: 520,
        y: 120,
      },
      title: "Ledger.Frame",
      zIndex: 2,
    }),
    createInfiniteCanvasWindow({
      id: "standard-reference",
      kind: "standard",
      rect: {
        height: 230,
        width: 340,
        x: 220,
        y: 390,
      },
      title: "Default.Frame",
      zIndex: 0,
    }),
  ],
});

const customFrameWindowRegistry = defineInfiniteCanvasWindowRegistry<CustomFrameWindowKind>({
  instrument: {
    kind: "instrument",
    overflowY: "auto",
    renderBody: () => (
      <div className="grid gap-3 p-4 text-[12px] text-white/62">
        <div className="grid grid-cols-3 gap-2">
          {["Flux", "Load", "Drift", "Pulse", "Gate", "Bias"].map((label, index) => (
            <div className="border border-cyan-100/10 bg-cyan-100/[0.035] p-3" key={label}>
              <div className="font-mono text-[9px] uppercase tracking-[0.18em] text-cyan-100/52">
                {label}
              </div>
              <div className="mt-2 font-mono text-[13px] text-cyan-50/72">
                {(index * 17 + 42).toString().padStart(3, "0")}
              </div>
            </div>
          ))}
        </div>
        <p className="leading-relaxed text-white/46">
          The custom frame owns visual treatment while the framework still owns drag, focus,
          selection, controls, body behavior, and resize handles.
        </p>
      </div>
    ),
    renderFrame: renderInstrumentWindowFrame,
  },
  ledger: {
    kind: "ledger",
    overflowY: "auto",
    renderBody: () => (
      <div className="space-y-2 p-4 font-mono text-[11px] text-white/54">
        {[
          "slot.surface keeps the window in the DOM projection layer",
          "slot.header keeps drag and selection wiring intact",
          "slot.body keeps rasterization and pointer policy contained",
          "slot.controls keeps framework actions discoverable",
        ].map((line) => (
          <div className="border border-white/7 bg-white/[0.03] px-3 py-2" key={line}>
            {line}
          </div>
        ))}
      </div>
    ),
    renderFrame: renderLedgerWindowFrame,
  },
  standard: {
    kind: "standard",
    overflowY: "auto",
    renderBody: () => (
      <div className="grid h-full content-start gap-3 p-4 text-[12px] leading-relaxed text-white/58">
        <div className="text-[10px] font-medium uppercase text-white/48">Reference</div>
        <div className="border-l border-white/12 bg-white/[0.035] px-3 py-2">
          A default frame can live alongside custom frames in the same world.
        </div>
      </div>
    ),
  },
});

function InfiniteCanvasCustomFramesShowcase() {
  return (
    <InfiniteCanvasDesktop
      documentKey="custom-frames"
      initialState={customFrameCanvasState}
      storageKey="kek.infinite-canvas.custom-frames.v1"
      subtitle="Controlled frame slots: custom chrome without leaking interaction plumbing."
      title="Infinite Canvas Custom Frames"
      windowDefinitions={customFrameWindowRegistry}
    />
  );
}

function renderInstrumentWindowFrame({
  frame,
  isActive,
  window,
}: InfiniteCanvasWindowFrameRenderContext<CustomFrameWindowKind>) {
  const { ActiveCorners, Body, Controls, Header, Surface, Title } = frame;

  return (
    <Surface
      className="border-cyan-100/22 bg-[#061015]"
      style={{
        boxShadow: isActive
          ? "0 0 0 1px rgba(183,244,255,0.36), 0 18px 64px rgba(34,211,238,0.14)"
          : "0 18px 44px rgba(0,0,0,0.34)",
      }}
    >
      <Header
        className="bg-[#0d252b]"
        style={{
          borderBottomColor: isActive ? "rgba(183,244,255,0.7)" : "rgba(183,244,255,0.22)",
        }}
      >
        <div className="flex min-w-0 items-center gap-2">
          <span className="h-2 w-2 shrink-0 border border-cyan-100/50 bg-cyan-100/18" />
          <Title className="text-cyan-50/70">{window.title}</Title>
        </div>
        <Controls />
      </Header>
      <Body className="bg-[linear-gradient(180deg,rgba(34,211,238,0.035),rgba(255,255,255,0.01))]" />
      <ActiveCorners />
    </Surface>
  );
}

function renderLedgerWindowFrame({
  frame,
  isSelected,
}: InfiniteCanvasWindowFrameRenderContext<CustomFrameWindowKind>) {
  const { ActiveCorners, Body, Controls, Header, Surface, Title } = frame;

  return (
    <Surface
      className="border-white/14 bg-[#09090b]"
      style={{
        boxShadow: isSelected
          ? "0 0 0 1px rgba(255,255,255,0.2), 0 16px 52px rgba(255,255,255,0.05)"
          : "0 14px 36px rgba(0,0,0,0.3)",
      }}
    >
      <Header className="bg-[#14151a]">
        <Title className="font-mono tracking-[0.16em] text-white/54" />
        <Controls />
      </Header>
      <Body />
      <ActiveCorners />
    </Surface>
  );
}

export { InfiniteCanvasCustomFramesShowcase };
