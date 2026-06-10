"use client";

import { useMemo, type CSSProperties, type ReactNode } from "react";

import { INFINITE_CANVAS_SLOTS, getInfiniteCanvasWindowStateAttributes } from "./data-attributes";
import {
  DEFAULT_INFINITE_CANVAS_WINDOW_FRAME_SLOTS,
  InfiniteCanvasWindowFrameRuntimeContext,
  getEventViewportPoint,
  type InfiniteCanvasWindowFrameRuntimeContextValue,
} from "./frame-slots";
import { projectWorldRectToScreen } from "./geometry";
import {
  capturePointer,
  clearNativeTextSelection,
  isPrimaryButton,
  releasePointer,
} from "./runtime";
import { getWindowStackValue } from "./stacking";
import { useInfiniteCanvasActions } from "./store";
import type {
  InfiniteCanvasChromeMetrics,
  InfiniteCanvasResizeHandle,
  InfiniteCanvasStackBands,
  InfiniteCanvasState,
  InfiniteCanvasTheme,
  InfiniteCanvasWindow,
  InfiniteCanvasWindowFrameRenderContext,
  InfiniteCanvasWindowRegistry,
} from "./types";

function InfiniteCanvasWindowFrame<Kind extends string>({
  chrome,
  devicePixelRatio,
  isActive,
  isSelected,
  stackBands,
  state,
  theme,
  window,
  windowDefinitions,
}: Readonly<{
  chrome: InfiniteCanvasChromeMetrics;
  devicePixelRatio: number;
  isActive: boolean;
  isSelected: boolean;
  stackBands: InfiniteCanvasStackBands;
  state: InfiniteCanvasState<Kind>;
  theme: InfiniteCanvasTheme;
  window: InfiniteCanvasWindow<Kind>;
  windowDefinitions: InfiniteCanvasWindowRegistry<Kind>;
}>) {
  const actions = useInfiniteCanvasActions<Kind>();
  const definition = windowDefinitions[window.kind];
  const frameChrome = definition.frameChrome ?? "dom";
  const isHostLocalChrome = frameChrome === "host" || frameChrome === "scene";
  const textSelection = definition.textSelection ?? "none";
  const bodyPointerBehavior = definition.bodyPointerBehavior ?? "native";
  const screenTransform = projectWorldRectToScreen(
    state.camera,
    state.viewport,
    window.rect,
    devicePixelRatio,
  ).screenTransform;
  const resizeHandles = useMemo(
    () => getResizeHandleDescriptors(chrome.resizeHandleSize / state.camera.zoom),
    [chrome.resizeHandleSize, state.camera.zoom],
  );
  const articleStyle: CSSProperties = {
    contain: "layout paint style",
    height: `${screenTransform.height}px`,
    left: "0px",
    pointerEvents: "none",
    position: "absolute",
    top: "0px",
    transform: `translate(${screenTransform.x}px, ${screenTransform.y}px) scale(${screenTransform.scale})`,
    transformOrigin: "top left",
    width: `${screenTransform.width}px`,
    zIndex: getWindowStackValue(window, stackBands),
  };
  const FrameTitle = DEFAULT_INFINITE_CANVAS_WINDOW_FRAME_SLOTS.Title;
  const FrameControls = DEFAULT_INFINITE_CANVAS_WINDOW_FRAME_SLOTS.Controls;
  const FrameHeader = DEFAULT_INFINITE_CANVAS_WINDOW_FRAME_SLOTS.Header;
  const FrameBody = DEFAULT_INFINITE_CANVAS_WINDOW_FRAME_SLOTS.Body;
  const FrameActiveCorners = DEFAULT_INFINITE_CANVAS_WINDOW_FRAME_SLOTS.ActiveCorners;
  const FrameSurface = DEFAULT_INFINITE_CANVAS_WINDOW_FRAME_SLOTS.Surface;
  const renderDefaultFrame = (): ReactNode =>
    isHostLocalChrome ? (
      <FrameSurface>
        <InfiniteCanvasWindowHostChrome chrome={chrome} />
        <FrameHeader
          style={{
            borderBottomWidth: 0,
            zIndex: 3,
          }}
        >
          <>
            <FrameTitle />
            <FrameControls />
          </>
        </FrameHeader>
        <FrameBody
          style={{
            bottom: `${chrome.borderWidth}px`,
            left: `${chrome.borderWidth}px`,
            right: `${chrome.borderWidth}px`,
            top: `${chrome.headerHeight}px`,
            zIndex: 2,
          }}
        />
        <FrameActiveCorners style={{ zIndex: 4 }} />
      </FrameSurface>
    ) : (
      <FrameSurface>
        <FrameHeader />
        <FrameBody />
        <FrameActiveCorners />
      </FrameSurface>
    );
  const frameRuntimeContext = {
    actions,
    bodyPointerBehavior,
    chrome,
    definition,
    isActive,
    isSelected,
    state,
    textSelection,
    theme,
    window,
  } satisfies InfiniteCanvasWindowFrameRuntimeContextValue<Kind>;
  const frameContext = {
    actions,
    chrome,
    frame: {
      ActiveCorners: FrameActiveCorners,
      Body: FrameBody,
      Controls: FrameControls,
      Header: FrameHeader,
      Surface: FrameSurface,
      Title: FrameTitle,
    },
    isActive,
    isSelected,
    renderDefaultFrame,
    state,
    theme,
    window,
  } satisfies InfiniteCanvasWindowFrameRenderContext<Kind>;
  const frameNode = definition.renderFrame?.(frameContext) ?? renderDefaultFrame();

  return (
    <InfiniteCanvasWindowFrameRuntimeContext.Provider value={frameRuntimeContext}>
      <article
        aria-label={window.title}
        aria-selected={isSelected}
        data-frame-chrome={isHostLocalChrome ? "host" : "dom"}
        data-infinite-canvas-window-id={window.id}
        data-kind={window.kind}
        data-mode={window.mode}
        data-slot={INFINITE_CANVAS_SLOTS.window}
        {...getInfiniteCanvasWindowStateAttributes({
          isActive,
          isPinned: window.isPinned,
          isSelected,
        })}
        role="group"
        style={articleStyle}
      >
        {frameNode}
        {resizeHandles.map((handle) => (
          <div
            data-handle={handle.handle}
            data-infinite-canvas-control="true"
            data-slot={INFINITE_CANVAS_SLOTS.resizeHandle}
            key={`${window.id}-${handle.handle}`}
            onLostPointerCapture={(event) => {
              actions.finishInteraction(event.pointerId);
            }}
            onPointerCancel={(event) => {
              actions.finishInteraction(event.pointerId);
            }}
            onPointerDown={(event) => {
              if (!isPrimaryButton(event)) {
                return;
              }

              event.preventDefault();
              event.stopPropagation();
              clearNativeTextSelection();
              capturePointer(event.currentTarget, event.pointerId);
              actions.startResize({
                handle: handle.handle,
                pointerId: event.pointerId,
                point: getEventViewportPoint(event),
                windowId: window.id,
              });
            }}
            onPointerMove={(event) => {
              actions.stepInteraction({
                pointerId: event.pointerId,
                point: getEventViewportPoint(event),
              });
            }}
            onPointerUp={(event) => {
              releasePointer(event.currentTarget, event.pointerId);
              actions.finishInteraction(event.pointerId);
            }}
            style={{
              ...handle.style,
              cursor: handle.cursor,
              pointerEvents: "auto",
              position: "absolute",
              zIndex: 4,
            }}
          />
        ))}
      </article>
    </InfiniteCanvasWindowFrameRuntimeContext.Provider>
  );
}

