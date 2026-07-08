"use client";

import type { CSSProperties } from "react";

import { DEFAULT_INFINITE_CANVAS_STACK_BANDS } from "./constants";
import { INFINITE_CANVAS_SLOTS } from "./data-attributes";
import {
  getRectFromPoints,
  projectWorldRectToScreen,
  snapScreenValueToDevicePixel,
} from "./geometry";
import { getSelectedWindowBounds } from "./selection";
import { useInfiniteCanvasState } from "./store";
import type {
  InfiniteCanvasDropInteraction,
  InfiniteCanvasSnapGuide,
  InfiniteCanvasSnapPreview,
  InfiniteCanvasState,
} from "./types";

// Interaction overlays stack directly beneath the HUD band (overlay), above
// the screen-space scene overlays (overlay - 9): bounds < marquee < snap.
const SELECTION_BOUNDS_OVERLAY_Z_INDEX = DEFAULT_INFINITE_CANVAS_STACK_BANDS.overlay - 4;
const DOCK_REGION_OVERLAY_Z_INDEX = DEFAULT_INFINITE_CANVAS_STACK_BANDS.overlay - 3;
const MARQUEE_OVERLAY_Z_INDEX = DEFAULT_INFINITE_CANVAS_STACK_BANDS.overlay - 3;
const SNAP_OVERLAY_Z_INDEX = DEFAULT_INFINITE_CANVAS_STACK_BANDS.overlay - 2;

function InfiniteCanvasSelectionBoundsOverlay({
  devicePixelRatio,
}: Readonly<{
  devicePixelRatio: number;
}>) {
  const state = useInfiniteCanvasState();
  const bounds = getSelectedWindowBounds(state);

  if (
    bounds === null ||
    state.selection.windowIds.length < 2 ||
    state.interaction?.kind === "resize"
  ) {
    return null;
  }

  const rect = projectWorldRectToScreen(
    state.camera,
    state.viewport,
    bounds,
    devicePixelRatio,
  ).screenRect;

  return (
    <div
      style={{
        inset: 0,
        pointerEvents: "none",
        position: "absolute",
        zIndex: SELECTION_BOUNDS_OVERLAY_Z_INDEX,
      }}
    >
      <div
        data-infinite-canvas-selection-bounds="true"
        data-slot={INFINITE_CANVAS_SLOTS.selectionBounds}
        style={{
          boxSizing: "border-box",
          height: `${rect.height}px`,
          position: "absolute",
          transform: `translate3d(${rect.left}px, ${rect.top}px, 0)`,
          width: `${rect.width}px`,
        }}
      />
    </div>
  );
}

/**
 * Where the dragged window will land if released now. Shown only while docking
 * intent is held, because that is the only time a drop target exists — and a drop
 * the user did not see coming is the one thing a docking gesture must never do.
 *
 * The rect comes from the same value the reducer will apply on release, not from
 * a fresh hit-test, so what is promised is what happens.
 */
function InfiniteCanvasDockPreviewOverlay({
  devicePixelRatio,
}: Readonly<{
  devicePixelRatio: number;
}>) {
  const state = useInfiniteCanvasState();
  const interaction = state.interaction;
  const dockPreview = interaction?.kind === "move" ? interaction.dockPreview : null;

  if (dockPreview === null) {
    return null;
  }

  const rect = projectWorldRectToScreen(
    state.camera,
    state.viewport,
    dockPreview.rect,
    devicePixelRatio,
  ).screenRect;

  return (
    <div
      style={{
        inset: 0,
        pointerEvents: "none",
        position: "absolute",
        zIndex: DOCK_REGION_OVERLAY_Z_INDEX,
      }}
    >
      <div
        aria-hidden="true"
        data-edge={dockPreview.edge}
        data-slot={INFINITE_CANVAS_SLOTS.dockRegion}
        style={{
          boxSizing: "border-box",
          height: `${rect.height}px`,
          position: "absolute",
          transform: `translate3d(${rect.left}px, ${rect.top}px, 0)`,
          width: `${rect.width}px`,
        }}
      />
    </div>
  );
}

/**
 * Draws one snap preview: the ghost rect and the guides holding it.
 *
 * Extracted because a *drop* snaps against exactly the same candidates as a move —
 * `getInfiniteCanvasDropPlacement` calls the same `applySnapToRect` — and the guides
 * it produced were being computed and thrown away. Every consumer that wanted them
 * drew their own, slightly differently, against the same `data-slot` contract the
 * framework was already styling.
 */
