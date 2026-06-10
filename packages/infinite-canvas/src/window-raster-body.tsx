"use client";

import { useEffect, useRef } from "react";

import { worldRectToScreenRect } from "./geometry";
import {
  useInfiniteCanvasRasterContext,
  useInfiniteCanvasRasterSnapshot,
  type InfiniteCanvasRasterizationPolicy,
} from "./rasterization";
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
  state,
  textSelection,
  window,
}: Readonly<{
  actions: InfiniteCanvasCommands<Kind>;
  chrome: InfiniteCanvasChromeMetrics;
  definition: InfiniteCanvasWindowDefinition<Kind>;
  isActive: boolean;
  isSelected: boolean;
  state: InfiniteCanvasState<Kind>;
  textSelection: InfiniteCanvasWindowTextSelection;
  window: InfiniteCanvasWindow<Kind>;
}>) {
  const liveBodyRef = useRef<HTMLDivElement | null>(null);
  const lastRequestedSignatureRef = useRef<string | null>(null);
  const raster = useInfiniteCanvasRasterContext();
  const snapshot = useInfiniteCanvasRasterSnapshot(window.id);
  const signature = getWindowRasterSignature(window, chrome, raster.policy);
  const isEligible = isWindowRasterizationEligible({
    definition,
    isActive,
    isSelected,
    policy: raster.policy,
    state,
    textSelection,
    window,
  });
  const hasMatchingSnapshot = snapshot?.signature === signature;
  const shouldUseSnapshot =
    isEligible && hasMatchingSnapshot && snapshot.status === "ready" && snapshot.src !== null;
  const shouldQueueCapture =
    isEligible &&
    state.interaction === null &&
    !shouldUseSnapshot &&
    !(hasMatchingSnapshot && snapshot?.status === "failed") &&
    lastRequestedSignatureRef.current !== signature;
  const shouldUseContentVisibility = !isActive && !isSelected && state.interaction === null;

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
        lastRequestedSignatureRef.current = signature;
        raster.queueCapture({
          element: node,
          height: getWindowBodyHeight(window, chrome),
          signature,
          width: window.rect.width,
          windowId: window.id,
        });
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

  if (shouldUseSnapshot) {
    return (
      <img
        alt=""
        aria-hidden="true"
        className="h-full w-full object-fill"
        draggable={false}
        src={snapshot.src}
        style={{
          pointerEvents: "none",
        }}
      />
    );
  }

  return (
    <div
      className="h-full w-full"
      ref={liveBodyRef}
      style={{
        contain: "layout paint style",
        containIntrinsicSize: `${window.rect.width}px ${getWindowBodyHeight(window, chrome)}px`,
        contentVisibility: shouldUseContentVisibility ? "auto" : "visible",
      }}
    >
      {definition.renderBody?.({
        actions,
        isActive,
        isSelected,
        state,
        window,
      })}
    </div>
  );
}

function getWindowBodyHeight<Kind extends string>(
  window: InfiniteCanvasWindow<Kind>,
  chrome: InfiniteCanvasChromeMetrics,
) {
  return Math.max(1, window.rect.height - chrome.headerHeight);
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

  return isWindowInsideRasterMargin(state, window, policy.viewportMarginPx);
}

function isWindowInsideRasterMargin<Kind extends string>(
  state: InfiniteCanvasState<Kind>,
  window: InfiniteCanvasWindow<Kind>,
  margin: number,
) {
  if (!Number.isFinite(margin)) {
    return true;
  }

  const rect = worldRectToScreenRect(state.camera, state.viewport, window.rect);

  return (
    rect.left + rect.width >= -margin &&
    rect.left <= state.viewport.width + margin &&
    rect.top + rect.height >= -margin &&
    rect.top <= state.viewport.height + margin
  );
}

export { InfiniteCanvasWindowBody };
