"use client";

import type { CSSProperties } from "react";

import { INFINITE_CANVAS_SLOTS } from "./data-attributes";
import {
  getRectFromPoints,
  projectWorldRectToScreen,
  snapScreenValueToDevicePixel,
} from "./geometry";
import { getSelectedWindowBounds } from "./selection";
import { useInfiniteCanvasState } from "./store";
import type { InfiniteCanvasSnapGuide, InfiniteCanvasState, InfiniteCanvasTheme } from "./types";

function InfiniteCanvasSelectionBoundsOverlay({
  devicePixelRatio,
  theme,
}: Readonly<{
  devicePixelRatio: number;
  theme: InfiniteCanvasTheme;
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
    <div className="pointer-events-none absolute inset-0 z-[999999996]">
      <div
        className="absolute border"
        data-infinite-canvas-selection-bounds="true"
        data-slot={INFINITE_CANVAS_SLOTS.selectionBounds}
        style={{
          borderColor: theme.selectionBounds,
          boxSizing: "border-box",
          borderStyle: "dashed",
          height: `${rect.height}px`,
          transform: `translate3d(${rect.left}px, ${rect.top}px, 0)`,
          width: `${rect.width}px`,
        }}
      />
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

  if (preview === null || !isActiveSnapInteraction) {
    return null;
  }

  const previewProjection = projectWorldRectToScreen(
    state.camera,
    state.viewport,
    preview.rect,
    devicePixelRatio,
  );
  const previewTransform = previewProjection.screenTransform;
  const previewScreenRect = previewProjection.screenRect;
  const visibleGuides = preview.guides.filter((guide) => guide.from === "window");

  return (
    <div className="pointer-events-none absolute inset-0 z-[999999998]">
      <div
        className="absolute border border-[#b7f4ff]/45 bg-[#b7f4ff]/[0.035]"
        data-slot={INFINITE_CANVAS_SLOTS.snapPreview}
        style={{
          boxSizing: "border-box",
          height: `${previewTransform.height}px`,
          transform: `translate3d(${previewTransform.x}px, ${previewTransform.y}px, 0) scale(${previewTransform.scale})`,
          transformOrigin: "top left",
          width: `${previewTransform.width}px`,
        }}
      />
      {visibleGuides.map((guide) => (
        <div
          className="absolute"
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
  const guideColor = "rgba(183,244,255,0.55)";
  const guideInsetPx = 18;

  if (guide.axis === "x") {
    return {
      backgroundImage: `repeating-linear-gradient(to bottom, ${guideColor} 0 4px, transparent 4px 8px)`,
      height: `${previewScreenRect.height + guideInsetPx * 2}px`,
      left: `${position}px`,
      opacity: 0.72,
      top: `${previewScreenRect.top - guideInsetPx}px`,
      width: "1px",
    };
  }

  return {
    backgroundImage: `repeating-linear-gradient(to right, ${guideColor} 0 4px, transparent 4px 8px)`,
    height: "1px",
    left: `${previewScreenRect.left - guideInsetPx}px`,
    opacity: 0.72,
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
    <div className="pointer-events-none absolute inset-0 z-[999999997]">
      <div
        className="absolute border border-[#b7f4ff]/80 bg-[#b7f4ff]/10 shadow-[inset_0_0_0_1px_rgba(183,244,255,0.16)]"
        data-infinite-canvas-marquee="true"
        data-mode={interaction.mode}
        data-slot={INFINITE_CANVAS_SLOTS.marquee}
        style={{
          height: `${rect.height}px`,
          transform: `translate3d(${rect.x}px, ${rect.y}px, 0)`,
          width: `${rect.width}px`,
        }}
      />
    </div>
  );
}

export {
  InfiniteCanvasMarqueeOverlay,
  InfiniteCanvasSelectionBoundsOverlay,
  InfiniteCanvasSnapOverlay,
};
