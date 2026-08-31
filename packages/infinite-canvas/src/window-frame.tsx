"use client";

import { memo, useMemo, useRef, useState, type CSSProperties, type ReactNode } from "react";

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
import { getInfiniteCanvasWindowDetailLevel, type InfiniteCanvasDetailLevel } from "./detail-level";
import {
  getWorldLengthWithScreenFloor,
  isWorldRectCulled,
  projectWorldRectToScreen,
} from "./geometry";
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
  InfiniteCanvasCamera,
  InfiniteCanvasChromeMetrics,
  InfiniteCanvasResizeHandle,
  InfiniteCanvasStackBands,
  InfiniteCanvasState,
  InfiniteCanvasTheme,
  InfiniteCanvasViewport,
  InfiniteCanvasWindow,
  InfiniteCanvasWindowFrameRenderContext,
  InfiniteCanvasWindowRegistry,
} from "./types";
import { isInfiniteCanvasWindowCapable } from "./window-capabilities";

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

/** Culls inactive frames outside the viewport. */
function isFrameOffscreen<Kind extends string>({
  camera,
  isActive,
  viewport,
  window,
}: Readonly<{
  camera: InfiniteCanvasCamera;
  isActive: boolean;
  viewport: InfiniteCanvasViewport;
  window: InfiniteCanvasWindow<Kind>;
}>): boolean {
  return !isActive && isWorldRectCulled(camera, viewport, window.rect);
}

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
  camera,
  canvasInstanceId,
  chrome,
  devicePixelRatio,
  isActive,
  isGrouped,
  isSelected,
  stackBands,
  theme,
  viewport,
  window,
  windowDefinitions,
}: Readonly<{
  camera: InfiniteCanvasCamera;
  /** Per-canvas namespace for the frame DOM ID. */
  canvasInstanceId: string;
  chrome: InfiniteCanvasChromeMetrics;
  devicePixelRatio: number;
  isActive: boolean;
  /** Grouped panes use seams and do not render window resize handles. */
  isGrouped: boolean;
  isSelected: boolean;
  stackBands: InfiniteCanvasStackBands;
  theme: InfiniteCanvasTheme;
  viewport: InfiniteCanvasViewport;
  window: InfiniteCanvasWindow<Kind>;
  windowDefinitions: InfiniteCanvasWindowRegistry<Kind>;
}>) {
  const actions = useInfiniteCanvasActions<Kind>();
  const store = useInfiniteCanvasStore<Kind>();
  const definition = windowDefinitions[window.kind];
  // Keep chrome legible at far zoom with the body detail hysteresis.
  const chromeDetailRef = useRef<InfiniteCanvasDetailLevel>("full");
  const chromeDetail = getInfiniteCanvasWindowDetailLevel(
    window.rect,
    camera.zoom,
    chromeDetailRef.current,
  );

  chromeDetailRef.current = chromeDetail;

  const frameChrome = definition.frameChrome ?? "dom";
  const isHostLocalChrome = frameChrome === "host" || frameChrome === "scene";
  const textSelection = definition.textSelection ?? "none";
  const bodyPointerBehavior = definition.bodyPointerBehavior ?? "native";
  const [windowPortalRoot, setWindowPortalRoot] = useState<HTMLDivElement | null>(null);
  const { screenRect, screenTransform } = projectWorldRectToScreen(
    camera,
    viewport,
    window.rect,
    devicePixelRatio,
  );

  // Convert screen-sized handle and stroke values to world units.
  const articleStyle: InfiniteCanvasFrameStyle = {
    [CHROME_STROKE_CSS_VARIABLE]: `${getWorldLengthWithScreenFloor(chrome.borderWidth, screenTransform.scale)}px`,
    [RESIZE_HANDLE_SIZE_CSS_VARIABLE]: `${chrome.resizeHandleSize / screenTransform.scale}px`,
    [SCREEN_PIXEL_CSS_VARIABLE]: `${1 / screenTransform.scale}px`,
    contain: "layout paint style",
    // Keep offscreen DOM mounted while the browser skips layout and paint.
    containIntrinsicSize: `${screenTransform.width}px ${screenTransform.height}px`,
    contentVisibility: isFrameOffscreen({ camera, isActive, viewport, window })
      ? "auto"
      : "visible",
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
    const frameContext = {
      actions,
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
  const isResizable = !isGrouped && isInfiniteCanvasWindowCapable(window, "resizable");
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
          {isResizable && chromeDetail === "full" ? resizeHandles : null}
        </article>
        {definition.portalRoot !== true ? null : (
          // Keep the portal outside the transform and at the same stack level.
          // Portalled controls can enable their own pointer events.
          <div
            data-infinite-canvas-window-id={window.id}
            data-slot={INFINITE_CANVAS_SLOTS.windowPortalRoot}
            ref={setWindowPortalRoot}
            style={{
              height: `${screenRect.height}px`,
              left: `${screenRect.left}px`,
              pointerEvents: "none",
              position: "absolute",
              top: `${screenRect.top}px`,
              width: `${screenRect.width}px`,
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

/** Props that only change a culled frame projection. */
const FRAME_PROJECTION_PROPS: ReadonlySet<string> = new Set(["camera", "viewport"]);

/** Skips camera-only renders while both frame positions remain culled. */
type InfiniteCanvasWindowFrameProps = Parameters<
  typeof InfiniteCanvasWindowFrameContent<string>
>[0];

const isCulledFrameRenderRedundant = (
  previous: InfiniteCanvasWindowFrameProps,
  next: InfiniteCanvasWindowFrameProps,
): boolean => {
  if (!isFrameOffscreen(previous) || !isFrameOffscreen(next)) {
    return false;
  }

  const values = (props: InfiniteCanvasWindowFrameProps) =>
    props as Readonly<Record<string, unknown>>;

  return [...new Set([...Object.keys(previous), ...Object.keys(next)])].every(
    (key) => FRAME_PROJECTION_PROPS.has(key) || Object.is(values(previous)[key], values(next)[key]),
  );
};

const InfiniteCanvasWindowFrame = memo(
  InfiniteCanvasWindowFrameContent,
  isCulledFrameRenderRedundant,
) as typeof InfiniteCanvasWindowFrameContent;

export { InfiniteCanvasWindowFrame };
