import { For, observer, useObserve, useValue } from "@legendapp/state/react";
import { useMeasure } from "@legendapp/state/react-hooks/useMeasure";
import { observe, type Observable } from "@legendapp/state";
import {
  useEffect,
  useCallback,
  useContext,
  useId,
  useMemo,
  useRef,
  useState,
  type ComponentProps,
  type CSSProperties,
  type PointerEvent,
  type ReactNode,
} from "react";
import { useWebMCP, type WebMCPOptions } from "use-webmcp-tool";
import { animate, resize, scroll, spring } from "motion";
import type { WindowState } from "../document.types";
import {
  cameraMatrix,
  centroidOfRect,
  intersectsRect,
  type ResizeHandle,
} from "@hyphened/math/cpu";
import { getResizeHandleDescriptors } from "../geometry";
import type { Canvas } from "../state.types";
import {
  readPointer,
  report,
  capturePointer,
  getViewportPoint,
  isInteractiveTarget,
  isPrimaryButton,
  releasePointer,
  COMPONENT_TRANSFER_TYPE,
  defaultHotkeys,
  getHotkeyDefinitions,
  type Hotkeys,
} from "../input";
import { useHotkeys, useKeyHold } from "@tanstack/react-hotkeys";
import "./frame.css";
import { WindowControls, type ChildLabel, type ControlRenderer } from "./controls";
import { createCanvasTools } from "../tools";
import { ScrollContext, useCanvasScrollAxis, useCanvasScrollMode } from "./scroll";
import { getTransferHandlers } from "./transfer";
import {
  ViewportContext,
  WindowContext,
  useCanvasViewport,
  useCanvasWindow,
  type WindowContextValue,
} from "./context";

function ToolRegistration({ tool }: { tool: WebMCPOptions<unknown, unknown> }) {
  useWebMCP(tool);
  return null;
}

export function useCanvasOccluder<Element extends HTMLElement>() {
  const { canvas, viewport } = useCanvasViewport();
  const source = useId();
  return useCallback(
    (element: Element | null) => {
      if (element === null) return;
      const measure = () => {
        const bounds = viewport.current?.getBoundingClientRect();
        const rect = element.getBoundingClientRect();
        canvas.actions.setViewportOccluder.run({
          source,
          rect:
            bounds === undefined || rect.width <= 0 || rect.height <= 0
              ? undefined
              : {
                  x: rect.x - bounds.x,
                  y: rect.y - bounds.y,
                  width: rect.width,
                  height: rect.height,
                },
        });
      };
      const stopResize = resize(element, measure);
      const stopViewport = observe(() => {
        canvas.state.input.viewport.get();
        measure();
      });
      return () => {
        stopResize();
        stopViewport();
        canvas.actions.setViewportOccluder.run({ source });
      };
    },
    [canvas, source, viewport],
  );
}

export function CanvasTools({ canvas }: { canvas: Canvas }) {
  const tools = useMemo(() => createCanvasTools(canvas), [canvas]);
  return tools.map((tool) => <ToolRegistration key={tool.name} tool={tool} />);
}

const handles = getResizeHandleDescriptors({
  size: "calc(var(--canvas-resize-size, 8px) * var(--canvas-screen-scale, 1))",
  offset: "0px",
  inset: "calc(var(--canvas-resize-size, 8px) * var(--canvas-screen-scale, 1))",
});

export type LayoutMotion = Omit<NonNullable<Parameters<typeof spring>[0]>, "keyframes">;

function pressWindow({
  canvas,
  window,
  viewport,
  event,
  handle,
  threshold,
}: Omit<WindowContextValue, "element"> & {
  event: PointerEvent;
  handle?: ResizeHandle;
  threshold?: number;
}) {
  const element = viewport.current;
  if (element === null || !isPrimaryButton(event)) return;
  const id = window.id.peek();
  const definition = canvas.computed.windowDefinition[id].peek();
  const pointer = readPointer(event, element);
  const error =
    handle === undefined
      ? canvas.actions.pressMove.run({
          window: id,
          pointer,
          threshold: threshold ?? definition?.headerDragThreshold ?? 0,
        })
      : canvas.actions.pressResize.run({
          window: id,
          pointer,
          handle,
          threshold: threshold ?? definition?.resizeDragThreshold ?? 0,
        });
  report(error);
  if (error !== undefined) return;
  event.stopPropagation();
  if (canvas.computed.capturedPointerId.peek() !== event.pointerId) return;
  event.preventDefault();
  element.focus({ preventScroll: true });
  capturePointer({ canvas, element, pointerId: event.pointerId });
}

