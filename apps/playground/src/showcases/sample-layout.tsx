"use client";

import {
  createInfiniteCanvasState,
  createInfiniteCanvasWindow,
  defineInfiniteCanvasWindowRegistry,
} from "infinite-canvas";
import type { InfiniteCanvasState } from "infinite-canvas";

type SampleCanvasWindowKind = "archive" | "control" | "dense" | "log";

const stressWindowKinds = ["dense"] as const;
const maxStressWindowCount = 80;
const denseStressRows = Array.from({ length: 36 }, (_, index) => index);
const denseStressCells = ["alpha", "beta", "gamma", "delta"] as const;

const sampleInfiniteCanvasState = createInfiniteCanvasState<SampleCanvasWindowKind>({
  activeWindowId: "control-window",
  windows: [
    createInfiniteCanvasWindow({
      id: "archive-window",
      kind: "archive",
      minSize: {
        height: 240,
        width: 320,
      },
      mode: "normal",
      rect: {
        height: 320,
        width: 420,
        x: -460,
        y: -220,
      },
      title: "archive.index",
      zIndex: 0,
    }),
    createInfiniteCanvasWindow({
      id: "log-window",
      kind: "log",
      minSize: {
        height: 260,
        width: 360,
      },
      mode: "normal",
      rect: {
        height: 360,
        width: 470,
        x: -80,
        y: 110,
      },
      title: "ops.event-stream",
      zIndex: 1,
    }),
    createInfiniteCanvasWindow({
      id: "control-window",
      isPinned: true,
      kind: "control",
      minSize: {
        height: 280,
        width: 360,
      },
      mode: "normal",
      rect: {
        height: 340,
        width: 440,
        x: 310,
        y: -120,
      },
      title: "runtime.controls",
      zIndex: 2,
    }),
  ],
});

const getStressWindowKind = (index: number): SampleCanvasWindowKind =>
  stressWindowKinds[index % stressWindowKinds.length] ?? "archive";

const getStressWindowTitle = (kind: SampleCanvasWindowKind, index: number): string =>
  `${kind}.${String(index + 1).padStart(3, "0")}`;

const createStressInfiniteCanvasState = (
  requestedCount: number,
): InfiniteCanvasState<SampleCanvasWindowKind> => {
  const count = Math.min(Math.max(Math.floor(requestedCount), 1), maxStressWindowCount);
  const columns = Math.max(1, Math.ceil(Math.sqrt(count * 1.4)));
  const rows = Math.ceil(count / columns);
  const width = 300;
  const height = 210;
  const gap = 42;
  const firstWindowId = "stress-window-0";

  return createInfiniteCanvasState<SampleCanvasWindowKind>({
    activeWindowId: firstWindowId,
    camera: {
      center: {
        x: 0,
        y: 0,
      },
      zoom: 0.5,
    },
    windows: Array.from({ length: count }, (_, index) => {
      const kind = getStressWindowKind(index);
      const column = index % columns;
      const row = Math.floor(index / columns);
      const rowOffset = row % 2 === 0 ? 0 : 24;

      return createInfiniteCanvasWindow({
        id: `stress-window-${index}`,
        kind,
        minSize: {
          height: 160,
          width: 240,
        },
        rect: {
          height,
          width,
          x: (column - (columns - 1) / 2) * (width + gap) + rowOffset,
          y: (row - (rows - 1) / 2) * (height + gap),
        },
        title: getStressWindowTitle(kind, index),
        zIndex: index,
      });
    }),
  });
};

