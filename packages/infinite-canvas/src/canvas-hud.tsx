"use client";

import { useEffect, useRef, type CSSProperties } from "react";
import { useResizeObserver } from "use-resize-observer";

import { DEFAULT_INFINITE_CANVAS_STACK_BANDS } from "./constants";
import { INFINITE_CANVAS_SLOTS } from "./data-attributes";
import { getConstrainedZoom } from "./geometry";
import { useInfiniteCanvasIcons } from "./icons";
import { getSelectableWindowIds } from "./selection";
import {
  useInfiniteCanvasActions,
  useInfiniteCanvasSelectionBounds,
  useInfiniteCanvasState,
} from "./store";
import type {
  InfiniteCanvasHudPolicy,
  InfiniteCanvasHudPolicyInput,
  InfiniteCanvasPointerMode,
  InfiniteCanvasZoomPolicy,
} from "./types";
import { isInfiniteCanvasWindowInActiveWorkspace } from "./workspace-membership";

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

// HUD groups restore the pointer events that the HUD root disables.
const HUD_INTERACTIVE_STYLE = { pointerEvents: "auto" } satisfies CSSProperties;

/** Distance from the viewport edge to the status card and to the band. */
const HUD_EDGE_GAP_PX = 16;

const HUD_BOTTOM_BAND_STYLE = {
  alignItems: "flex-end",
  bottom: `${HUD_EDGE_GAP_PX}px`,
  display: "flex",
  gap: "8px",
  left: "16px",
  position: "absolute",
  right: "16px",
} satisfies CSSProperties;

/** HUD extent properties measure from the viewport edge. */
const HUD_EXTENT_BOTTOM_PROPERTY = "--icx-hud-extent-bottom";
const HUD_EXTENT_TOP_PROPERTY = "--icx-hud-extent-top";

const HUD_DOCK_STYLE = {
  alignItems: "center",
  display: "flex",
  flexWrap: "wrap",
  gap: "8px",
  // The dock wraps before it can displace the controls.
  minWidth: 0,
} satisfies CSSProperties;

const HUD_CONTROLS_STYLE = {
  alignItems: "center",
  display: "flex",
  flexShrink: 0,
  flexWrap: "wrap",
  gap: "8px",
  justifyContent: "flex-end",
  marginLeft: "auto",
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
  // The dock lists minimized windows in the active workspace.
  const minimizedWindows = state.windows.filter(
    (window) =>
      window.mode === "minimized" && isInfiniteCanvasWindowInActiveWorkspace(state, window.id),
  );
  const showControlsRow =
    resolvedPolicy.cameraControls ||
    resolvedPolicy.pointerModeControls ||
    resolvedPolicy.zoomControls;
  const showDock = resolvedPolicy.minimizedDock && minimizedWindows.length > 0;
  const rootRef = useRef<HTMLDivElement>(null);
  const hasBand = showDock || showControlsRow;
  const hasStatus = resolvedPolicy.statusCard;
  const insets = state.viewportInsets;
  const band = useResizeObserver<HTMLDivElement>({ box: "border-box" });
  const status = useResizeObserver<HTMLDivElement>({ box: "border-box" });

  useEffect(() => {
    const viewport = rootRef.current?.closest<HTMLElement>(
      `[data-slot="${INFINITE_CANVAS_SLOTS.viewport}"]`,
    );
    if (viewport == null) return;
    const bottom = hasBand ? insets.bottom + HUD_EDGE_GAP_PX + (band.height ?? 0) : 0;
    const top = hasStatus ? insets.top + HUD_EDGE_GAP_PX + (status.height ?? 0) : 0;
    viewport.style.setProperty(HUD_EXTENT_BOTTOM_PROPERTY, `${Math.round(bottom)}px`);
    viewport.style.setProperty(HUD_EXTENT_TOP_PROPERTY, `${Math.round(top)}px`);

    return () => {
      viewport.style.removeProperty(HUD_EXTENT_BOTTOM_PROPERTY);
      viewport.style.removeProperty(HUD_EXTENT_TOP_PROPERTY);
    };
  }, [band.height, hasBand, hasStatus, insets.bottom, insets.top, status.height]);

  if (!showControlsRow && !showDock && !resolvedPolicy.statusCard) {
    return null;
  }

  return (
    <div
      data-slot={INFINITE_CANVAS_SLOTS.hud}
      ref={rootRef}
      style={{
        bottom: state.viewportInsets.bottom,
        left: state.viewportInsets.left,
        pointerEvents: "none",
        position: "absolute",
        right: state.viewportInsets.right,
        top: state.viewportInsets.top,
        zIndex: DEFAULT_INFINITE_CANVAS_STACK_BANDS.overlay,
      }}
    >
      {resolvedPolicy.statusCard ? (
        <div
          data-slot={INFINITE_CANVAS_SLOTS.hudStatus}
          ref={status.ref}
          style={{
            left: "16px",
            maxWidth: "min(28rem, calc(100% - 2rem))",
            position: "absolute",
            top: `${HUD_EDGE_GAP_PX}px`,
          }}
        >
          <div data-slot={INFINITE_CANVAS_SLOTS.hudTitle}>{title}</div>
          <div data-slot={INFINITE_CANVAS_SLOTS.hudSubtitle} style={{ marginTop: "8px" }}>
            {subtitle}
          </div>
        </div>
      ) : null}
      {showDock || showControlsRow ? (
        <div data-slot={INFINITE_CANVAS_SLOTS.hudBand} ref={band.ref} style={HUD_BOTTOM_BAND_STYLE}>
          {showDock ? (
            <div data-slot={INFINITE_CANVAS_SLOTS.hudDock} style={HUD_DOCK_STYLE}>
              {minimizedWindows.map((window) => (
                <button
                  aria-label={`Restore ${window.title}`}
                  data-slot={INFINITE_CANVAS_SLOTS.hudDockItem}
                  key={window.id}
                  onClick={() => {
                    actions.restoreWindow(window.id);
                  }}
                  style={{ pointerEvents: "auto" }}
                  title={window.title}
                  type="button"
                >
                  {window.title}
                </button>
              ))}
            </div>
          ) : null}
          {showControlsRow ? (
            <div style={HUD_CONTROLS_STYLE}>
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
                  style={HUD_INTERACTIVE_STYLE}
                  type="button"
                >
                  <ResetIcon />
                </button>
              ) : null}
            </div>
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
    (window) =>
      window.id === state.activeWindowId &&
      window.mode !== "minimized" &&
      isInfiniteCanvasWindowInActiveWorkspace(state, window.id),
  );
  const visibleWindowExists = getSelectableWindowIds(state).length > 0;
  const selectionExists = useInfiniteCanvasSelectionBounds() !== null;

  return (
    <div
      aria-label="Camera navigation"
      data-group="camera"
      data-infinite-canvas-control="true"
      data-slot={INFINITE_CANVAS_SLOTS.hudGroup}
      role="group"
      style={HUD_INTERACTIVE_STYLE}
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
      style={HUD_INTERACTIVE_STYLE}
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
    <div data-group="zoom" data-slot={INFINITE_CANVAS_SLOTS.hudGroup} style={HUD_INTERACTIVE_STYLE}>
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
        type="button"
      >
        <ZoomInIcon />
      </button>
    </div>
  );
}

export {
  DEFAULT_INFINITE_CANVAS_HUD_POLICY,
  HUD_EXTENT_BOTTOM_PROPERTY,
  HUD_EXTENT_TOP_PROPERTY,
  InfiniteCanvasHud,
  resolveInfiniteCanvasHudPolicy,
};