function InfiniteCanvasWindowHostChrome({
  chrome,
}: Readonly<{
  chrome: InfiniteCanvasChromeMetrics;
}>) {
  return (
    <div
      aria-hidden="true"
      data-slot={INFINITE_CANVAS_SLOTS.windowHostChrome}
      style={{
        inset: 0,
        pointerEvents: "none",
        position: "absolute",
        zIndex: 0,
      }}
    >
      <div
        data-layer="fill"
        style={{
          inset: 0,
          position: "absolute",
        }}
      />
      <div
        data-layer="header"
        style={{
          height: `${chrome.headerHeight}px`,
          left: 0,
          position: "absolute",
          right: 0,
          top: 0,
        }}
      />
      <div
        data-layer="accent"
        style={{
          height: `${chrome.headerAccentHeight}px`,
          left: 0,
          position: "absolute",
          right: 0,
          top: `${Math.max(chrome.headerHeight - chrome.headerAccentHeight, 0)}px`,
        }}
      />
      <div
        data-layer="frame"
        style={{
          borderWidth: `${chrome.borderWidth}px`,
          inset: 0,
          position: "absolute",
        }}
      />
      <div
        data-layer="inner-frame"
        style={{
          inset: "1px",
          position: "absolute",
        }}
      />
    </div>
  );
}

function getResizeHandleDescriptors(size: number): readonly Readonly<{
  cursor: CSSProperties["cursor"];
  handle: InfiniteCanvasResizeHandle;
  style: CSSProperties;
}>[] {
  const halfSize = size / 2;

  return [
    {
      cursor: "ns-resize",
      handle: "north",
      style: {
        height: `${size}px`,
        left: `${size}px`,
        right: `${size}px`,
        top: `${-halfSize}px`,
      },
    },
    {
      cursor: "ns-resize",
      handle: "south",
      style: {
        bottom: `${-halfSize}px`,
        height: `${size}px`,
        left: `${size}px`,
        right: `${size}px`,
      },
    },
    {
      cursor: "ew-resize",
      handle: "east",
      style: {
        bottom: `${size}px`,
        right: `${-halfSize}px`,
        top: `${size}px`,
        width: `${size}px`,
      },
    },
    {
      cursor: "ew-resize",
      handle: "west",
      style: {
        bottom: `${size}px`,
        left: `${-halfSize}px`,
        top: `${size}px`,
        width: `${size}px`,
      },
    },
    {
      cursor: "nwse-resize",
      handle: "north-west",
      style: {
        height: `${size}px`,
        left: `${-halfSize}px`,
        top: `${-halfSize}px`,
        width: `${size}px`,
      },
    },
    {
      cursor: "nesw-resize",
      handle: "north-east",
      style: {
        height: `${size}px`,
        right: `${-halfSize}px`,
        top: `${-halfSize}px`,
        width: `${size}px`,
      },
    },
    {
      cursor: "nesw-resize",
      handle: "south-west",
      style: {
        bottom: `${-halfSize}px`,
        height: `${size}px`,
        left: `${-halfSize}px`,
        width: `${size}px`,
      },
    },
    {
      cursor: "nwse-resize",
      handle: "south-east",
      style: {
        bottom: `${-halfSize}px`,
        height: `${size}px`,
        right: `${-halfSize}px`,
        width: `${size}px`,
      },
    },
  ];
}

export { InfiniteCanvasWindowFrame };
