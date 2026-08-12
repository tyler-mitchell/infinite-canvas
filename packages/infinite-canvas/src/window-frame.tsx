"use client";

import { useMemo, useState, type CSSProperties, type ReactNode } from "react";

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
import { getWorldLengthWithScreenFloor, projectWorldRectToScreen } from "./geometry";
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

/**
 * A window frame is the hot path: every camera tick re-renders one of these per
 * window, and at stress scale that is the interactive frame budget. The rule
 * this file is built around is that **only the outer transform may change per
 * tick.** Everything inside — chrome, body, resize handles — is memoized on the
 * window's own identity, so React bails out of the subtree on pan and zoom and
 * the work collapses to a single style write per window.
 *
 * Two consequences follow, and both are deliberate:
 *
 * 1. The frame never receives canvas state as a prop. It takes `camera` and
 *    `viewport` (what the transform needs) and reads the rest through the store
 *    at call time. Threading `state` down would make every memo below churn on
 *    every tick, which is exactly the cost this file exists to avoid.
 * 2. `renderFrame` is not re-invoked on camera movement. Implementations that
 *    need reactive state subscribe with `useInfiniteCanvasSelector` inside
 *    their own components, so invalidation stays scoped to what they read.
 *    This mirrors the contract `renderBody` already has.
 */

/**
 * Resize handles must stay a constant *screen* size, but they live inside the
 * frame's zoom-scaled subtree, so their geometry is zoom-dependent. Publishing
 * that size as a custom property on the frame — whose inline style is rewritten
 * every tick regardless — lets the eight handle elements stay referentially
 * stable across zoom instead of being rebuilt with fresh inline styles.
 */
const RESIZE_HANDLE_SIZE_CSS_VARIABLE = "--icx-resize-handle-size";

/**
 * Chrome strokes are drawn in world units inside a zoom-scaled frame, so a 1px
 * border renders as `1 × zoom` screen pixels. At 10% zoom that is a tenth of a
 * pixel: borders, the header rule, and the inner frame all thin to nothing and a
 * window becomes an unreadable blob exactly when the user has zoomed out to see
 * how their windows relate.
 *
 * So the stroke is published as a custom property, widened in world units by
 * however much the zoom is shrinking it, and never allowed to render thinner than
 * one screen pixel. Above 100% zoom this is inert: the authored width already
 * exceeds the floor, and a stroke that grows with the canvas is what you want.
 */
const CHROME_STROKE_CSS_VARIABLE = "--icx-chrome-stroke";

const CHROME_STROKE = `var(${CHROME_STROKE_CSS_VARIABLE})`;

const RESIZE_HANDLE_EXTENT = `var(${RESIZE_HANDLE_SIZE_CSS_VARIABLE})`;

/** Handles straddle the frame edge, so they hang half their extent outside it. */
const RESIZE_HANDLE_OVERHANG = `calc(${RESIZE_HANDLE_EXTENT} / -2)`;

/** React's `CSSProperties` has no slot for custom properties. Widen just this one. */
type InfiniteCanvasFrameStyle = CSSProperties &
  Readonly<Record<typeof CHROME_STROKE_CSS_VARIABLE, string>> &
  Readonly<Record<typeof RESIZE_HANDLE_SIZE_CSS_VARIABLE, string>>;

type InfiniteCanvasResizeHandleDescriptor = Readonly<{
  cursor: CSSProperties["cursor"];
  handle: InfiniteCanvasResizeHandle;
  style: CSSProperties;
}>;

/**
 * Edge handles are inset by one extent at each end so the corner handles own
 * the corners. Every value is expressed against the CSS variable, which makes
 * this a module constant rather than a per-zoom allocation.
 */
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

function InfiniteCanvasWindowFrame<Kind extends string>({
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
  /** Per-canvas token (`useId()` at the desktop root) that namespaces the frame's DOM `id`. */
  canvasInstanceId: string;
  chrome: InfiniteCanvasChromeMetrics;
  devicePixelRatio: number;
  isActive: boolean;
  /**
   * A grouped window carries no resize handles.
   *
   * `interaction.startResize` refuses a grouped window outright — a pane is resized by
   * its seam — so the handles were controls that could not do the thing their cursor
   * promised. Worse, they straddle the frame edge and hang half their extent *outside*
   * it, and the window plane draws above the group layer. Two adjacent panes therefore
   * covered the gutter between them with dead handles and swallowed its pointerdown.
   * Handle extent is constant in screen pixels while the gutter is fixed in world units,
   * so the seam worked when zoomed in and quietly stopped working as you zoomed out.
   */
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

  // The frame's box is in world units; `scale` maps it to the screen. Handles
  // therefore need a world-unit extent that shrinks as zoom grows.
  const articleStyle: InfiniteCanvasFrameStyle = {
    [CHROME_STROKE_CSS_VARIABLE]: `${getWorldLengthWithScreenFloor(chrome.borderWidth, screenTransform.scale)}px`,
    [RESIZE_HANDLE_SIZE_CSS_VARIABLE]: `${chrome.resizeHandleSize / screenTransform.scale}px`,
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

  const frameRuntimeContext = useMemo(
    () =>
      ({
        actions,
        bodyPointerBehavior,
        chrome,
        definition,
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
      // Read at call time, never an invalidation source — see the file header.
      get state() {
        return store.state$.peek() as InfiniteCanvasState<Kind>;
      },
      theme,
      window,
    } satisfies InfiniteCanvasWindowFrameRenderContext<Kind>;

    return definition.renderFrame?.(frameContext) ?? renderDefaultFrame();
  }, [actions, chrome, definition, isActive, isHostLocalChrome, isSelected, store, theme, window]);

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
          // `aria-selected` is only valid on gridcell/option/row/tab/treeitem —
          // never on `group`, where assistive tech ignores or misreports it.
          // The active window is the "current item in a set", which is exactly
          // what `aria-current` means and is valid on any element. Selection
          // stays a styling concern via the `data-selected` contract.
          aria-current={isActive ? "true" : undefined}
          aria-roledescription="window"
          data-frame-chrome={isHostLocalChrome ? "host" : "dom"}
          data-infinite-canvas-window-id={window.id}
          // A real DOM id so a group tab's `aria-controls` can name this panel (FR-9).
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
          {isGrouped ? null : resizeHandles}
        </article>
        {definition.portalRoot !== true ? null : (
          // A sibling of the frame, not a child: it must sit outside the frame's
          // transform, or content mounted here would be scaled by zoom and would resolve
          // `position: fixed` against the frame. It tracks the window's *screen* rect
          // instead, so a popover lands beside its anchor at natural size.
          //
          // **After the frame, and carrying the frame's own stack value.** Both are
          // positioned, so paint order is decided first by `z-index` and then by document
          // order. Rendered before the frame with no `z-index`, as this was until
          // 2026-07-08, every portalled popover painted *underneath* the opaque window
          // body it belonged to — present in the DOM, invisible on screen. Sharing the
          // frame's stack value rather than adding to it keeps the popover above its own
          // window and still below any window stacked higher, which is what "belongs to
          // this window" has to mean.
          //
          // `pointer-events: none` so the root does not blanket the body it covers.
          // Interactive portalled content sets `pointer-events: auto` on itself, the same
          // contract `renderOverlay` uses.
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

/**
 * Chrome painted by the host: discrete layers the consumer can style
 * independently, stacked under the header and body.
 */
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

/** Chrome painted by the slots themselves — the default. */
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

export { InfiniteCanvasWindowFrame };
