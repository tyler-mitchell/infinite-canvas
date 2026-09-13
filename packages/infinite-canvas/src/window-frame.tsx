"use client";

import { memo, useMemo, useState, type CSSProperties, type ReactNode } from "react";

import {
  INFINITE_CANVAS_SLOTS,
  getInfiniteCanvasWindowFrameElementId,
  getInfiniteCanvasWindowStateAttributes,
} from "./data-attributes";
import {
  DEFAULT_INFINITE_CANVAS_WINDOW_FRAME_SLOTS,
  InfiniteCanvasWindowFrameRuntimeContext,
  getEventViewportPoint,
  type InfiniteCanvasWindowFrameRuntimeContextValue,
} from "./frame-slots";
import { useInfiniteCanvasDetailLevel } from "./detail-level";
import { getWindowBodyRect, getWorldLengthWithScreenFloor } from "./geometry";
import { INFINITE_CANVAS_LAYOUT_TRANSITION } from "./layout-motion";
import {
  capturePointer,
  clearNativeTextSelection,
  isPrimaryButton,
  releasePointer,
} from "./runtime";
import { InfiniteCanvasWindowPortalContext } from "./portal";
import { getWindowStackValue } from "./stacking";
import { useInfiniteCanvasActions, useInfiniteCanvasStore } from "./store";
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
import { isInfiniteCanvasWindowCapable } from "./window-capabilities";
import { getInfiniteCanvasMasonryMembership } from "./group-state";

/** Renders each window. Camera changes update only the outer transform. */
/** World-space handle size that keeps a fixed screen size. */
const RESIZE_HANDLE_SIZE_CSS_VARIABLE = "--icx-resize-handle-size";

/** World-space stroke width with a one-screen-pixel minimum. */
const CHROME_STROKE_CSS_VARIABLE = "--icx-chrome-stroke";

/** One screen pixel in current world units. */
const SCREEN_PIXEL_CSS_VARIABLE = "--icx-screen-px";

const CHROME_STROKE = `var(${CHROME_STROKE_CSS_VARIABLE})`;

const RESIZE_HANDLE_EXTENT = `var(${RESIZE_HANDLE_SIZE_CSS_VARIABLE})`;

/** Half-extent outside the frame. */
const RESIZE_HANDLE_OVERHANG = `calc(${RESIZE_HANDLE_EXTENT} / -2)`;

/** Adds frame custom properties to React `CSSProperties`. */
type InfiniteCanvasFrameStyle = CSSProperties &
  Readonly<Record<typeof CHROME_STROKE_CSS_VARIABLE, string>> &
  Readonly<Record<typeof RESIZE_HANDLE_SIZE_CSS_VARIABLE, string>> &
  Readonly<Record<typeof SCREEN_PIXEL_CSS_VARIABLE, string>>;

type InfiniteCanvasResizeHandleDescriptor = Readonly<{
  cursor: CSSProperties["cursor"];
  handle: InfiniteCanvasResizeHandle;
  style: CSSProperties;
}>;

/** Static handle geometry expressed with CSS variables. */
const RESIZE_HANDLE_DESCRIPTORS: readonly InfiniteCanvasResizeHandleDescriptor[] = [
  {
    cursor: "ns-resize",
    handle: "north",
    style: {
      height: RESIZE_HANDLE_EXTENT,
      left: RESIZE_HANDLE_EXTENT,
      right: RESIZE_HANDLE_EXTENT,
      top: RESIZE_HANDLE_OVERHANG,
    },
  },
  {
    cursor: "ns-resize",
    handle: "south",
    style: {
      bottom: RESIZE_HANDLE_OVERHANG,
      height: RESIZE_HANDLE_EXTENT,
      left: RESIZE_HANDLE_EXTENT,
      right: RESIZE_HANDLE_EXTENT,
    },
  },
  {
    cursor: "ew-resize",
    handle: "east",
    style: {
      bottom: RESIZE_HANDLE_EXTENT,
      right: RESIZE_HANDLE_OVERHANG,
      top: RESIZE_HANDLE_EXTENT,
      width: RESIZE_HANDLE_EXTENT,
    },
  },
  {
    cursor: "ew-resize",
    handle: "west",
    style: {
      bottom: RESIZE_HANDLE_EXTENT,
      left: RESIZE_HANDLE_OVERHANG,
      top: RESIZE_HANDLE_EXTENT,
      width: RESIZE_HANDLE_EXTENT,
    },
  },
  {
    cursor: "nwse-resize",
    handle: "north-west",
    style: {
      height: RESIZE_HANDLE_EXTENT,
      left: RESIZE_HANDLE_OVERHANG,
      top: RESIZE_HANDLE_OVERHANG,
      width: RESIZE_HANDLE_EXTENT,
    },
  },
  {
    cursor: "nesw-resize",
    handle: "north-east",
    style: {
      height: RESIZE_HANDLE_EXTENT,
      right: RESIZE_HANDLE_OVERHANG,
      top: RESIZE_HANDLE_OVERHANG,
      width: RESIZE_HANDLE_EXTENT,
    },
  },
  {
    cursor: "nesw-resize",
    handle: "south-west",
    style: {
      bottom: RESIZE_HANDLE_OVERHANG,
      height: RESIZE_HANDLE_EXTENT,
      left: RESIZE_HANDLE_OVERHANG,
      width: RESIZE_HANDLE_EXTENT,
    },
  },
  {
    cursor: "nwse-resize",
    handle: "south-east",
    style: {
      bottom: RESIZE_HANDLE_OVERHANG,
      height: RESIZE_HANDLE_EXTENT,
      right: RESIZE_HANDLE_OVERHANG,
      width: RESIZE_HANDLE_EXTENT,
    },
  },
];

