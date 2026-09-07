"use client";

import { useEffect, useMemo, useRef, type CSSProperties } from "react";

import { getInfiniteCanvasWindowDetailLevel, type InfiniteCanvasDetailLevel } from "./detail-level";
import { getWindowBodyRect, isWorldRectWithinViewport } from "./geometry";
import {
  useInfiniteCanvasRasterCaptureCapacity,
  useInfiniteCanvasRasterContext,
  useInfiniteCanvasRasterSnapshot,
  type InfiniteCanvasRasterizationPolicy,
} from "./rasterization";
import { useInfiniteCanvasSelector, useInfiniteCanvasStore } from "./store";
import type {
  InfiniteCanvasChromeMetrics,
  InfiniteCanvasCommands,
  InfiniteCanvasState,
  InfiniteCanvasWindow,
  InfiniteCanvasWindowDefinition,
  InfiniteCanvasWindowTextSelection,
} from "./types";

function InfiniteCanvasWindowBody<Kind extends string>({
  actions,
  chrome,
  definition,
  isActive,
  isSelected,
  textSelection,
  window,
}: Readonly<{
  actions: InfiniteCanvasCommands<Kind>;
  chrome: InfiniteCanvasChromeMetrics;
  definition: InfiniteCanvasWindowDefinition<Kind>;
  isActive: boolean;
  isSelected: boolean;
  textSelection: InfiniteCanvasWindowTextSelection;
  window: InfiniteCanvasWindow<Kind>;
}>) {
  const liveBodyRef = useRef<HTMLDivElement | null>(null);
  const lastRequestedSignatureRef = useRef<string | null>(null);
  const raster = useInfiniteCanvasRasterContext();
  const snapshot = useInfiniteCanvasRasterSnapshot(window.id);
  const signature = getWindowRasterSignature(window, chrome, raster.policy);

  // Subscribe to booleans so camera ticks do not rerender the body.
  const isEligible = useInfiniteCanvasSelector<Kind, boolean>((state) =>
    isWindowRasterizationEligible({
      definition,
      isActive,
      isSelected,
      policy: raster.policy,
      state,
      textSelection,
      window,
    }),
  );
  const isCanvasIdle = useInfiniteCanvasSelector<Kind, boolean>(
    (state) => state.interaction === null,
  );

  const hasMatchingSnapshot = snapshot?.signature === signature;
  const shouldUseSnapshot =
    isEligible && hasMatchingSnapshot && snapshot.status === "ready" && snapshot.src !== null;
  const wantsCapture =
    isEligible &&
    isCanvasIdle &&
    !shouldUseSnapshot &&
    !(hasMatchingSnapshot && snapshot?.status === "failed") &&
    lastRequestedSignatureRef.current !== signature;
  // Waiting bodies subscribe until the queue has capacity.
  const hasCaptureCapacity = useInfiniteCanvasRasterCaptureCapacity(wantsCapture);
  const shouldQueueCapture = wantsCapture && hasCaptureCapacity;
  const shouldUseContentVisibility = !isActive && !isSelected && isCanvasIdle;

  useEffect(() => {
    raster.setDisplayMode(window.id, shouldUseSnapshot ? "snapshot" : "live");
  }, [raster, shouldUseSnapshot, window.id]);

  useEffect(() => {
    if (hasMatchingSnapshot) {
      lastRequestedSignatureRef.current = signature;
    }
  }, [hasMatchingSnapshot, signature]);

  useEffect(() => {
    if (!shouldQueueCapture) {
      return;
    }

    const node = liveBodyRef.current;

    if (node === null) {
      return;
    }

    const timeout = globalThis.setTimeout(
      () => {
        // Record the signature only after the queue accepts the request.
        const captured = getWindowBodyRect(window.rect, chrome);
        // Capture the body box. The rect includes the frame border, which the body does not.
        const isQueued = raster.queueCapture({
          element: node,
          height: captured.height,
          signature,
          width: captured.width,
          windowId: window.id,
        });

        if (isQueued) {
          lastRequestedSignatureRef.current = signature;
        }
      },
      getWindowCaptureDelayMs(window.id, raster.policy),
    );

    return () => {
      globalThis.clearTimeout(timeout);
    };
  }, [
    chrome,
    raster,
    raster.policy.captureDelayMs,
    raster.policy.captureStaggerMs,
    shouldQueueCapture,
    signature,
    window.id,
    window.rect.height,
    window.rect.width,
  ]);

  const renderedBody = useRenderedWindowBody({
    actions,
    chrome,
    definition,
    isActive,
    isSelected,
    window,
  });
  const bodyScrolls = isInfiniteCanvasScrollingOverflow(definition.overflowY);
  // The frame border sits inside the window rect, so the body box is smaller than the rect.
  const bodyRect = getWindowBodyRect(window.rect, chrome);

  if (shouldUseSnapshot) {
    return (
      <img
        alt=""
        aria-hidden="true"
        draggable={false}
        src={snapshot.src}
        style={{
          height: "100%",
          objectFit: "fill",
          pointerEvents: "none",
          width: "100%",
        }}
      />
    );
  }

  return (
    <div
      ref={liveBodyRef}
      style={{
        contain: "layout paint style",
        containIntrinsicSize: `${bodyRect.width}px ${bodyRect.height}px`,
        contentVisibility: shouldUseContentVisibility ? "auto" : "visible",
        // Scrolling bodies can grow. Other bodies stay pinned to the container.
        height: bodyScrolls ? undefined : "100%",
        minHeight: bodyScrolls ? "100%" : undefined,
        width: "100%",
      }}
    >
      {renderedBody}
    </div>
  );
}

