"use client";

import {
  InfiniteCanvasDesktop,
  createInfiniteCanvasState,
  createInfiniteCanvasWindow,
  defineInfiniteCanvasWindowRegistry,
} from "#/experiments/infinite-canvas";

type HostChromeWindowKind = "archive" | "console" | "matrix";

const hostChromeState = createInfiniteCanvasState<HostChromeWindowKind>({
  camera: {
    center: {
      x: 460,
      y: 510,
    },
    zoom: 0.58,
  },
  selection: ["archive-core", "matrix-core"],
  windows: [
    createInfiniteCanvasWindow({
      id: "archive-core",
      kind: "archive",
      rect: {
        height: 280,
        width: 380,
        x: 20,
        y: 220,
      },
      title: "Archive.Core",
      zIndex: 1,
    }),
    createInfiniteCanvasWindow({
      id: "console-core",
      kind: "console",
      rect: {
        height: 320,
        width: 430,
        x: 470,
        y: 190,
      },
      title: "Console.Core",
      zIndex: 2,
    }),
    createInfiniteCanvasWindow({
      id: "matrix-core",
      kind: "matrix",
      rect: {
        height: 270,
        width: 360,
        x: 260,
        y: 560,
      },
      title: "Matrix.Core",
      zIndex: 0,
    }),
  ],
});

const hostChromeRegistry = defineInfiniteCanvasWindowRegistry<HostChromeWindowKind>({
  archive: {
    frameChrome: "host",
    kind: "archive",
    overflowY: "auto",
    renderBody: () => (
      <div className="grid h-full content-start gap-3 p-4 text-[12px] leading-relaxed text-white/58">
        <div className="text-[10px] font-medium uppercase text-cyan-100/70">Host-Local Chrome</div>
        <div className="border-l border-cyan-100/18 bg-white/[0.035] px-3 py-2">
          This window keeps the live DOM body; the frame chrome is mounted in the same transformed
          host for perfect sync.
        </div>
        <div className="border-l border-cyan-100/18 bg-white/[0.035] px-3 py-2">
          Drag, resize, focus, body rendering, and raster policy remain framework-owned.
        </div>
      </div>
    ),
  },
  console: {
    frameChrome: "host",
    kind: "console",
    overflowY: "auto",
    renderBody: () => (
      <div className="space-y-2 p-4 font-mono text-[11px] leading-relaxed text-white/56">
        {[
          "frame.chrome -> host-local visual shell",
          "host.transform -> shared by frame and DOM",
          "body.dom -> live and interactive",
          "resize.drag -> one compositor surface",
          "scene.layers -> world effects and drop affordances",
        ].map((line) => (
          <div className="border-b border-white/7 pb-2" key={line}>
            {line}
          </div>
        ))}
      </div>
    ),
  },
  matrix: {
    frameChrome: "host",
    kind: "matrix",
    overflowY: "auto",
    renderBody: () => (
      <div className="grid grid-cols-3 gap-2 p-4 font-mono text-[10px] text-white/52">
        {Array.from({ length: 18 }, (_, index) => (
          <div className="border border-white/7 bg-white/[0.03] p-2" key={index}>
            <div className="text-cyan-100/54">Node {String(index + 1).padStart(2, "0")}</div>
            <div className="mt-1 text-white/34">{(index * 13 + 7).toString(16).toUpperCase()}</div>
          </div>
        ))}
      </div>
    ),
  },
});

function InfiniteCanvasSceneChromeShowcase() {
  return (
    <InfiniteCanvasDesktop
      documentKey="scene-chrome"
      initialState={hostChromeState}
      subtitle="Frame chrome and DOM body share one transformed window host."
      title="Infinite Canvas Scene Chrome"
      windowDefinitions={hostChromeRegistry}
    />
  );
}

export { InfiniteCanvasSceneChromeShowcase };