function InfiniteCanvasSnapPreviewLayer({
  devicePixelRatio,
  preview,
}: Readonly<{
  devicePixelRatio: number;
  preview: InfiniteCanvasSnapPreview;
}>) {
  const state = useInfiniteCanvasState();
  const previewProjection = projectWorldRectToScreen(
    state.camera,
    state.viewport,
    preview.rect,
    devicePixelRatio,
  );
  const previewTransform = previewProjection.screenTransform;
  const previewScreenRect = previewProjection.screenRect;
  // Viewport-edge guides would draw a line down the middle of the screen; only the
  // ones anchored to another window tell the user what they are aligning with.
  const visibleGuides = preview.guides.filter((guide) => guide.from === "window");

  return (
    <div
      style={{
        inset: 0,
        pointerEvents: "none",
        position: "absolute",
        zIndex: SNAP_OVERLAY_Z_INDEX,
      }}
    >
      <div
        data-slot={INFINITE_CANVAS_SLOTS.snapPreview}
        style={{
          boxSizing: "border-box",
          height: `${previewTransform.height}px`,
          position: "absolute",
          transform: `translate3d(${previewTransform.x}px, ${previewTransform.y}px, 0) scale(${previewTransform.scale})`,
          transformOrigin: "top left",
          width: `${previewTransform.width}px`,
        }}
      />
      {visibleGuides.map((guide) => (
        <div
          data-axis={guide.axis}
          data-kind={guide.kind}
          data-slot={INFINITE_CANVAS_SLOTS.snapGuide}
          key={guide.id}
          style={getSnapGuideStyle(state, guide, previewScreenRect, devicePixelRatio)}
        />
      ))}
    </div>
  );
}

function InfiniteCanvasSnapOverlay({
  devicePixelRatio,
}: Readonly<{
  devicePixelRatio: number;
}>) {
  const state = useInfiniteCanvasState();
  const preview = state.snapPreview;
  const isActiveSnapInteraction =
    state.interaction?.kind === "move" || state.interaction?.kind === "resize";

  return preview === null || !isActiveSnapInteraction ? null : (
    <InfiniteCanvasSnapPreviewLayer devicePixelRatio={devicePixelRatio} preview={preview} />
  );
}

/**
 * The same guides, for a drag that has not landed yet.
 *
 * Only drawn when `dropPolicy.placement` told the framework how big the incoming
 * thing is — without that, there is no rect to snap and nothing honest to draw.
 */
function InfiniteCanvasDropSnapOverlay<Payload, Kind extends string>({
  devicePixelRatio,
  drop,
}: Readonly<{
  devicePixelRatio: number;
  drop: InfiniteCanvasDropInteraction<Payload, Kind>;
}>) {
  const preview = drop.status === "dragging" ? drop.placement?.preview : null;

  return preview === null || preview === undefined ? null : (
    <InfiniteCanvasSnapPreviewLayer devicePixelRatio={devicePixelRatio} preview={preview} />
  );
}

function getSnapGuideStyle(
  state: InfiniteCanvasState,
  guide: InfiniteCanvasSnapGuide,
  previewScreenRect: ReturnType<typeof projectWorldRectToScreen>["screenRect"],
  devicePixelRatio: number,
): CSSProperties {
  const position = snapScreenValueToDevicePixel(
    (guide.position - (guide.axis === "x" ? state.camera.center.x : state.camera.center.y)) *
      state.camera.zoom +
      (guide.axis === "x" ? state.viewport.width : state.viewport.height) / 2,
    devicePixelRatio,
  );
  const guideInsetPx = 18;

  if (guide.axis === "x") {
    return {
      height: `${previewScreenRect.height + guideInsetPx * 2}px`,
      left: `${position}px`,
      position: "absolute",
      top: `${previewScreenRect.top - guideInsetPx}px`,
      width: "1px",
    };
  }

  return {
    height: "1px",
    left: `${previewScreenRect.left - guideInsetPx}px`,
    position: "absolute",
    top: `${position}px`,
    width: `${previewScreenRect.width + guideInsetPx * 2}px`,
  };
}

function InfiniteCanvasMarqueeOverlay() {
  const state = useInfiniteCanvasState();
  const interaction = state.interaction;

  if (interaction?.kind !== "marquee") {
    return null;
  }

  const rect = getRectFromPoints(interaction.originPointer, interaction.currentPointer);

  if (rect.width < 2 && rect.height < 2) {
    return null;
  }

  return (
    <div
      style={{
        inset: 0,
        pointerEvents: "none",
        position: "absolute",
        zIndex: MARQUEE_OVERLAY_Z_INDEX,
      }}
    >
      <div
        data-infinite-canvas-marquee="true"
        data-mode={interaction.mode}
        data-slot={INFINITE_CANVAS_SLOTS.marquee}
        style={{
          boxSizing: "border-box",
          height: `${rect.height}px`,
          position: "absolute",
          transform: `translate3d(${rect.x}px, ${rect.y}px, 0)`,
          width: `${rect.width}px`,
        }}
      />
    </div>
  );
}

export {
  InfiniteCanvasDockPreviewOverlay,
  InfiniteCanvasDropSnapOverlay,
  InfiniteCanvasMarqueeOverlay,
  InfiniteCanvasSelectionBoundsOverlay,
  InfiniteCanvasSnapOverlay,
};
