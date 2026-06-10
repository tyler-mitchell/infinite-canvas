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
      <FrameSurface className="shadow-[0_20px_80px_-56px_rgba(183,244,255,0.55)]">
        <InfiniteCanvasWindowHostChrome
          chrome={chrome}
          isActive={isActive}
          isSelected={isSelected}
          theme={theme}
        />
        <FrameHeader
          style={{
            background: "transparent",
            borderBottomColor: "transparent",
            borderBottomWidth: 0,
            zIndex: 3,
          }}
        >
          <>
            <FrameTitle />
            <FrameControls className="[&>button]:border-white/10 [&>button]:bg-white/[0.035] [&>button]:text-white/48 [&>button:hover]:border-white/18 [&>button:hover]:bg-white/[0.075]" />
          </>
        </FrameHeader>
        <FrameBody
          style={{
            background: "transparent",
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
        className="absolute pointer-events-none"
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
            className="absolute pointer-events-auto"
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
  isActive,
  isSelected,
  theme,
}: Readonly<{
  chrome: InfiniteCanvasChromeMetrics;
  isActive: boolean;
  isSelected: boolean;
  theme: InfiniteCanvasTheme;
}>) {
  const tone = getHostChromeTone(theme, isActive, isSelected);

  return (
    <div
      aria-hidden="true"
      className="pointer-events-none absolute inset-0 z-0"
      data-slot={INFINITE_CANVAS_SLOTS.windowHostChrome}
    >
      <div
        className="absolute inset-0"
        data-layer="fill"
        style={{
          background:
            "linear-gradient(180deg, rgba(255,255,255,0.018), rgba(255,255,255,0) 34%), #06080b",
        }}
      />
      <div
        className="absolute inset-x-0 top-0"
        data-layer="header"
        style={{
          background: tone.header,
          height: `${chrome.headerHeight}px`,
        }}
      />
      <div
        className="absolute inset-x-0"
        data-layer="accent"
        style={{
          background: tone.accent,
          height: `${chrome.headerAccentHeight}px`,
          opacity: tone.accentOpacity,
          top: `${Math.max(chrome.headerHeight - chrome.headerAccentHeight, 0)}px`,
        }}
      />
      <div
        className="absolute inset-0 border"
        data-layer="frame"
        style={{
          borderColor: tone.border,
          borderWidth: `${chrome.borderWidth}px`,
          boxShadow: tone.shadow,
        }}
      />
      <div
        className="absolute inset-[1px] border"
        data-layer="inner-frame"
        style={{
          borderColor: tone.innerBorder,
        }}
      />
    </div>
  );
}

function getHostChromeTone(theme: InfiniteCanvasTheme, isActive: boolean, isSelected: boolean) {
  if (isActive) {
    return {
      accent: theme.activeAccent,
      accentOpacity: 0.9,
      border: theme.activeBorder,
      header: theme.headerActive,
      innerBorder: "rgba(255, 255, 255, 0.14)",
      shadow: "0 0 0 1px rgba(215, 251, 255, 0.1), 0 18px 60px -44px rgba(183, 244, 255, 0.7)",
    };
  }

  if (isSelected) {
    return {
      accent: theme.selectionBorder,
      accentOpacity: 0.58,
      border: theme.selectionBorder,
      header: theme.headerIdle,
      innerBorder: "rgba(190, 244, 255, 0.08)",
      shadow: "0 0 0 1px rgba(148, 224, 236, 0.08), 0 18px 54px -48px rgba(148, 224, 236, 0.5)",
    };
  }

  return {
    accent: theme.idleBorder,
    accentOpacity: 0.78,
    border: "rgba(119, 151, 161, 0.56)",
    header: theme.headerIdle,
    innerBorder: "rgba(255, 255, 255, 0.045)",
    shadow: "0 14px 48px -44px rgba(160, 210, 220, 0.45)",
  };
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
