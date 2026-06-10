"use client";

import type { CSSProperties } from "react";

import { DEFAULT_INFINITE_CANVAS_STACK_BANDS } from "./constants";
import { INFINITE_CANVAS_SLOTS } from "./data-attributes";
import { getConstrainedZoom } from "./geometry";
import { useInfiniteCanvasIcons } from "./icons";
import { useInfiniteCanvasActions, useInfiniteCanvasState } from "./store";
import type {
  InfiniteCanvasHudPolicy,
  InfiniteCanvasHudPolicyInput,
  InfiniteCanvasPointerMode,
  InfiniteCanvasZoomPolicy,
} from "./types";

const DEFAULT_INFINITE_CANVAS_HUD_POLICY: InfiniteCanvasHudPolicy = {
  cameraControls: true,
  minimizedDock: true,
  pointerModeControls: true,
  statusCard: true,
  zoomControls: true,
};

const HIDDEN_INFINITE_CANVAS_HUD_POLICY: InfiniteCanvasHudPolicy = {
  cameraControls: false,
  minimizedDock: false,
  pointerModeControls: false,
  statusCard: false,
  zoomControls: false,
};

function resolveInfiniteCanvasHudPolicy(
  input?: InfiniteCanvasHudPolicyInput,
): InfiniteCanvasHudPolicy {
  if (input === undefined) {
    return DEFAULT_INFINITE_CANVAS_HUD_POLICY;
  }

  if (typeof input === "boolean") {
    return input ? DEFAULT_INFINITE_CANVAS_HUD_POLICY : HIDDEN_INFINITE_CANVAS_HUD_POLICY;
  }

  return {
    ...DEFAULT_INFINITE_CANVAS_HUD_POLICY,
    ...input,
  };
}

// Screen-reader-only treatment for the live announcer (Tailwind sr-only).
const VISUALLY_HIDDEN_STYLE = {
  borderWidth: 0,
  clip: "rect(0, 0, 0, 0)",
  height: "1px",
  margin: "-1px",
  overflow: "hidden",
  padding: 0,
  position: "absolute",
  whiteSpace: "nowrap",
  width: "1px",
} satisfies CSSProperties;

const HUD_ICON_BUTTON_STYLE = {
  alignItems: "center",
  display: "flex",
  height: "40px",
  justifyContent: "center",
  width: "40px",
} satisfies CSSProperties;

const HUD_GROUP_STYLE = {
  alignItems: "center",
  display: "flex",
  overflow: "hidden",
  pointerEvents: "auto",
} satisfies CSSProperties;