function InfiniteCanvasWindowFrameContent<Kind extends string>({
  canvasInstanceId,
  chrome,
  isActive,
  isGrouped,
  isPointerOwned = false,
  isSelected,
  stackBands,
  theme,
  window,
  windowDefinitions,
  zoom,
}: Readonly<{
  /** Per-canvas namespace for the frame DOM ID. */
  canvasInstanceId: string;
  chrome: InfiniteCanvasChromeMetrics;
  isActive: boolean;
  /** Grouped panes use seams and do not render window resize handles. */
  isGrouped: boolean;
  /** The pointer writes this rect each frame, so it must not tween. */
  isPointerOwned?: boolean;
  isSelected: boolean;
  stackBands: InfiniteCanvasStackBands;
  theme: InfiniteCanvasTheme;
  window: InfiniteCanvasWindow<Kind>;
  windowDefinitions: InfiniteCanvasWindowRegistry<Kind>;
  /** The camera zoom. The layer carries the camera position, so a pan never renders a frame. */
  zoom: number;
}>) {
  const actions = useInfiniteCanvasActions<Kind>();
  const store = useInfiniteCanvasStore<Kind>();
  const definition = windowDefinitions[window.kind];
  // Keep chrome legible at far zoom with the body detail hysteresis.
  const chromeDetail = useInfiniteCanvasDetailLevel(window.rect);

  const frameChrome = definition.frameChrome ?? "dom";
  const isHostLocalChrome = frameChrome === "host" || frameChrome === "scene";
  const textSelection = definition.textSelection ?? "none";
  const bodyPointerBehavior = definition.bodyPointerBehavior ?? "native";
  const [windowPortalRoot, setWindowPortalRoot] = useState<HTMLDivElement | null>(null);
  const { rect } = window;
  // The layer carries the camera, so a frame is in world units and a rect change is a tween.
  const articleStyle: InfiniteCanvasFrameStyle = {
    [CHROME_STROKE_CSS_VARIABLE]: `${getWorldLengthWithScreenFloor(chrome.borderWidth, zoom)}px`,
    [RESIZE_HANDLE_SIZE_CSS_VARIABLE]: `${chrome.resizeHandleSize / zoom}px`,
    [SCREEN_PIXEL_CSS_VARIABLE]: `${1 / zoom}px`,
    contain: "layout paint style",
    height: `${rect.height}px`,
    left: "0px",
    pointerEvents: "none",
    position: "absolute",
    top: "0px",
    transform: `translate(${rect.x}px, ${rect.y}px)`,
    transition: isPointerOwned ? "none" : INFINITE_CANVAS_LAYOUT_TRANSITION,
    width: `${rect.width}px`,
    zIndex: getWindowStackValue(window, stackBands),
  };

  const frameRuntimeContext = useMemo(
    () =>
      ({
        actions,
        bodyPointerBehavior,
        chrome,
        definition,
        detailLevel: chromeDetail,
        isActive,
        isSelected,
        textSelection,
        theme,
        window,
      }) satisfies InfiniteCanvasWindowFrameRuntimeContextValue<Kind>,
    [
      actions,
      bodyPointerBehavior,
      chrome,
      chromeDetail,
      definition,
      isActive,
      isSelected,
      textSelection,
      theme,
      window,
    ],
  );

  const frameNode = useMemo(() => {
    const renderDefaultFrame = (): ReactNode =>
      isHostLocalChrome ? (
        <InfiniteCanvasHostChromeFrame chrome={chrome} />
      ) : (
        <InfiniteCanvasDomChromeFrame />
      );
    const body = getWindowBodyRect(window.rect, chrome);
    const frameContext = {
      actions,
      bodySize: { height: body.height, width: body.width },
      chrome,
      frame: DEFAULT_INFINITE_CANVAS_WINDOW_FRAME_SLOTS,
      isActive,
      isSelected,
      renderDefaultFrame,
      // Read current state without camera-driven body invalidation.
      get state() {
        return store.state$.peek() as InfiniteCanvasState<Kind>;
      },
      theme,
      window,
    } satisfies InfiniteCanvasWindowFrameRenderContext<Kind>;

    return definition.renderFrame?.(frameContext) ?? renderDefaultFrame();
  }, [actions, chrome, definition, isActive, isHostLocalChrome, isSelected, store, theme, window]);

  // Hidden handles do not create dead hit targets.
  const isResizable =
    (!isGrouped || getInfiniteCanvasMasonryMembership(store.state$.peek(), window.id) !== null) &&
    isInfiniteCanvasWindowCapable(window, "resizable");
  const resizeHandles = useMemo(
    () =>
      RESIZE_HANDLE_DESCRIPTORS.map((descriptor) => (
        <div
          data-handle={descriptor.handle}
          data-infinite-canvas-control="true"
          data-slot={INFINITE_CANVAS_SLOTS.resizeHandle}
          key={descriptor.handle}
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
              handle: descriptor.handle,
              pointerId: event.pointerId,
              point: getEventViewportPoint(event),
              windowId: window.id,
            });
          }}
          onPointerUp={(event) => {
            releasePointer(event.currentTarget, event.pointerId);
            actions.finishInteraction(event.pointerId);
          }}
          style={{
            ...descriptor.style,
            cursor: descriptor.cursor,
            pointerEvents: "auto",
            position: "absolute",
            zIndex: 4,
          }}
        />
      )),
    [actions, window.id],
  );

  return (
    <InfiniteCanvasWindowFrameRuntimeContext.Provider value={frameRuntimeContext}>
      <InfiniteCanvasWindowPortalContext.Provider value={windowPortalRoot}>
        <article
          aria-label={window.title}
          // `aria-current` is valid for `role=group`. `aria-selected` is not.
          aria-current={isActive ? "true" : undefined}
          aria-roledescription="window"
          data-frame-chrome={isHostLocalChrome ? "host" : "dom"}
          data-infinite-canvas-window-id={window.id}
          // The group tab uses this ID in `aria-controls`.
          id={getInfiniteCanvasWindowFrameElementId(canvasInstanceId, window.id)}
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
          {isResizable ? resizeHandles : null}
        </article>
        {definition.portalRoot !== true ? null : (
          // Over the frame at screen scale: the layer's zoom is undone, so portalled controls
          // keep their screen size. They can enable their own pointer events.
          <div
            data-infinite-canvas-window-id={window.id}
            data-slot={INFINITE_CANVAS_SLOTS.windowPortalRoot}
            ref={setWindowPortalRoot}
            style={{
              height: `${rect.height * zoom}px`,
              left: `${rect.x}px`,
              pointerEvents: "none",
              position: "absolute",
              top: `${rect.y}px`,
              transform: `scale(${1 / zoom})`,
              transformOrigin: "0 0",
              width: `${rect.width * zoom}px`,
              zIndex: getWindowStackValue(window, stackBands),
            }}
          />
        )}
      </InfiniteCanvasWindowPortalContext.Provider>
    </InfiniteCanvasWindowFrameRuntimeContext.Provider>
  );
}