export function WindowDragHandle({
  threshold,
  onPointerDown,
  ...props
}: ComponentProps<"div"> & { threshold?: number }) {
  const context = useCanvasWindow();
  const { mode } = useCanvasViewport();
  return (
    <div
      {...props}
      data-slot="canvas-drag-handle"
      onPointerDown={(event) => {
        onPointerDown?.(event);
        if (mode !== "edit" || event.defaultPrevented || isInteractiveTarget(event.target)) return;
        pressWindow({ ...context, event, threshold });
      }}
    />
  );
}

function ResizeHandles({
  canvas,
  window,
  viewport,
}: Pick<WindowContextValue, "canvas" | "window" | "viewport">) {
  return handles.map(({ handle, style, cursor }) => (
    <div
      key={handle}
      data-slot="canvas-resize-handle"
      data-handle={handle}
      style={{ position: "absolute", ...style, cursor, touchAction: "none", pointerEvents: "auto" }}
      onPointerDown={(event) => pressWindow({ canvas, window, viewport, event, handle })}
    />
  ));
}

const WindowContents = observer(function WindowContents({
  window,
  renderWindow,
}: {
  window: Observable<WindowState>;
  renderWindow: (window: Observable<WindowState>) => ReactNode;
}) {
  return renderWindow(window);
});

const WindowView = observer(function WindowView({
  canvas,
  window,
  viewport,
  renderWindow,
  instanceId,
  preview = false,
  renderChildLabel,
  renderControl,
}: Omit<WindowContextValue, "element"> & {
  renderWindow: (window: Observable<WindowState>) => ReactNode;
  instanceId: string;
  preview?: boolean;
  renderChildLabel?: ChildLabel;
  renderControl?: ControlRenderer;
}) {
  const element = useRef<HTMLElement>(null);
  const context = useMemo(
    () => ({ canvas, window, viewport, element }),
    [canvas, window, viewport],
  );
  const { mode } = useCanvasViewport();
  const id = window.id.get();
  const rect = preview ? window.rect.get() : canvas.computed.windowRect[id].get();
  if (rect === undefined) return null;
  const visible = preview || canvas.computed.windowVisible[id].get();
  const drag = canvas.state.session.drag.get();
  const root = canvas.computed.windowRoot[id].get();
  const carried =
    drag !== null &&
    drag.kind !== "sash" &&
    (drag.startRects[id] !== undefined || drag.startRects[root] !== undefined);
  const dragging = drag?.kind === "move" && carried;
  const resizing = drag?.kind === "resize" && drag.startRects[id] !== undefined;
  const direct =
    preview ||
    canvas.computed.dragStartRects[root].get() !== undefined ||
    Object.values(canvas.computed.operations[root].get()).some(
      (operation) => operation.type !== "move",
    );
  const container = !preview && window.layout.get() !== undefined;
  const selected =
    mode === "edit" && canvas.computed.selection.targets[`window:${id}`].get() !== undefined;
  return (
    <WindowContext.Provider value={context}>
      <article
        ref={element}
        id={`${instanceId}-window-${id}`}
        aria-label={window.title.get()}
        hidden={!visible}
        aria-hidden={preview || undefined}
        data-preview={preview || undefined}
        data-direct={direct || undefined}
        data-dragging={dragging || undefined}
        data-resizing={resizing || undefined}
        data-slot="canvas-window"
        data-container={container || undefined}
        data-highlighted={(!preview && canvas.computed.dockDrop.target.get() === id) || undefined}
        data-window-id={id}
        data-active={canvas.computed.view.activeWindowId.get() === id || undefined}
        data-selected={selected || undefined}
        style={{
          position: "absolute",
          boxSizing: "border-box",
          display: visible ? undefined : "none",
          left: 0,
          top: 0,
          transform: `translate(${rect.x}px, ${rect.y}px)`,
          width: rect.width,
          height: rect.height,
          pointerEvents: preview ? "none" : undefined,
          zIndex: preview
            ? canvas.computed.overlayZIndex.get()
            : canvas.computed.windowZIndex[id].get(),
        }}
        onPointerDown={(event) => {
          if (mode !== "edit" || event.defaultPrevented || !isPrimaryButton(event)) return;
          if (isInteractiveTarget(event.target)) {
            report(canvas.actions.focusWindow.run({ window: id }));
            return;
          }
          if (event.shiftKey || event.ctrlKey || event.metaKey) {
            report(
              canvas.actions.selectTargets.run({
                targets: [{ type: "window", id }],
                mode: event.ctrlKey || event.metaKey ? "toggle" : "add",
              }),
            );
            return;
          }
          const action =
            canvas.computed.selection.targets[`window:${id}`].peek() === undefined
              ? canvas.actions.selectWindow
              : canvas.actions.focusWindow;
          report(action.run({ window: id }));
        }}
      >
        <WindowContents window={window} renderWindow={renderWindow} />
        {container && (
          <WindowControls
            canvas={canvas}
            window={window}
            viewport={viewport}
            instanceId={instanceId}
            origin={rect}
            renderChildLabel={renderChildLabel}
            renderControl={renderControl}
          />
        )}
      </article>
    </WindowContext.Provider>
  );
});