function InfiniteCanvasHud({
  onPointerModeChange,
  pointerMode = "marquee",
  policy,
  subtitle,
  title,
  zoomPolicy,
}: Readonly<{
  onPointerModeChange?: (pointerMode: InfiniteCanvasPointerMode) => void;
  pointerMode?: InfiniteCanvasPointerMode;
  policy?: InfiniteCanvasHudPolicyInput;
  subtitle: string;
  title: string;
  zoomPolicy: InfiniteCanvasZoomPolicy;
}>) {
  const state = useInfiniteCanvasState();
  const actions = useInfiniteCanvasActions();
  const { reset: ResetIcon } = useInfiniteCanvasIcons();
  const resolvedPolicy = resolveInfiniteCanvasHudPolicy(policy);
  const activeWindow = state.windows.find((window) => window.id === state.activeWindowId);
  const minimizedWindows = state.windows.filter((window) => window.mode === "minimized");
  const showControlsRow =
    resolvedPolicy.cameraControls ||
    resolvedPolicy.pointerModeControls ||
    resolvedPolicy.zoomControls;

  if (!showControlsRow && !resolvedPolicy.minimizedDock && !resolvedPolicy.statusCard) {
    return null;
  }

  return (
    <div
      data-slot={INFINITE_CANVAS_SLOTS.hud}
      style={{
        inset: 0,
        pointerEvents: "none",
        position: "absolute",
        zIndex: DEFAULT_INFINITE_CANVAS_STACK_BANDS.overlay,
      }}
    >
      <div aria-live="polite" style={VISUALLY_HIDDEN_STYLE}>
        Active window {activeWindow?.title ?? "none"}.
      </div>
      {resolvedPolicy.statusCard ? (
        <div
          data-slot={INFINITE_CANVAS_SLOTS.hudStatus}
          style={{
            left: "16px",
            maxWidth: "min(28rem, calc(100% - 2rem))",
            padding: "12px 16px",
            position: "absolute",
            top: "16px",
          }}
        >
          <div data-slot={INFINITE_CANVAS_SLOTS.hudTitle}>{title}</div>
          <div data-slot={INFINITE_CANVAS_SLOTS.hudSubtitle} style={{ marginTop: "8px" }}>
            {subtitle}
          </div>
        </div>
      ) : null}
      {resolvedPolicy.minimizedDock ? (
        <div
          data-slot={INFINITE_CANVAS_SLOTS.hudDock}
          style={{
            alignItems: "center",
            bottom: "16px",
            display: "flex",
            flexWrap: "wrap",
            gap: "8px",
            left: "16px",
            maxWidth: "calc(100% - 2rem)",
            position: "absolute",
          }}
        >
          {minimizedWindows.map((window) => (
            <button
              data-slot={INFINITE_CANVAS_SLOTS.hudDockItem}
              key={window.id}
              onClick={() => {
                actions.restoreWindow(window.id);
              }}
              style={{
                padding: "8px 12px",
                pointerEvents: "auto",
              }}
              type="button"
            >
              {window.title}
            </button>
          ))}
        </div>
      ) : null}
      {showControlsRow ? (
        <div
          style={{
            alignItems: "center",
            bottom: "16px",
            display: "flex",
            flexWrap: "wrap",
            gap: "8px",
            justifyContent: "flex-end",
            maxWidth: "calc(100% - 2rem)",
            position: "absolute",
            right: "16px",
          }}
        >
          {resolvedPolicy.pointerModeControls && onPointerModeChange !== undefined ? (
            <InfiniteCanvasPointerModeControls
              onModeChange={onPointerModeChange}
              pointerMode={pointerMode}
            />
          ) : null}
          {resolvedPolicy.cameraControls ? <InfiniteCanvasCameraNavigationControls /> : null}
          {resolvedPolicy.zoomControls ? (
            <InfiniteCanvasZoomControls zoomPolicy={zoomPolicy} />
          ) : null}
          {resolvedPolicy.cameraControls ? (
            <button
              aria-label="Reset desktop"
              data-action="reset"
              data-slot={INFINITE_CANVAS_SLOTS.hudButton}
              onClick={() => {
                actions.reset();
              }}
              style={{
                ...HUD_ICON_BUTTON_STYLE,
                pointerEvents: "auto",
              }}
              type="button"
            >
              <ResetIcon />
            </button>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}

function InfiniteCanvasCameraNavigationControls() {
  const state = useInfiniteCanvasState();
  const actions = useInfiniteCanvasActions();
  const {
    "center-active": CenterActiveIcon,
    "fit-all": FitAllIcon,
    "fit-selection": FitSelectionIcon,
  } = useInfiniteCanvasIcons();
  const activeWindow = state.windows.find(
    (window) => window.id === state.activeWindowId && window.mode !== "minimized",
  );
  const visibleWindowExists = state.windows.some((window) => window.mode !== "minimized");
  const selectionExists = state.selection.windowIds.length > 0;

  return (
    <div
      aria-label="Camera navigation"
      data-group="camera"
      data-infinite-canvas-control="true"
      data-slot={INFINITE_CANVAS_SLOTS.hudGroup}
      role="group"
      style={HUD_GROUP_STYLE}
    >
      <button
        aria-label="Center active window"
        data-action="center-active"
        data-slot={INFINITE_CANVAS_SLOTS.hudButton}
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
        style={HUD_ICON_BUTTON_STYLE}
        title="Center active window"
        type="button"
      >
        <CenterActiveIcon />
      </button>
      <button
        aria-label="Fit selection"
        data-action="fit-selection"
        data-slot={INFINITE_CANVAS_SLOTS.hudButton}
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
        style={HUD_ICON_BUTTON_STYLE}
        title="Fit selection"
        type="button"
      >
        <FitSelectionIcon />
      </button>
      <button
        aria-label="Fit all visible windows"
        data-action="fit-all"
        data-slot={INFINITE_CANVAS_SLOTS.hudButton}
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
        style={HUD_ICON_BUTTON_STYLE}
        title="Fit all visible windows"
        type="button"
      >
        <FitAllIcon />
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
  const { "pointer-marquee": PointerMarqueeIcon, "pointer-pan": PointerPanIcon } =
    useInfiniteCanvasIcons();

  return (
    <div
      aria-label="Canvas interaction mode"
      data-group="pointer-mode"
      data-infinite-canvas-control="true"
      data-slot={INFINITE_CANVAS_SLOTS.hudGroup}
      role="group"
      style={HUD_GROUP_STYLE}
    >
      <button
        aria-label="Use marquee selection mode"
        aria-pressed={pointerMode === "marquee"}
        data-action="pointer-marquee"
        data-active={pointerMode === "marquee" ? "" : undefined}
        data-slot={INFINITE_CANVAS_SLOTS.hudButton}
        onClick={() => {
          onModeChange("marquee");
        }}
        style={HUD_ICON_BUTTON_STYLE}
        title="Marquee selection"
        type="button"
      >
        <PointerMarqueeIcon />
      </button>
      <button
        aria-label="Use pan mode"
        aria-pressed={pointerMode === "pan"}
        data-action="pointer-pan"
        data-active={pointerMode === "pan" ? "" : undefined}
        data-slot={INFINITE_CANVAS_SLOTS.hudButton}
        onClick={() => {
          onModeChange("pan");
        }}
        style={HUD_ICON_BUTTON_STYLE}
        title="Pan canvas"
        type="button"
      >
        <PointerPanIcon />
      </button>
    </div>
  );
}

function InfiniteCanvasZoomControls({
  zoomPolicy,
}: Readonly<{
  zoomPolicy: InfiniteCanvasZoomPolicy;
}>) {
  const state = useInfiniteCanvasState();
  const actions = useInfiniteCanvasActions();
  const { "zoom-in": ZoomInIcon, "zoom-out": ZoomOutIcon } = useInfiniteCanvasIcons();
  const minZoom = getConstrainedZoom(0, zoomPolicy);
  const zoomPercent = Math.round(state.camera.zoom * 100);
  const centerAnchor = {
    x: state.viewport.width / 2,
    y: state.viewport.height / 2,
  };

  return (
    <div data-group="zoom" data-slot={INFINITE_CANVAS_SLOTS.hudGroup} style={HUD_GROUP_STYLE}>
      <button
        aria-label="Zoom out"
        data-action="zoom-out"
        data-slot={INFINITE_CANVAS_SLOTS.hudButton}
        disabled={state.camera.zoom <= minZoom}
        onClick={() => {
          actions.zoomAt({
            anchor: centerAnchor,
            zoom: state.camera.zoom / zoomPolicy.step,
          });
        }}
        style={HUD_ICON_BUTTON_STYLE}
        type="button"
      >
        <ZoomOutIcon />
      </button>
      <button
        aria-label="Reset zoom to 100 percent"
        data-action="zoom-reset"
        data-slot={INFINITE_CANVAS_SLOTS.hudButton}
        onClick={() => {
          actions.zoomAt({
            anchor: centerAnchor,
            zoom: zoomPolicy.defaultZoom,
          });
        }}
        style={{
          minWidth: "86px",
          padding: "8px 12px",
        }}
        type="button"
      >
        <span data-slot={INFINITE_CANVAS_SLOTS.hudZoomReadout}>{zoomPercent}%</span>
      </button>
      <button
        aria-label="Zoom in"
        data-action="zoom-in"
        data-slot={INFINITE_CANVAS_SLOTS.hudButton}
        disabled={state.camera.zoom >= zoomPolicy.maxZoom}
        onClick={() => {
          actions.zoomAt({
            anchor: centerAnchor,
            zoom: state.camera.zoom * zoomPolicy.step,
          });
        }}
        style={HUD_ICON_BUTTON_STYLE}
        type="button"
      >
        <ZoomInIcon />
      </button>
    </div>
  );
}

export { DEFAULT_INFINITE_CANVAS_HUD_POLICY, InfiniteCanvasHud, resolveInfiniteCanvasHudPolicy };
