"use client";

import { useEffect, useMemo, useRef } from "react";

import { worldRectToScreenRect } from "./geometry";
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

  // Both of these derive from live canvas state, and both collapse it to a
  // boolean. Subscribing to the booleans rather than taking `state` as a prop
  // is what keeps the body out of the camera loop: a pan recomputes them every
  // tick and re-renders nothing, because neither answer changed.
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
  // Capacity is part of the condition, not a guard inside the effect. A refused
  // window keeps `wantsCapture === true` across the refusal, so without this the dep
  // array never changes and the effect never re-fires — the window waits forever.
  // The full -> not-full crossing is the only edge that can move a dep here.
  //
  // Subscribed only while this body is actually waiting, so a drain wakes the windows
  // that still need a capture and no others.
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
        // Only record the request once the queue has taken it. Marking it made
        // regardless is how a refused capture becomes a window that waits forever:
        // `shouldQueueCapture` goes false on the signature it never actually
        // requested, and nothing ever asks again.
        const isQueued = raster.queueCapture({
          element: node,
          height: getWindowBodyHeight(window, chrome),
          signature,
          width: window.rect.width,
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
    definition,
    isActive,
    isSelected,
    window,
  });

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
        containIntrinsicSize: `${window.rect.width}px ${getWindowBodyHeight(window, chrome)}px`,
        contentVisibility: shouldUseContentVisibility ? "auto" : "visible",
        height: "100%",
        width: "100%",
      }}
    >
      {renderedBody}
    </div>
  );
}

function useRenderedWindowBody<Kind extends string>({
  actions,
  definition,
  isActive,
  isSelected,
  window,
}: Readonly<{
  actions: InfiniteCanvasCommands<Kind>;
  definition: InfiniteCanvasWindowDefinition<Kind>;
  isActive: boolean;
  isSelected: boolean;
  window: InfiniteCanvasWindow<Kind>;
}>) {
  const store = useInfiniteCanvasStore<Kind>();

  // The body subtree must NOT reconcile on every camera/selection tick:
  // shell movement re-renders the frame each frame, and re-invoking
  // renderBody there reconciles every live body in the document — the
  // dominant interactive cost at stress scale. `state` is therefore peeked
  // from the store at body render time (fresh whenever the body re-renders
  // for its own reasons) instead of being an invalidation dependency; body
  // content that needs live state should subscribe with
  // useInfiniteCanvasSelector inside its own component so invalidation
  // stays scoped to what it actually reads.
  return useMemo(
    () =>
      definition.renderBody?.({
        actions,
        isActive,
        isSelected,
        get state() {
          return store.state$.peek() as InfiniteCanvasState<Kind>;
        },
        window,
      }),
    [actions, definition, isActive, isSelected, store, window],
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
