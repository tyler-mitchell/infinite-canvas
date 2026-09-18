"use client";

import { useValue } from "@legendapp/state/react";
import {
  useEffect,
  useEffectEvent,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  type CSSProperties,
} from "react";
import { type } from "arktype";
import { useResizeObserver } from "use-resize-observer";
import { editComponentProps, type ComponentRenderContext } from "./component";

import { useInfiniteCanvasDetailLevel } from "./react/detail-level";
import { getWindowBodyRect, isWorldRectWithinViewport } from "./geometry";
import {
  useInfiniteCanvasRasterCaptureCapacity,
  useInfiniteCanvasRasterContext,
  useInfiniteCanvasRasterSnapshot,
  type InfiniteCanvasRasterizationPolicy,
} from "./rasterization";
import { useInfiniteCanvasSelector, useInfiniteCanvasStore } from "./react/store";
import type {
  InfiniteCanvasChromeMetrics,
  InfiniteCanvasDispatch,
  InfiniteCanvasRect,
  InfiniteCanvasState,
  InfiniteCanvasWindow,
  InfiniteCanvasWindowDefinition,
  InfiniteCanvasWindowTextSelection,
} from "./types";

function InfiniteCanvasWindowBody<Kind extends string>({
  dispatch,
  chrome,
  definition,
  isActive,
  isSelected,
  rect,
  textSelection,
  window,
}: Readonly<{
  dispatch: InfiniteCanvasDispatch<Kind>;
  chrome: InfiniteCanvasChromeMetrics;
  definition: InfiniteCanvasWindowDefinition<Kind>;
  isActive: boolean;
  isSelected: boolean;
  rect: InfiniteCanvasRect;
  textSelection: InfiniteCanvasWindowTextSelection;
  window: InfiniteCanvasWindow<Kind>;
}>) {
  const liveBodyRef = useRef<HTMLDivElement | null>(null);
  const lastRequestedSignatureRef = useRef<string | null>(null);
  const raster = useInfiniteCanvasRasterContext();
  const store = useInfiniteCanvasStore<Kind>();
  const isComponent = definition.renderComponent !== undefined;
  const detailLevel = useInfiniteCanvasDetailLevel(rect, definition.renderSummary !== undefined);
  const [contentHeight, setContentHeight] = useState<number | null>(null);
  const [editError, setEditError] = useState<string | null>(null);
  const { height, width } = useResizeObserver<HTMLDivElement>({
    ref: liveBodyRef,
    box: "border-box",
    round: Number,
  });
  const componentContext = useMemo<ComponentRenderContext>(
    () => ({
      camera: store.camera,
      windowId: window.id,
      onPropsChange: (props) => {
        const result = editComponentProps({ store, input: { windowId: window.id, props } });
        if (result instanceof type.errors) setEditError(result.summary);
        else setEditError(result instanceof Error ? result.message : null);
      },
      onContentHeightChange: (height) => {
        if (Number.isFinite(height) && height > 0) setContentHeight(height);
      },
    }),
    [store, window.id],
  );
  const reportContentHeight = useEffectEvent((height: number) => {
    const body = liveBodyRef.current?.closest<HTMLElement>("[data-infinite-canvas-body]");
    const surface = body?.offsetParent;
    const chromeHeight =
      body !== null && body !== undefined && surface instanceof HTMLElement
        ? (surface.getBoundingClientRect().height - body.getBoundingClientRect().height) /
          store.getState().camera.zoom
        : chrome.headerHeight + chrome.borderWidth * 2;
    dispatch({
      type: "window.setContentHeight",
      windowId: window.id,
      height: height + chromeHeight,
    });
  });
  useLayoutEffect(() => {
    if (
      !isComponent ||
      detailLevel === "summary" ||
      (window.heightMode === "manual" && window.aspectRatio === undefined) ||
      height === undefined ||
      height <= 0
    )
      return;
    reportContentHeight(contentHeight ?? height);
  }, [
    isComponent,
    detailLevel,
    window.heightMode,
    window.aspectRatio,
    contentHeight,
    height,
    width,
    chrome.headerHeight,
    chrome.borderWidth,
  ]);
  const snapshot = useInfiniteCanvasRasterSnapshot(window.id);
  const isEligible = useInfiniteCanvasSelector<Kind, boolean>((state) =>
    isWindowRasterizationEligible({
      definition,
      isActive,
      isSelected,
      policy: raster.policy,
      state,
      textSelection,
      rect,
      window,
    }),
  );
  const signature = isEligible
    ? getWindowRasterSignature(window, rect, chrome, raster.policy)
    : null;
  const isCanvasIdle = useValue(
    () => raster.policy.enabled && store.state$.interaction.get() === null,
  );

  const hasMatchingSnapshot = snapshot?.signature === signature;
  const shouldUseSnapshot =
    signature !== null &&
    hasMatchingSnapshot &&
    snapshot.status === "ready" &&
    snapshot.src !== null;
  const wantsCapture =
    signature !== null &&
    isCanvasIdle &&
    !shouldUseSnapshot &&
    !(hasMatchingSnapshot && snapshot?.status === "failed") &&
    lastRequestedSignatureRef.current !== signature;
  // Waiting bodies subscribe until the queue has capacity.
  const hasCaptureCapacity = useInfiniteCanvasRasterCaptureCapacity(wantsCapture);
  const shouldQueueCapture = wantsCapture && hasCaptureCapacity;

  useEffect(() => {
    raster.setDisplayMode(window.id, shouldUseSnapshot ? "snapshot" : "live");
  }, [raster, shouldUseSnapshot, window.id]);

  useEffect(() => {
    if (isEligible && signature === null)
      console.warn("Window data cannot be cached; keeping live content", { windowId: window.id });
  }, [isEligible, signature, window.id]);

  useEffect(() => {
    if (hasMatchingSnapshot) {
      lastRequestedSignatureRef.current = signature;
    }
  }, [hasMatchingSnapshot, signature]);

  useEffect(() => {
    if (!shouldQueueCapture || signature === null) {
      return;
    }

    const node = liveBodyRef.current;

    if (node === null) {
      return;
    }

    const timeout = globalThis.setTimeout(
      () => {
        // Record the signature only after the queue accepts the request.
        const captured = getWindowBodyRect(rect, chrome);
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
    rect.height,
    rect.width,
  ]);

  const renderedComponent = useMemo(() => {
    if (definition.renderComponent === undefined) return null;
    if (definition.schema === undefined)
      return <p role="alert">The component schema is missing.</p>;
    const props = definition.schema(window.data);
    return props instanceof type.errors ? (
      <p role="alert">{props.summary}</p>
    ) : (
      definition.renderComponent(props, componentContext)
    );
  }, [definition.renderComponent, definition.schema, window.data, componentContext]);
  const renderedBody = useMemo(() => {
    const body = getWindowBodyRect(rect, chrome);
    const context = {
      dispatch,
      bodySize: { height: body.height, width: body.width },
      isActive,
      isSelected,
      rect,
      get state() {
        return store.state$.peek() as InfiniteCanvasState<Kind>;
      },
      window,
    };
    if (detailLevel === "summary" && definition.renderSummary !== undefined)
      return definition.renderSummary(context);
    if (definition.renderComponent !== undefined) return renderedComponent;
    return definition.renderBody?.(context) ?? null;
  }, [
    dispatch,
    chrome,
    definition,
    detailLevel,
    isActive,
    isSelected,
    rect,
    store,
    window,
    renderedComponent,
  ]);
  if (textSelection === "native" && !isComponent) return renderedBody;
  const bodyScrolls = isInfiniteCanvasScrollingOverflow(definition.overflowY);
  const contentStyle: CSSProperties = isComponent
    ? {
        display: "flex",
        flexDirection: "column",
        height: window.heightMode === "manual" || contentHeight !== null ? "100%" : undefined,
      }
    : {
        contain: "layout paint style",
        height: bodyScrolls ? undefined : "100%",
        minHeight: bodyScrolls ? "100%" : undefined,
      };

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
      data-slot={isComponent ? "component-content" : undefined}
      data-height-mode={window.heightMode ?? "content"}
      style={{
        ...contentStyle,
        width: "100%",
      }}
    >
      {renderedBody}
      {editError === null ? null : <p role="alert">{editError}</p>}
    </div>
  );
}

/** Returns whether `overflowY` creates a scroll container. */
function isInfiniteCanvasScrollingOverflow(overflowY: CSSProperties["overflowY"]) {
  const resolved = overflowY ?? "auto";

  return resolved === "auto" || resolved === "scroll" || resolved === "overlay";
}

function getWindowCaptureDelayMs(windowId: string, policy: InfiniteCanvasRasterizationPolicy) {
  const stagger = Array.from(windowId).reduce(
    (hash, character) => (hash * 31 + character.charCodeAt(0)) % 32,
    0,
  );
  return policy.captureDelayMs + stagger * policy.captureStaggerMs;
}

export function getWindowRasterSignature<Kind extends string>(
  window: InfiniteCanvasWindow<Kind>,
  rect: InfiniteCanvasRect,
  chrome: InfiniteCanvasChromeMetrics,
  policy: Pick<InfiniteCanvasRasterizationPolicy, "adapter" | "cache" | "dpr" | "format">,
) {
  try {
    return JSON.stringify({
      adapter: policy.adapter,
      cache: policy.cache,
      dpr: policy.dpr,
      format: policy.format,
      id: window.id,
      kind: window.kind,
      title: window.title,
      width: rect.width,
      height: rect.height,
      chrome,
      isPinned: window.isPinned,
      data: window.data,
    });
  } catch {
    return null;
  }
}

function isWindowRasterizationEligible<Kind extends string>({
  definition,
  isActive,
  isSelected,
  policy,
  state,
  textSelection,
  rect,
  window,
}: Readonly<{
  definition: InfiniteCanvasWindowDefinition<Kind>;
  isActive: boolean;
  isSelected: boolean;
  policy: InfiniteCanvasRasterizationPolicy;
  state: InfiniteCanvasState<Kind>;
  textSelection: InfiniteCanvasWindowTextSelection;
  rect: InfiniteCanvasRect;
  window: InfiniteCanvasWindow<Kind>;
}>) {
  if (
    !policy.enabled ||
    (definition.renderBody === undefined && definition.renderComponent === undefined) ||
    definition.wheelBehavior === "native-scroll" ||
    isActive ||
    isSelected ||
    textSelection === "native"
  ) {
    return false;
  }

  if (state.interaction?.kind === "move") {
    return !state.interaction.originRects.some(
      ({ target }) => target.type === "window" && target.id === window.id,
    );
  }
  if (state.interaction?.kind === "resize") {
    return state.interaction.windowId !== window.id;
  }

  return isWorldRectWithinViewport(state.camera, state.viewport, rect, policy.viewportMarginPx);
}

export { InfiniteCanvasWindowBody };
