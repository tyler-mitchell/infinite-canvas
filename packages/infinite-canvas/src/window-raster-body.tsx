"use client";

import { useEffect, useMemo, useRef, type CSSProperties } from "react";

import { getInfiniteCanvasWindowDetailLevel, type InfiniteCanvasDetailLevel } from "./detail-level";
import { isWorldRectWithinViewport } from "./geometry";
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
  const bodyScrolls = isInfiniteCanvasScrollingOverflow(definition.overflowY);

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
        /*
         * Which of the two the kind gets is the kind's own `overflowY`, and both are wrong for the
         * other case.
         *
         * `minHeight`, for a body that scrolls. The body slot above is the scroll container — it
         * carries `overflowY: definition.overflowY ?? "auto"` — and a wrapper locked to exactly its
         * height means that container can never have anything to scroll. A body taller than its
         * window was silently unreachable: no scrollbar, no wheel, no keyboard, for every consumer.
         *
         * `height`, for a body that does not. A kind that declares `hidden` or `clip` has said it
         * will not scroll, so there is no overflow to preserve — and under `minHeight` alone the
         * wrapper's used height is `auto`, which means a consumer's own `height: 100%` resolves
         * against nothing and collapses to its content. Filling the window was therefore impossible
         * for exactly the kinds whose content is meant to fit it: found on an image window, where
         * `height: 100%` on the picture's bed silently became `height: auto` and the picture
         * overflowed the frame it was supposed to be letterboxed inside.
         *
         * Containment stays either way: with a pinned height `paint` clips what the kind already
         * said to clip, and with an auto height there is nothing overflowing to clip.
         */
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
  // Semantic LOD. The selector collapses camera zoom to one of two strings, which is what keeps
  // this out of the camera loop for the same reason the booleans above are: a pan recomputes it
  // every tick and re-renders nothing, because the answer did not change. Returning the screen
  // extent instead would re-render every window on every frame.
  //
  // A kind with no `renderSummary` short-circuits to `full`, so the lane costs nothing — not a
  // re-render, not a threshold comparison that could ever flip — for the windows that opted out.
  //
  // The ref carries the previous answer, which is what makes the hysteresis band work while
  // `getInfiniteCanvasWindowDetailLevel` stays pure. Writing it during render is the documented
  // caching use of a ref, and it is idempotent: inside the band the function returns the value
  // that is already there.
  const detailLevelRef = useRef<InfiniteCanvasDetailLevel>("full");
  const detailLevel = useInfiniteCanvasSelector<Kind, InfiniteCanvasDetailLevel>((state) =>
    definition.renderSummary === undefined
      ? "full"
      : getInfiniteCanvasWindowDetailLevel(window.rect, state.camera.zoom, detailLevelRef.current),
  );

  detailLevelRef.current = detailLevel;

  return useMemo(() => {
    const context = {
      actions,
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
  }, [actions, definition, detailLevel, isActive, isSelected, store, window]);
}

function getWindowBodyHeight<Kind extends string>(
  window: InfiniteCanvasWindow<Kind>,
  chrome: InfiniteCanvasChromeMetrics,
) {
  return Math.max(1, window.rect.height - chrome.headerHeight);
}

/**
 * Whether a kind's `overflowY` makes its body slot a scroll container.
 *
 * Asked of the declaration rather than of the element, because the answer decides the wrapper's
 * height and the element does not exist yet. Undefined resolves to `auto`, matching what the body
 * slot itself falls back to — the two must agree, or the wrapper would pin a height on a container
 * that does scroll.
 *
 * `visible` is deliberately on the non-scrolling side. It overflows rather than scrolls, so there
 * is nothing for a taller wrapper to reveal.
 */
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
