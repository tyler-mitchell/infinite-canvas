"use client";

import {
  Frame,
  LocateFixed,
  Minus,
  MousePointer2,
  Move,
  Plus,
  RotateCcw,
  ScanSearch,
} from "lucide-react";

import { DEFAULT_INFINITE_CANVAS_STACK_BANDS } from "./constants";
import { getConstrainedZoom } from "./geometry";
import { useInfiniteCanvasActions, useInfiniteCanvasState } from "./store";
import type { InfiniteCanvasPointerMode, InfiniteCanvasZoomPolicy } from "./types";

function InfiniteCanvasHud({
  onPointerModeChange,
  pointerMode = "marquee",
  subtitle,
  title,
  zoomPolicy,
}: Readonly<{
  onPointerModeChange?: (pointerMode: InfiniteCanvasPointerMode) => void;
  pointerMode?: InfiniteCanvasPointerMode;
  subtitle: string;
  title: string;
  zoomPolicy: InfiniteCanvasZoomPolicy;
}>) {
  const state = useInfiniteCanvasState();
  const actions = useInfiniteCanvasActions();
  const activeWindow = state.windows.find((window) => window.id === state.activeWindowId);
  const minimizedWindows = state.windows.filter((window) => window.mode === "minimized");

  return (
    <div
      className="pointer-events-none absolute inset-0"
      style={{ zIndex: DEFAULT_INFINITE_CANVAS_STACK_BANDS.overlay }}
    >
      <div aria-live="polite" className="sr-only">
        Active window {activeWindow?.title ?? "none"}.
      </div>
      <div className="absolute left-4 top-4 max-w-[min(28rem,calc(100%-2rem))] border border-white/10 bg-black/45 px-4 py-3 text-[11px] text-white/56 backdrop-blur-sm">
        <div className="font-medium uppercase text-white/72">{title}</div>
        <div className="mt-2 text-white/38">{subtitle}</div>
      </div>
      <div className="absolute bottom-4 left-4 flex max-w-[calc(100%-2rem)] flex-wrap items-center gap-2">
        {minimizedWindows.map((window) => (
          <button
            className="pointer-events-auto border border-white/10 bg-[#0c1016]/92 px-3 py-2 text-[11px] font-medium uppercase text-white/58 transition hover:border-white/20 hover:bg-white/[0.08] hover:text-white"
            key={window.id}
            onClick={() => {
              actions.restoreWindow(window.id);
            }}
            type="button"
          >
            {window.title}
          </button>
        ))}
      </div>
      <div className="absolute bottom-4 right-4 flex max-w-[calc(100%-2rem)] flex-wrap items-center justify-end gap-2">
        {onPointerModeChange === undefined ? null : (
          <InfiniteCanvasPointerModeControls
            onModeChange={onPointerModeChange}
            pointerMode={pointerMode}
          />
        )}
        <InfiniteCanvasCameraNavigationControls />
        <InfiniteCanvasZoomControls zoomPolicy={zoomPolicy} />
        <button
          aria-label="Reset desktop"
          className="pointer-events-auto flex h-10 w-10 items-center justify-center border border-white/10 bg-[#0c1016]/92 text-white/68 transition hover:border-white/20 hover:bg-white/[0.08] hover:text-white"
          onClick={() => {
            actions.reset();
          }}
          type="button"
        >
          <RotateCcw size={14} strokeWidth={1.8} />
        </button>
      </div>
    </div>
  );
}

function InfiniteCanvasCameraNavigationControls() {
  const state = useInfiniteCanvasState();
  const actions = useInfiniteCanvasActions();
  const activeWindow = state.windows.find(
    (window) => window.id === state.activeWindowId && window.mode !== "minimized",
  );
  const visibleWindowExists = state.windows.some((window) => window.mode !== "minimized");
  const selectionExists = state.selection.windowIds.length > 0;

  return (
    <div
      aria-label="Camera navigation"
      className="pointer-events-auto flex items-center overflow-hidden border border-white/10 bg-[#0c1016]/92 backdrop-blur-sm"
      data-infinite-canvas-control="true"
      role="group"
    >
      <button
        aria-label="Center active window"
        className="flex h-10 w-10 items-center justify-center border-r border-white/8 text-white/68 transition hover:bg-white/[0.08] hover:text-white disabled:cursor-not-allowed disabled:text-white/20"
        disabled={activeWindow === undefined}
        onClick={() => {
          if (activeWindow === undefined) {
            return;
          }

          actions.navigateView({
            target: {
              type: "window",
              windowId: activeWindow.id,
            },
          });
        }}
        title="Center active window"
        type="button"
      >
        <LocateFixed size={14} strokeWidth={1.8} />
      </button>
      <button
        aria-label="Fit selection"
        className="flex h-10 w-10 items-center justify-center border-r border-white/8 text-white/68 transition hover:bg-white/[0.08] hover:text-white disabled:cursor-not-allowed disabled:text-white/20"
        disabled={!selectionExists}
        onClick={() => {
          actions.navigateView({
            behavior: {
              type: "fit",
            },
            target: {
              type: "selection",
            },
          });
        }}
        title="Fit selection"
        type="button"
      >
        <Frame size={14} strokeWidth={1.8} />
      </button>
      <button
        aria-label="Fit all visible windows"
        className="flex h-10 w-10 items-center justify-center text-white/68 transition hover:bg-white/[0.08] hover:text-white disabled:cursor-not-allowed disabled:text-white/20"
        disabled={!visibleWindowExists}
        onClick={() => {
          actions.navigateView({
            behavior: {
              type: "fit",
            },
            target: {
              type: "visibleWindows",
            },
          });
        }}
        title="Fit all visible windows"
        type="button"
      >
        <ScanSearch size={14} strokeWidth={1.8} />
      </button>
    </div>
  );
}