const SelectionHandles = observer(function SelectionHandles({
  canvas,
  viewport,
}: Pick<WindowContextValue, "canvas" | "viewport">) {
  const { mode } = useCanvasViewport();
  if (mode !== "edit") return null;
  return canvas.computed.selectedWindows.map((window) => {
    const id = window.id.get();
    const rect = canvas.computed.windowRect[id].get();
    if (
      rect === undefined ||
      !canvas.computed.windowVisible[id].get() ||
      !canvas.actions.resizeWindow.canRun({ window: id, width: rect.width, height: rect.height })
    )
      return null;
    return (
      <div
        key={id}
        data-slot="canvas-selection"
        data-window-id={id}
        style={{
          position: "absolute",
          left: 0,
          top: 0,
          transform: `translate(${rect.x}px, ${rect.y}px)`,
          width: rect.width,
          height: rect.height,
          pointerEvents: "none",
          zIndex: canvas.computed.overlayZIndex.get() + 2,
        }}
      >
        <ResizeHandles canvas={canvas} window={window} viewport={viewport} />
      </div>
    );
  });
});

const SelectionBounds = observer(function SelectionBounds({ canvas }: { canvas: Canvas }) {
  const { mode } = useCanvasViewport();
  if (mode !== "edit") return null;
  const bounds = canvas.computed.selectionBounds.get();
  if (bounds == null) return null;
  return (
    <div
      data-slot="canvas-selection-bounds"
      aria-hidden="true"
      style={{
        position: "absolute",
        left: 0,
        top: 0,
        transform: `translate(${bounds.x}px, ${bounds.y}px)`,
        width: bounds.width,
        height: bounds.height,
        pointerEvents: "none",
      }}
    />
  );
});

function WorldLayer({ canvas, children }: { canvas: Canvas; children: ReactNode }) {
  const camera = canvas.computed.camera.peek();
  const scrollContext = useContext(ScrollContext);
  const onTrack = useValue(() => {
    return scrollContext?.canvas === canvas && scrollContext.following.get();
  });
  const viewport = scrollContext?.viewport;
  const track = scrollContext?.track;
  const axis = scrollContext?.axis;
  const ref = useCallback(
    (element: HTMLDivElement | null) => {
      if (element === null) return;
      const container = viewport?.current;
      if (onTrack && container && track?.length) {
        const viewport = canvas.state.input.viewport.peek();
        const transform = [0, track.length].map(
          (offset) =>
            `matrix(${[...cameraMatrix({ camera: track.at(offset), viewport })].join(",")})`,
        );
        return scroll(animate(element, { transform }, { ease: "linear" }), {
          container,
          axis: axis === "vertical" ? "y" : "x",
        });
      }
      return observe(() => {
        const camera = canvas.computed.camera.get();
        const viewport = canvas.state.input.viewport.get();
        element.style.transform = `matrix(${[...cameraMatrix({ camera, viewport })].join(",")})`;
      });
    },
    [canvas, onTrack, viewport, track, axis],
  );
  return (
    <div
      ref={ref}
      data-slot="canvas-world"
      style={{
        position: "absolute",
        inset: 0,
        transformOrigin: "0 0",
        transform: `translate(50%, 50%) scale(${camera.zoom}) translate(${-camera.center.x}px, ${-camera.center.y}px)`,
      }}
    >
      {children}
    </div>
  );
}