function useRenderedWindowBody<Kind extends string>({
  actions,
  chrome,
  definition,
  isActive,
  isSelected,
  window,
}: Readonly<{
  actions: InfiniteCanvasCommands<Kind>;
  chrome: InfiniteCanvasChromeMetrics;
  definition: InfiniteCanvasWindowDefinition<Kind>;
  isActive: boolean;
  isSelected: boolean;
  window: InfiniteCanvasWindow<Kind>;
}>) {
  const store = useInfiniteCanvasStore<Kind>();

  // Read store state on demand so camera ticks do not rerender the body.
  // Subscribe only to the semantic detail level.
  const detailLevelRef = useRef<InfiniteCanvasDetailLevel>("full");
  const detailLevel = useInfiniteCanvasSelector<Kind, InfiniteCanvasDetailLevel>((state) =>
    definition.renderSummary === undefined
      ? "full"
      : getInfiniteCanvasWindowDetailLevel(window.rect, state.camera.zoom, detailLevelRef.current),
  );

  detailLevelRef.current = detailLevel;

  return useMemo(() => {
    const body = getWindowBodyRect(window.rect, chrome);
    const context = {
      actions,
      bodySize: { height: body.height, width: body.width },
      isActive,
      isSelected,
      get state() {
        return store.state$.peek() as InfiniteCanvasState<Kind>;
      },
      window,
    };

    return detailLevel === "summary" && definition.renderSummary !== undefined
      ? definition.renderSummary(context)
      : definition.renderBody?.(context);
  }, [actions, chrome, definition, detailLevel, isActive, isSelected, store, window]);
}

/** Returns whether `overflowY` creates a scroll container. */
function isInfiniteCanvasScrollingOverflow(overflowY: CSSProperties["overflowY"]) {
  const resolved = overflowY ?? "auto";

  return resolved === "auto" || resolved === "scroll" || resolved === "overlay";
}

function getWindowCaptureDelayMs(windowId: string, policy: InfiniteCanvasRasterizationPolicy) {
  return policy.captureDelayMs + getStableWindowStaggerIndex(windowId) * policy.captureStaggerMs;
}

function getStableWindowStaggerIndex(windowId: string) {
  return Array.from(windowId).reduce(
    (hash, character) => (hash * 31 + character.charCodeAt(0)) % 32,
    0,
  );
}

function getWindowRasterSignature<Kind extends string>(
  window: InfiniteCanvasWindow<Kind>,
  chrome: InfiniteCanvasChromeMetrics,
  policy: InfiniteCanvasRasterizationPolicy,
) {
  return [
    policy.adapter,
    policy.cache,
    policy.dpr,
    policy.format,
    window.id,
    window.kind,
    window.title,
    window.rect.width,
    window.rect.height,
    chrome.headerHeight,
    window.isPinned ? "pinned" : "normal",
    getJsonSignaturePart(window.data),
  ].join("|");
}

function getJsonSignaturePart(value: unknown) {
  if (value === undefined) {
    return "";
  }

  try {
    return JSON.stringify(value) ?? "";
  } catch {
    return "unserializable";
  }
}

function isWindowRasterizationEligible<Kind extends string>({
  definition,
  isActive,
  isSelected,
  policy,
  state,
  textSelection,
  window,
}: Readonly<{
  definition: InfiniteCanvasWindowDefinition<Kind>;
  isActive: boolean;
  isSelected: boolean;
  policy: InfiniteCanvasRasterizationPolicy;
  state: InfiniteCanvasState<Kind>;
  textSelection: InfiniteCanvasWindowTextSelection;
  window: InfiniteCanvasWindow<Kind>;
}>) {
  if (
    !policy.enabled ||
    definition.renderBody === undefined ||
    definition.wheelBehavior === "native-scroll" ||
    isActive ||
    isSelected ||
    textSelection === "native"
  ) {
    return false;
  }

  if (state.interaction?.kind === "move" || state.interaction?.kind === "resize") {
    return state.interaction.windowId !== window.id;
  }

  return isWorldRectWithinViewport(
    state.camera,
    state.viewport,
    window.rect,
    policy.viewportMarginPx,
  );
}

export { InfiniteCanvasWindowBody };