const sampleInfiniteCanvasWindowRegistry =
  defineInfiniteCanvasWindowRegistry<SampleCanvasWindowKind>({
    archive: {
      kind: "archive",
      overflowY: "auto",
      renderBody: () => (
        <div className="grid h-full content-start gap-3 p-4 text-[12px] leading-relaxed text-white/62">
          <div className="text-[10px] font-medium uppercase text-[#b7f4ff]/80">Source Surfaces</div>
          {[
            "Document panes stay normal React DOM.",
            "The runtime owns spatial math, grid, focus, and interaction.",
            "Window definitions are registered data, not hard-coded branches.",
          ].map((item) => (
            <div className="border-l border-[#b7f4ff]/25 bg-white/[0.035] px-3 py-2" key={item}>
              {item}
            </div>
          ))}
        </div>
      ),
    },
    control: {
      kind: "control",
      overflowY: "auto",
      renderBody: ({ actions, isActive, window }) => (
        <div className="flex h-full flex-col gap-4 p-4 text-[12px] text-white/62">
          <div>
            <div className="text-[10px] font-medium uppercase text-[#ffd27a]/80">
              Composable Runtime
            </div>
            <p className="mt-2 leading-relaxed">
              This sample window is just a consumer-provided body renderer. The framework gives it
              state and commands without exposing renderer internals.
            </p>
          </div>
          <div className="grid grid-cols-2 gap-2">
            <button
              className="border border-white/10 bg-white/[0.04] px-3 py-2 text-left text-[11px] uppercase text-white/64 transition hover:border-white/20 hover:bg-white/[0.08]"
              onClick={() => {
                actions.togglePinned(window.id);
              }}
              type="button"
            >
              {window.isPinned ? "Unpin" : "Pin"}
            </button>
            <button
              className="border border-white/10 bg-white/[0.04] px-3 py-2 text-left text-[11px] uppercase text-white/64 transition hover:border-white/20 hover:bg-white/[0.08]"
              onClick={() => {
                actions.focusWindow("log-window");
                actions.navigateToWindow({
                  windowId: "log-window",
                });
              }}
              type="button"
            >
              Focus Log
            </button>
            <button
              className="border border-white/10 bg-white/[0.04] px-3 py-2 text-left text-[11px] uppercase text-white/64 transition hover:border-white/20 hover:bg-white/[0.08]"
              onClick={() => {
                actions.maximizeWindow(window.id);
              }}
              type="button"
            >
              Maximize
            </button>
            <button
              className="border border-white/10 bg-white/[0.04] px-3 py-2 text-left text-[11px] uppercase text-white/64 transition hover:border-white/20 hover:bg-white/[0.08]"
              onClick={() => {
                actions.fitAllVisibleWindows();
              }}
              type="button"
            >
              Fit All
            </button>
            <button
              className="border border-white/10 bg-white/[0.04] px-3 py-2 text-left text-[11px] uppercase text-white/64 transition hover:border-white/20 hover:bg-white/[0.08]"
              onClick={() => {
                actions.fitSelection();
              }}
              type="button"
            >
              Fit Selection
            </button>
            <button
              className="border border-white/10 bg-white/[0.04] px-3 py-2 text-left text-[11px] uppercase text-white/64 transition hover:border-white/20 hover:bg-white/[0.08]"
              onClick={() => {
                actions.navigateToPoint({
                  behavior: {
                    type: "centerAtZoom",
                    zoom: 0.8,
                  },
                  point: {
                    x: 0,
                    y: 0,
                  },
                });
              }}
              type="button"
            >
              Center Origin
            </button>
            <button
              className="border border-white/10 bg-white/[0.04] px-3 py-2 text-left text-[11px] uppercase text-white/64 transition hover:border-white/20 hover:bg-white/[0.08]"
              onClick={() => {
                actions.openWindow(
                  createInfiniteCanvasWindow({
                    id: "scratch-window",
                    kind: "archive",
                    minSize: {
                      height: 220,
                      width: 300,
                    },
                    rect: {
                      height: 280,
                      width: 360,
                      x: 120,
                      y: 240,
                    },
                    title: "scratch.note",
                    zIndex: 0,
                  }),
                );
              }}
              type="button"
            >
              Open Note
            </button>
          </div>
          <div className="mt-auto border border-white/8 bg-black/18 p-3 text-[11px] text-white/46">
            Active: {isActive ? "yes" : "no"} | Pin state:{" "}
            {window.isPinned ? "always-on-top" : "normal band"}
          </div>
        </div>
      ),
    },
    log: {
      kind: "log",
      overflowY: "auto",
      renderBody: () => (
        <div className="space-y-2 p-4 font-mono text-[11px] leading-relaxed text-white/58">
          {[
            "[model] pure reducer accepted viewport.set",
            "[projection] world rects map through one camera contract",
            "[driver] pointer capture normalized at the DOM boundary",
            "[scene] WebGPU surface stays transparent and programmable",
            "[dom] window bodies remain an explicit composition plane",
          ].map((line) => (
            <div className="border-b border-white/6 pb-2" key={line}>
              {line}
            </div>
          ))}
        </div>
      ),
    },
    dense: {
      kind: "dense",
      overflowY: "auto",
      renderBody: ({ window }) => (
        <div className="grid content-start gap-2 p-3 font-mono text-[10px] leading-tight text-white/56">
          <div className="flex items-center justify-between border-b border-white/8 pb-2">
            <div className="uppercase text-[#b7f4ff]/78">Dense DOM Payload</div>
            <div className="text-white/34">{window.title}</div>
          </div>
          {denseStressRows.map((row) => (
            <div className="grid grid-cols-4 gap-1" key={row}>
              {denseStressCells.map((cell, column) => (
                <div
                  className="border border-white/8 bg-white/[0.035] px-2 py-1.5"
                  key={`${row}-${cell}`}
                >
                  <div className="uppercase text-white/34">{cell}</div>
                  <div>
                    {String(row + 1).padStart(2, "0")}.{column + 1}
                  </div>
                </div>
              ))}
            </div>
          ))}
        </div>
      ),
    },
  });

export {
  createStressInfiniteCanvasState,
  sampleInfiniteCanvasState,
  sampleInfiniteCanvasWindowRegistry,
};

export type { SampleCanvasWindowKind };
