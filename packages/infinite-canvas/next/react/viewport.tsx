import { For, observer, useObserve } from "@legendapp/state/react";
import { useMeasure } from "@legendapp/state/react-hooks/useMeasure";
import type { Observable } from "@legendapp/state";
import {
  useEffect,
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
import { spring } from "motion";
import type { WindowState } from "../document.types";
import { getResizeHandleDescriptors, type ResizeHandle } from "../geometry";
import type { Canvas } from "../state.types";
import {
  readPointer,
  report,
  capturePointer,
  getClientPoint,
  getViewportPoint,
  isInteractiveTarget,
  isPrimaryButton,
  releasePointer,
  COMPONENT_TRANSFER_TYPE,
  readComponentTransfer,
  defaultHotkeys,
  getHotkeyDefinitions,
  type Hotkeys,
} from "../input";
import { useHotkeys } from "@tanstack/react-hotkeys";
import "./frame.css";
import { WindowControls, type ChildLabel, type ControlRenderer } from "./controls";
import { createCanvasTools } from "../tools";
import {
  CanvasPortal,
  ViewportContext,
  WindowContext,
  useCanvasWindow,
  type WindowContextValue,
} from "./context";

function ToolRegistration({ tool }: { tool: WebMCPOptions<unknown, unknown> }) {
  useWebMCP(tool);
  return null;
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
  capturePointer(element, event.pointerId);
}

export function WindowDragHandle({
  threshold,
  onPointerDown,
  ...props
}: ComponentProps<"div"> & { threshold?: number }) {
  const context = useCanvasWindow();
  return (
    <div
      {...props}
      data-slot="canvas-drag-handle"
      onPointerDown={(event) => {
        onPointerDown?.(event);
        if (event.defaultPrevented || isInteractiveTarget(event.target)) return;
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
    carried ||
    (drag?.kind === "sash" && canvas.computed.windowRoot[drag.container].get() === root);
  const container = !preview && window.layout.get() !== undefined;
  const resizable =
    !preview &&
    canvas.actions.resizeWindow.canRun({ window: id, width: rect.width, height: rect.height });
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
        data-selected={
          canvas.computed.selection.targets[`window:${id}`].get() !== undefined || undefined
        }
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
          if (!isPrimaryButton(event)) return;
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
        {resizable && !container && (
          <ResizeHandles canvas={canvas} window={window} viewport={viewport} />
        )}
        {resizable && container && (
          <CanvasPortal scope="window" above>
            <ResizeHandles canvas={canvas} window={window} viewport={viewport} />
          </CanvasPortal>
        )}
      </article>
    </WindowContext.Provider>
  );
});

const WorldLayer = observer(function WorldLayer({
  canvas,
  children,
}: {
  canvas: Canvas;
  children: ReactNode;
}) {
  const camera = canvas.computed.camera.get();
  const size = canvas.state.input.viewport.get();
  const style: CSSProperties & { "--canvas-screen-scale": number } = {
    "--canvas-screen-scale": 1 / camera.zoom,
    position: "absolute",
    inset: 0,
    transformOrigin: "0 0",
    transform: `translate(${size.width / 2 - camera.center.x * camera.zoom}px, ${size.height / 2 - camera.center.y * camera.zoom}px) scale(${camera.zoom})`,
  };
  return (
    <div data-slot="canvas-world" style={style}>
      {children}
    </div>
  );
});

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
  wheelLineHeight = 40,
  emptyCanvasDrag = "pan",
  transferType = COMPONENT_TRANSFER_TYPE,
  hotkeys = defaultHotkeys,
  layoutMotion,
  dragMotion,
  reducedMotion = "user",
}: {
  canvas: Canvas;
  renderWindow: (window: Observable<WindowState>) => ReactNode;
  renderChildLabel?: ChildLabel;
  renderControl?: ControlRenderer;
  children?: ReactNode;
  className?: string;
  style?: CSSProperties;
  wheelLineHeight?: number;
  emptyCanvasDrag?: "pan" | "marquee" | "marqueeWhenSelectionExists";
  transferType?: string;
  hotkeys?: Hotkeys;
  layoutMotion?: LayoutMotion | false;
  dragMotion?: LayoutMotion | false;
  reducedMotion?: "user" | "always" | "never";
}) {
  const viewport = useRef<HTMLDivElement>(null);
  const [portal, setPortal] = useState<HTMLDivElement | null>(null);
  const context = useMemo(
    () => ({ canvas, viewport, transferType, portal }),
    [canvas, transferType, portal],
  );
  const instanceId = useId();
  const spacePan = useRef(false);
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
  const dragTransition = useMemo(
    () =>
      spring({
        stiffness: 700,
        damping: 45,
        ...dragMotion,
        keyframes: [0, 1],
      }).toString(),
    [dragMotion],
  );
  const viewportStyle: CSSProperties & {
    "--canvas-default-layout-motion": string;
    "--canvas-default-drag-motion": string;
  } = {
    "--canvas-default-layout-motion": layoutTransition,
    "--canvas-default-drag-motion": dragTransition,
    ...style,
  };
  // @ts-expect-error useMeasure guards null; its ref type predates React 19.
  const viewportSize = useMeasure(viewport);
  useObserve(() => {
    const { width, height } = viewportSize.get();
    if (width !== undefined && height !== undefined)
      canvas.state.input.viewport.set({ width, height });
  });
  useEffect(() => {
    const element = viewport.current;
    if (element === null) return;
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
            point: getViewportPoint(element, getClientPoint(event)),
          })
        : canvas.actions.panCamera.run({ x: event.deltaX * unit.x, y: event.deltaY * unit.y });
      report(error);
    };
    element.addEventListener("wheel", wheel, { capture: true, passive: false });
    return () => element.removeEventListener("wheel", wheel, { capture: true });
  }, [canvas, wheelLineHeight]);
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
      spacePan.current = false;
      report(canvas.actions.cancelDrag.run({}));
    };
    const keyUp = (event: KeyboardEvent) => {
      if (event.code === "Space" || event.key === " ") spacePan.current = false;
    };
    const move = (event: globalThis.PointerEvent) => {
      const element = viewport.current;
      if (element === null) return;
      const pointerId = canvas.computed.capturedPointerId.peek();
      if (pointerId !== null && pointerId !== event.pointerId) return;
      if (
        pointerId === null &&
        (!(event.target instanceof Node) || !element.contains(event.target))
      )
        return;
      report(canvas.actions.updatePointer.run(readPointer(event, element)));
      const tabDrag = canvas.state.session.tabDrag.peek();
      if (tabDrag !== null && canvas.computed.tabDragInside.peek() === true) {
        const siblings = [...element.querySelectorAll<HTMLElement>("[data-canvas-tab]")].filter(
          (tab) =>
            tab.dataset.containerId === tabDrag.container && tab.dataset.childId !== tabDrag.child,
        );
        const next = siblings.find((tab) => {
          const rect = tab.getBoundingClientRect();
          return event.clientX < rect.left + rect.width / 2;
        });
        const target = next ?? siblings.at(-1);
        if (target?.dataset.childId !== undefined)
          report(
            canvas.actions.targetTab.run({
              child: target.dataset.childId,
              after: next === undefined,
            }),
          );
      }
    };
    const release = (event: globalThis.PointerEvent) => {
      const element = viewport.current;
      if (element === null || canvas.computed.capturedPointerId.peek() !== event.pointerId) return;
      if (event.type === "pointerup") {
        report(canvas.actions.updatePointer.run(readPointer(event, element)));
        report(canvas.actions.releasePointer.run({ pointerId: event.pointerId }));
      } else report(canvas.actions.cancelPointer.run({ pointerId: event.pointerId }));
    };
    window.addEventListener("pointermove", move);
    window.addEventListener("pointerup", release);
    window.addEventListener("pointercancel", release);
    window.addEventListener("blur", cancel);
    window.addEventListener("keyup", keyUp);
    return () => {
      window.removeEventListener("pointermove", move);
      window.removeEventListener("pointerup", release);
      window.removeEventListener("pointercancel", release);
      window.removeEventListener("blur", cancel);
      window.removeEventListener("keyup", keyUp);
      cancel();
      disposeCapture();
    };
  }, [canvas]);
  return (
    <ViewportContext.Provider value={context}>
      <div
        ref={viewport}
        data-slot="canvas-viewport"
        className={className}
        data-layout-motion={layoutMotion === false ? "off" : "on"}
        data-reduced-motion={reducedMotion}
        data-drag-motion={dragMotion === false ? "off" : "on"}
        style={{
          position: "relative",
          width: "100%",
          height: "100%",
          overflow: "hidden",
          touchAction: "none",
          ...viewportStyle,
        }}
        tabIndex={0}
        onDragOver={(event) => {
          if (!event.dataTransfer.types.includes(transferType)) return;
          if (event.target instanceof Element && event.target.closest("[data-canvas-control]"))
            return;
          event.preventDefault();
          event.dataTransfer.dropEffect = "copy";
          if (canvas.state.session.drop.pointerId.peek() === null)
            report(
              canvas.actions.updateDrop.run(
                getViewportPoint(event.currentTarget, getClientPoint(event)),
              ),
            );
        }}
        onDragLeave={(event) => {
          if (!(event.target instanceof Node) || !event.currentTarget.contains(event.target))
            return;
          if (
            event.relatedTarget instanceof Node &&
            event.currentTarget.contains(event.relatedTarget)
          )
            return;
          if (canvas.state.session.drop.pointerId.peek() === null)
            report(canvas.actions.cancelDrag.run({}));
        }}
        onDrop={(event) => {
          if (!event.dataTransfer.types.includes(transferType)) return;
          if (event.target instanceof Element && event.target.closest("[data-canvas-control]"))
            return;
          event.preventDefault();
          event.stopPropagation();
          const point = getViewportPoint(event.currentTarget, getClientPoint(event));
          if (canvas.state.session.drop.pointerId.peek() === null) {
            report(canvas.actions.updateDrop.run(point));
            report(canvas.actions.commitDrop.run({}));
            return;
          }
          const insertion = readComponentTransfer({
            transfer: event.dataTransfer,
            format: transferType,
          });
          if (insertion instanceof Error) {
            report(insertion);
            return;
          }
          if (insertion === null) return;
          const error = canvas.actions.beginDrop.run({ insertion, point });
          report(error);
          if (error === undefined) report(canvas.actions.commitDrop.run({}));
        }}
        onPaste={(event) => {
          if (isInteractiveTarget(event.target)) return;
          const insertion = readComponentTransfer({
            transfer: event.clipboardData,
            format: transferType,
          });
          if (insertion instanceof Error) {
            report(insertion);
            return;
          }
          if (insertion === null) return;
          event.preventDefault();
          report(canvas.actions.insertComponent.run({ ...insertion, id: crypto.randomUUID() }));
        }}
        onPointerDownCapture={(event) => {
          if (!event.isPrimary || (event.button !== 0 && event.button !== 1)) return;
          if (!(event.target instanceof Element) || !event.currentTarget.contains(event.target))
            return;
          if (event.button !== 1 && !event.altKey && !spacePan.current) return;
          const error = canvas.actions.beginPan.run(readPointer(event, event.currentTarget));
          report(error);
          if (error !== undefined) return;
          event.preventDefault();
          event.stopPropagation();
          event.currentTarget.focus({ preventScroll: true });
          capturePointer(event.currentTarget, event.pointerId);
        }}
        onPointerDown={(event) => {
          if (
            !event.isPrimary ||
            (event.button !== 0 && event.button !== 1) ||
            isInteractiveTarget(event.target)
          )
            return;
          if (!(event.target instanceof Element) || !event.currentTarget.contains(event.target))
            return;
          if (event.target.closest("[data-window-id],[data-canvas-control]")) return;
          const explicitPan = event.button === 1 || event.altKey || spacePan.current;
          const pan =
            explicitPan ||
            emptyCanvasDrag === "pan" ||
            (emptyCanvasDrag === "marqueeWhenSelectionExists" &&
              canvas.computed.selectionTargets.length === 0);
          const pointer = readPointer(event, event.currentTarget);
          if (pan && !explicitPan) report(canvas.actions.selectTargets.run({ targets: [] }));
          const mode = event.ctrlKey || event.metaKey ? "toggle" : "add";
          const error = pan
            ? canvas.actions.beginPan.run(pointer)
            : canvas.actions.beginMarquee.run({
                pointer,
                mode: event.ctrlKey || event.metaKey || event.shiftKey ? mode : "replace",
              });
          report(error);
          if (error !== undefined) return;
          event.preventDefault();
          event.currentTarget.focus({ preventScroll: true });
          capturePointer(event.currentTarget, event.pointerId);
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
            event.target === event.currentTarget &&
            (event.code === "Space" || event.key === " ")
          ) {
            event.preventDefault();
            spacePan.current = true;
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
          <MarqueeView canvas={canvas} />
          <AlignmentGuides canvas={canvas} />
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