/** Renders host chrome layers beneath header and body slots. */
function InfiniteCanvasHostChromeFrame({
  chrome,
}: Readonly<{
  chrome: InfiniteCanvasChromeMetrics;
}>) {
  const { ActiveCorners, Body, Controls, Header, Surface, Title } =
    DEFAULT_INFINITE_CANVAS_WINDOW_FRAME_SLOTS;

  return (
    <Surface>
      <InfiniteCanvasWindowHostChrome chrome={chrome} />
      <Header
        style={{
          borderBottomWidth: 0,
          zIndex: 3,
        }}
      >
        <>
          <Title />
          <Controls />
        </>
      </Header>
      <Body
        style={{
          bottom: CHROME_STROKE,
          left: CHROME_STROKE,
          right: CHROME_STROKE,
          top: `${chrome.headerHeight}px`,
          zIndex: 2,
        }}
      />
      <ActiveCorners style={{ zIndex: 4 }} />
    </Surface>
  );
}

/** Renders chrome through the default slots. */
function InfiniteCanvasDomChromeFrame() {
  const { ActiveCorners, Body, Header, Surface } = DEFAULT_INFINITE_CANVAS_WINDOW_FRAME_SLOTS;

  return (
    <Surface>
      <Header />
      <Body />
      <ActiveCorners />
    </Surface>
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
          borderWidth: CHROME_STROKE,
          inset: 0,
          position: "absolute",
        }}
      />
      <div
        data-layer="inner-frame"
        style={{
          inset: CHROME_STROKE,
          position: "absolute",
        }}
      />
    </div>
  );
}

const InfiniteCanvasWindowFrame = memo(
  InfiniteCanvasWindowFrameContent,
) as typeof InfiniteCanvasWindowFrameContent;

export { InfiniteCanvasWindowFrame };