function InfiniteCanvasPointerModeControls({
  onModeChange,
  pointerMode,
}: Readonly<{
  onModeChange: (pointerMode: InfiniteCanvasPointerMode) => void;
  pointerMode: InfiniteCanvasPointerMode;
}>) {
  return (
    <div
      aria-label="Canvas interaction mode"
      className="pointer-events-auto flex items-center overflow-hidden border border-white/10 bg-[#0c1016]/92 backdrop-blur-sm"
      data-infinite-canvas-control="true"
      role="group"
    >
      <button
        aria-label="Use marquee selection mode"
        aria-pressed={pointerMode === "marquee"}
        className={getPointerModeButtonClassName(pointerMode === "marquee", "border-r")}
        onClick={() => {
          onModeChange("marquee");
        }}
        title="Marquee selection"
        type="button"
      >
        <MousePointer2 size={14} strokeWidth={1.8} />
      </button>
      <button
        aria-label="Use pan mode"
        aria-pressed={pointerMode === "pan"}
        className={getPointerModeButtonClassName(pointerMode === "pan")}
        onClick={() => {
          onModeChange("pan");
        }}
        title="Pan canvas"
        type="button"
      >
        <Move size={14} strokeWidth={1.8} />
      </button>
    </div>
  );
}

function getPointerModeButtonClassName(isActive: boolean, divider = "") {
  return [
    "flex h-10 w-10 items-center justify-center border-white/8 transition hover:bg-white/[0.08] hover:text-white",
    divider,
    isActive ? "bg-[#142126] text-[#d7fbff]" : "bg-transparent text-white/58 hover:text-white",
  ]
    .filter(Boolean)
    .join(" ");
}

function InfiniteCanvasZoomControls({
  zoomPolicy,
}: Readonly<{
  zoomPolicy: InfiniteCanvasZoomPolicy;
}>) {
  const state = useInfiniteCanvasState();
  const actions = useInfiniteCanvasActions();
  const minZoom = getConstrainedZoom(0, zoomPolicy);
  const zoomPercent = Math.round(state.camera.zoom * 100);
  const centerAnchor = {
    x: state.viewport.width / 2,
    y: state.viewport.height / 2,
  };

  return (
    <div className="pointer-events-auto flex items-center overflow-hidden border border-white/10 bg-[#0c1016]/92 backdrop-blur-sm">
      <button
        aria-label="Zoom out"
        className="flex h-10 w-10 items-center justify-center border-r border-white/8 text-white/68 transition hover:bg-white/[0.08] hover:text-white disabled:cursor-not-allowed disabled:text-white/20"
        disabled={state.camera.zoom <= minZoom}
        onClick={() => {
          actions.zoomAt({
            anchor: centerAnchor,
            zoom: state.camera.zoom / zoomPolicy.step,
          });
        }}
        type="button"
      >
        <Minus size={14} strokeWidth={1.8} />
      </button>
      <button
        aria-label="Reset zoom to 100 percent"
        className="min-w-[86px] px-3 py-2 text-[11px] font-medium uppercase text-white/58 transition hover:bg-white/[0.08] hover:text-white"
        onClick={() => {
          actions.zoomAt({
            anchor: centerAnchor,
            zoom: zoomPolicy.defaultZoom,
          });
        }}
        type="button"
      >
        {zoomPercent}%
      </button>
      <button
        aria-label="Zoom in"
        className="flex h-10 w-10 items-center justify-center border-l border-white/8 text-white/68 transition hover:bg-white/[0.08] hover:text-white disabled:cursor-not-allowed disabled:text-white/20"
        disabled={state.camera.zoom >= zoomPolicy.maxZoom}
        onClick={() => {
          actions.zoomAt({
            anchor: centerAnchor,
            zoom: state.camera.zoom * zoomPolicy.step,
          });
        }}
        type="button"
      >
        <Plus size={14} strokeWidth={1.8} />
      </button>
    </div>
  );
}

export { InfiniteCanvasHud };