function CanvasOverlays({ canvas, children }: { canvas: Canvas; children: ReactNode }) {
  const ref = useCallback(
    (element: HTMLDivElement | null) => {
      if (element === null) return;
      return observe(() => {
        element.style.setProperty(
          "--canvas-screen-scale",
          String(1 / canvas.computed.camera.zoom.get()),
        );
      });
    },
    [canvas],
  );
  return (
    <div ref={ref} style={{ display: "contents" }}>
      {children}
    </div>
  );
}

const MarqueeView = observer(function MarqueeView({ canvas }: { canvas: Canvas }) {
  const rect = canvas.computed.marqueeRect.get();
  return rect === null ? null : (
    <div
      data-slot="canvas-marquee"
      aria-hidden="true"
      style={{
        position: "absolute",
        pointerEvents: "none",
        left: rect.x,
        top: rect.y,
        width: rect.width,
        height: rect.height,
      }}
    />
  );
});

const AlignmentGuides = observer(function AlignmentGuides({ canvas }: { canvas: Canvas }) {
  return canvas.computed.alignmentGuides.get().map((guide) => (
    <div
      key={guide.axis}
      data-slot="canvas-alignment-guide"
      data-axis={guide.axis}
      aria-hidden="true"
      style={{
        position: "absolute",
        pointerEvents: "none",
        left: guide.axis === "x" ? guide.position : guide.start,
        top: guide.axis === "y" ? guide.position : guide.start,
        width: guide.axis === "y" ? guide.end - guide.start : 0,
        height: guide.axis === "x" ? guide.end - guide.start : 0,
        zIndex: canvas.computed.overlayZIndex.get() + 1,
      }}
    />
  ));
});

export function CanvasViewport({
  canvas,
  renderWindow,
  renderChildLabel,
  renderControl,
  children,
  className,
  style,
  "aria-label": ariaLabel = "Canvas",
  "aria-labelledby": ariaLabelledBy,
  wheelLineHeight = 40,
  emptyCanvasDrag = "pan",
  transferType = COMPONENT_TRANSFER_TYPE,
  mode: modeProp,
  hotkeys: hotkeysProp,
  layoutMotion,
  reducedMotion = "user",
}: {
  canvas: Canvas;
  renderWindow: (window: Observable<WindowState>) => ReactNode;
  renderChildLabel?: ChildLabel;
  renderControl?: ControlRenderer;
  children?: ReactNode;
  className?: string;
  style?: CSSProperties;
  "aria-label"?: string;
  "aria-labelledby"?: string;
  wheelLineHeight?: number;
  emptyCanvasDrag?: "pan" | "marquee" | "marqueeWhenSelectionExists";
  transferType?: string;
  mode?: "edit" | "read" | "explore";
  hotkeys?: Hotkeys;
  layoutMotion?: LayoutMotion | false;
  reducedMotion?: "user" | "always" | "never";
}) {
  const viewport = useRef<HTMLDivElement>(null);
  const [portal, setPortal] = useState<HTMLDivElement | null>(null);
  const scrollMode = useCanvasScrollMode();
  const scrollAxis = useCanvasScrollAxis();
  const mode = modeProp ?? scrollMode ?? "edit";
  const navigationLocked = (scrollMode ?? mode) === "read";
  const context = useMemo(
    () => ({ canvas, viewport, transferType, portal, mode }),
    [canvas, transferType, portal, mode],
  );
  const hotkeys = hotkeysProp ?? (mode === "edit" ? defaultHotkeys : {});
  const instanceId = useId();
  const spaceHeld = useKeyHold("Space");
  const layoutTransition = useMemo(
    () =>
      spring({
        stiffness: 220,
        damping: 30,
        ...layoutMotion,
        keyframes: [0, 1],
      }).toString(),
    [layoutMotion],
  );
  const viewportStyle: CSSProperties & {
    "--canvas-default-layout-motion": string;
  } = {
    "--canvas-default-layout-motion": layoutTransition,
    ...style,
  };
  // @ts-expect-error useMeasure guards null; its ref type predates React 19.
  const viewportSize = useMeasure(viewport);
  useObserve(() => {
    const { width, height } = viewportSize.get();
    if (width === undefined || height === undefined) return;
    const opening = canvas.state.input.viewport.width.peek() === 0;
    canvas.state.input.viewport.set({ width, height });
    const content = canvas.computed.contentBounds.peek();
    if (
      opening &&
      scrollMode !== "read" &&
      content !== null &&
      !intersectsRect(canvas.computed.viewportRect.peek(), content)
    )
      report(canvas.actions.fitAll.run({}));
  });
  useEffect(() => {
    const element = viewport.current;
    if (element === null || navigationLocked) return;
    const wheel = (event: WheelEvent) => {
      const size = canvas.state.input.viewport.peek();
      if (size.width <= 0 || size.height <= 0) return;
      const zoom = event.ctrlKey || event.metaKey;
      if (
        !zoom &&
        event.target instanceof Element &&
        event.target.closest(
          "input,select,textarea,[contenteditable='true'],[contenteditable=''],[data-canvas-scroll='native']",
        ) !== null
      )
        return;
      const units: Record<number, { x: number; y: number }> = {
        [WheelEvent.DOM_DELTA_PIXEL]: { x: 1, y: 1 },
        [WheelEvent.DOM_DELTA_LINE]: { x: wheelLineHeight, y: wheelLineHeight },
        [WheelEvent.DOM_DELTA_PAGE]: { x: size.width, y: size.height },
      };
      const unit = units[event.deltaMode] ?? units[WheelEvent.DOM_DELTA_PIXEL];
      event.preventDefault();
      const error = zoom
        ? canvas.actions.zoomCamera.run({
            factor: Math.exp(-event.deltaY * unit.y * canvas.state.config.camera.zoomSpeed.peek()),
            point: getViewportPoint({ element, event }),
          })
        : canvas.actions.panCamera.run({ x: event.deltaX * unit.x, y: event.deltaY * unit.y });
      report(error);
    };
    element.addEventListener("wheel", wheel, { capture: true, passive: false });
    return () => element.removeEventListener("wheel", wheel, { capture: true });
  }, [canvas, wheelLineHeight, navigationLocked]);
  useHotkeys(getHotkeyDefinitions({ canvas, hotkeys }), {
    target: viewport,
    ignoreInputs: true,
    preventDefault: false,
    stopPropagation: false,
    conflictBehavior: "warn",
  });
  useEffect(() => {
    const disposeCapture = canvas.computed.capturedPointerId.onChange(({ value, getPrevious }) => {
      const previous = getPrevious();
      if (typeof previous === "number" && previous !== value && viewport.current !== null)
        releasePointer(viewport.current, previous);
    });
    const cancel = () => {
      report(canvas.actions.cancelDrag.run({}));
    };
    window.addEventListener("blur", cancel);
    return () => {
      window.removeEventListener("blur", cancel);
      cancel();
      disposeCapture();
    };
  }, [canvas]);
  return (
    <ViewportContext.Provider value={context}>
      <div
        ref={viewport}
        role="region"
        aria-label={ariaLabel}
        aria-labelledby={ariaLabelledBy}
        data-slot="canvas-viewport"
        className={className}
        data-mode={mode}
        data-layout-motion={layoutMotion === false ? "off" : "on"}
        data-reduced-motion={reducedMotion}
        style={{
          position: "relative",
          width: "100%",
          height: "100%",
          overflow: "hidden",
          touchAction: !navigationLocked ? "none" : scrollAxis === "horizontal" ? "pan-x" : "pan-y",
          ...viewportStyle,
        }}
        tabIndex={0}
        {...(mode === "edit" ? getTransferHandlers({ canvas, transferType }) : {})}
        onPointerMove={(event) => {
          const element = event.currentTarget;
          const pointerId = canvas.computed.capturedPointerId.peek();
          if (pointerId !== event.pointerId) return;
          report(canvas.actions.updatePointer.run(readPointer(event, element)));
          const tabDrag = canvas.state.session.tabDrag.peek();
          if (tabDrag === null || canvas.computed.tabDragInside.peek() !== true) return;
          const siblings = [...element.querySelectorAll<HTMLElement>("[data-canvas-tab]")].filter(
            (tab) =>
              tab.dataset.containerId === tabDrag.container &&
              tab.dataset.childId !== tabDrag.child,
          );
          const next = siblings.find(
            (tab) => event.clientX < centroidOfRect(tab.getBoundingClientRect()).x,
          );
          const target = next ?? siblings.at(-1);
          if (target?.dataset.childId !== undefined)
            report(
              canvas.actions.targetTab.run({
                child: target.dataset.childId,
                after: next === undefined,
              }),
            );
        }}
        onPointerUp={(event) => {
          if (canvas.computed.capturedPointerId.peek() !== event.pointerId) return;
          report(canvas.actions.updatePointer.run(readPointer(event, event.currentTarget)));
          report(canvas.actions.releasePointer.run({ pointerId: event.pointerId }));
        }}
        onPointerCancel={(event) => {
          if (canvas.computed.capturedPointerId.peek() === event.pointerId)
            report(canvas.actions.cancelPointer.run({ pointerId: event.pointerId }));
        }}
        onPointerDownCapture={(event) => {
          if (
            event.defaultPrevented ||
            !event.isPrimary ||
            (event.button !== 0 && event.button !== 1)
          )
            return;
          if (!(event.target instanceof Element) || !event.currentTarget.contains(event.target))
            return;
          const interactive = isInteractiveTarget(event.target);
          if (mode === "read" || (mode === "explore" && interactive)) return;
          const explicitPan =
            event.button === 1 ||
            event.altKey ||
            (spaceHeld && event.currentTarget.ownerDocument.activeElement === event.currentTarget);
          if (
            mode === "edit" &&
            !explicitPan &&
            (interactive || event.target.closest("[data-window-id]") !== null)
          )
            return;
          const pan =
            mode === "explore" ||
            explicitPan ||
            emptyCanvasDrag === "pan" ||
            (emptyCanvasDrag === "marqueeWhenSelectionExists" &&
              canvas.computed.selectionTargets.length === 0);
          if (pan && navigationLocked) {
            event.stopPropagation();
            return;
          }
          const pointer = readPointer(event, event.currentTarget);
          if (mode === "edit" && pan && !explicitPan)
            report(canvas.actions.selectTargets.run({ targets: [] }));
          const selectionMode = event.ctrlKey || event.metaKey ? "toggle" : "add";
          const error = pan
            ? canvas.actions.beginPan.run(pointer)
            : canvas.actions.beginMarquee.run({
                pointer,
                mode: event.ctrlKey || event.metaKey || event.shiftKey ? selectionMode : "replace",
              });
          report(error);
          if (error !== undefined) return;
          event.preventDefault();
          event.stopPropagation();
          event.currentTarget.focus({ preventScroll: true });
          capturePointer({ canvas, element: event.currentTarget, pointerId: event.pointerId });
        }}
        onLostPointerCapture={(event) => {
          if (canvas.computed.capturedPointerId.peek() === event.pointerId)
            report(canvas.actions.cancelPointer.run({ pointerId: event.pointerId }));
        }}
        onPointerLeave={() => {
          if (canvas.computed.capturedPointerId.peek() === null)
            canvas.state.input.pointer.set(null);
        }}
        onKeyDown={(event) => {
          if (event.defaultPrevented || event.nativeEvent.isComposing) return;
          if (
            mode === "edit" &&
            event.target === event.currentTarget &&
            (event.code === "Space" || event.key === " ")
          ) {
            event.preventDefault();
          }
          const pointerId = canvas.computed.capturedPointerId.peek();
          if (event.key === "Escape") canvas.camera.stop();
          if (event.key === "Escape" && pointerId !== null) {
            report(canvas.actions.cancelDrag.run({}));
            event.preventDefault();
          }
        }}
      >
        <WorldLayer canvas={canvas}>
          <For each={canvas.computed.workspaceWindows}>
            {(window) => (
              <WindowView
                canvas={canvas}
                window={window}
                viewport={viewport}
                renderWindow={renderWindow}
                instanceId={instanceId}
                renderChildLabel={renderChildLabel}
                renderControl={renderControl}
              />
            )}
          </For>
          <For each={canvas.computed.previewWindows}>
            {(window) => (
              <WindowView
                canvas={canvas}
                window={window}
                viewport={viewport}
                renderWindow={renderWindow}
                instanceId={instanceId}
                preview
              />
            )}
          </For>
          <CanvasOverlays canvas={canvas}>
            <SelectionBounds canvas={canvas} />
            <SelectionHandles canvas={canvas} viewport={viewport} />
            <MarqueeView canvas={canvas} />
            <AlignmentGuides canvas={canvas} />
          </CanvasOverlays>
        </WorldLayer>
        <div
          ref={setPortal}
          data-slot="canvas-portal"
          data-canvas-control
          style={{ position: "absolute", inset: 0, pointerEvents: "none" }}
        />
        {children}
      </div>
    </ViewportContext.Provider>
  );
}
