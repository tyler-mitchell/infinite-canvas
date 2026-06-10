"use client";

import { Maximize2, Minimize2, Pin, X } from "lucide-react";
import {
  createContext,
  useContext,
  type CSSProperties,
  type PointerEvent as ReactPointerEvent,
} from "react";

import { INFINITE_CANVAS_SLOTS } from "./data-attributes";
import { focusInfiniteCanvasCommandSurface } from "./keyboard";
import { InfiniteCanvasWindowBody } from "./rasterization-layer";
import {
  capturePointer,
  clearNativeTextSelection,
  getClientPoint,
  getViewportPoint,
  isPrimaryButton,
  releasePointer,
} from "./runtime";
import type {
  InfiniteCanvasChromeMetrics,
  InfiniteCanvasCommands,
  InfiniteCanvasPoint,
  InfiniteCanvasState,
  InfiniteCanvasTheme,
  InfiniteCanvasWindow,
  InfiniteCanvasWindowBodyPointerBehavior,
  InfiniteCanvasWindowDefinition,
  InfiniteCanvasWindowFrameActiveCornersProps,
  InfiniteCanvasWindowFrameBodyProps,
  InfiniteCanvasWindowFrameControlsProps,
  InfiniteCanvasWindowFrameHeaderProps,
  InfiniteCanvasWindowFrameSlots,
  InfiniteCanvasWindowFrameSurfaceProps,
  InfiniteCanvasWindowFrameTitleProps,
  InfiniteCanvasWindowTextSelection,
} from "./types";

type InfiniteCanvasWindowFrameRuntimeContextValue<Kind extends string> = Readonly<{
  actions: InfiniteCanvasCommands<Kind>;
  bodyPointerBehavior: InfiniteCanvasWindowBodyPointerBehavior;
  chrome: InfiniteCanvasChromeMetrics;
  definition: InfiniteCanvasWindowDefinition<Kind>;
  isActive: boolean;
  isSelected: boolean;
  state: InfiniteCanvasState<Kind>;
  textSelection: InfiniteCanvasWindowTextSelection;
  theme: InfiniteCanvasTheme;
  window: InfiniteCanvasWindow<Kind>;
}>;

const InfiniteCanvasWindowFrameRuntimeContext = createContext<unknown>(null);

const DEFAULT_INFINITE_CANVAS_WINDOW_FRAME_SLOTS = {
  ActiveCorners: InfiniteCanvasWindowFrameActiveCornersSlot,
  Body: InfiniteCanvasWindowFrameBodySlot,
  Controls: InfiniteCanvasWindowFrameControlsSlot,
  Header: InfiniteCanvasWindowFrameHeaderSlot,
  Surface: InfiniteCanvasWindowFrameSurfaceSlot,
  Title: InfiniteCanvasWindowFrameTitleSlot,
} satisfies InfiniteCanvasWindowFrameSlots;

function useInfiniteCanvasWindowFrameRuntimeContext<Kind extends string = string>() {
  const context = useContext(InfiniteCanvasWindowFrameRuntimeContext);

  if (context === null) {
    throw new Error("Infinite canvas frame slots must render inside a window frame.");
  }

  return context as InfiniteCanvasWindowFrameRuntimeContextValue<Kind>;
}

function InfiniteCanvasWindowFrameTitleSlot({
  children,
  className,
  style,
}: InfiniteCanvasWindowFrameTitleProps) {
  const { window } = useInfiniteCanvasWindowFrameRuntimeContext();

  return (
    <div
      className={mergeClassNames(
        "min-w-0 truncate text-[10px] font-medium uppercase text-white/58",
        className,
      )}
      data-slot={INFINITE_CANVAS_SLOTS.windowTitle}
      style={style}
    >
      {children === undefined ? window.title : children}
    </div>
  );
}

function InfiniteCanvasWindowFrameControlsSlot({
  className,
  style,
}: InfiniteCanvasWindowFrameControlsProps) {
  const { actions, window } = useInfiniteCanvasWindowFrameRuntimeContext();

  return (
    <div
      className={mergeClassNames("flex shrink-0 items-center gap-1", className)}
      data-slot={INFINITE_CANVAS_SLOTS.windowControls}
      style={style}
    >
      <button
        aria-label={window.isPinned ? "Unpin window" : "Pin window"}
        className="flex h-6 w-6 items-center justify-center border border-white/8 bg-white/[0.03] text-white/46 transition hover:border-white/20 hover:bg-white/[0.08] hover:text-white"
        data-action="pin"
        data-active={window.isPinned ? "" : undefined}
        data-slot={INFINITE_CANVAS_SLOTS.windowControl}
        onClick={(event) => {
          event.stopPropagation();
          actions.togglePinned(window.id);
        }}
        onPointerDown={(event) => {
          event.stopPropagation();
        }}
        style={{
          cursor: "pointer",
        }}
        type="button"
      >
        <Pin
          className={window.isPinned ? "rotate-45 text-[#b7f4ff]" : "rotate-45"}
          size={12}
          strokeWidth={1.8}
        />
      </button>
      <button
        aria-label="Minimize window"
        className="flex h-6 w-6 items-center justify-center border border-white/8 bg-white/[0.03] text-white/46 transition hover:border-white/20 hover:bg-white/[0.08] hover:text-white"
        data-action="minimize"
        data-slot={INFINITE_CANVAS_SLOTS.windowControl}
        onClick={(event) => {
          event.stopPropagation();
          actions.minimizeWindow(window.id);
        }}
        onPointerDown={(event) => {
          event.stopPropagation();
        }}
        style={{
          cursor: "pointer",
        }}
        type="button"
      >
        <Minimize2 size={12} strokeWidth={1.8} />
      </button>
      <button
        aria-label={window.mode === "maximized" ? "Restore window" : "Maximize window"}
        className="flex h-6 w-6 items-center justify-center border border-white/8 bg-white/[0.03] text-white/46 transition hover:border-white/20 hover:bg-white/[0.08] hover:text-white"
        data-action={window.mode === "maximized" ? "restore" : "maximize"}
        data-slot={INFINITE_CANVAS_SLOTS.windowControl}
        onClick={(event) => {
          event.stopPropagation();
          if (window.mode === "maximized") {
            actions.restoreWindow(window.id);
          } else {
            actions.maximizeWindow(window.id);
          }
        }}
        onPointerDown={(event) => {
          event.stopPropagation();
        }}
        style={{
          cursor: "pointer",
        }}
        type="button"
      >
        <Maximize2 size={12} strokeWidth={1.8} />
      </button>
      <button
        aria-label="Close window"
        className="flex h-6 w-6 items-center justify-center border border-white/8 bg-white/[0.03] text-white/46 transition hover:border-white/20 hover:bg-white/[0.08] hover:text-white"
        data-action="close"
        data-slot={INFINITE_CANVAS_SLOTS.windowControl}
        onClick={(event) => {
          event.stopPropagation();
          actions.closeWindow(window.id);
        }}
        onPointerDown={(event) => {
          event.stopPropagation();
        }}
        style={{
          cursor: "pointer",
        }}
        type="button"
      >
        <X size={12} strokeWidth={1.8} />
      </button>
    </div>
  );
}

function InfiniteCanvasWindowFrameHeaderSlot({
  children,
  className,
  style,
}: InfiniteCanvasWindowFrameHeaderProps) {
  const { actions, chrome, isActive, theme, window } = useInfiniteCanvasWindowFrameRuntimeContext();

  return (
    <header
      className={mergeClassNames(
        "absolute left-0 right-0 top-0 flex items-center justify-between gap-3 px-3",
        className,
      )}
      data-infinite-canvas-control="true"
      data-slot={INFINITE_CANVAS_SLOTS.windowHeader}
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
        focusEventCommandSurface(event);

        if (applyModifiedPointerSelection(actions, event, window.id)) {
          return;
        }

        capturePointer(event.currentTarget, event.pointerId);
        actions.startMove({
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
        background: isActive ? theme.headerActive : theme.headerIdle,
        borderBottomColor: isActive ? theme.activeAccent : theme.idleBorder,
        borderBottomStyle: "solid",
        borderBottomWidth: `${chrome.headerAccentHeight}px`,
        cursor: "grab",
        height: `${chrome.headerHeight}px`,
        pointerEvents: "auto",
        ...style,
      }}
    >
      {children === undefined ? (
        <>
          <InfiniteCanvasWindowFrameTitleSlot />
          <InfiniteCanvasWindowFrameControlsSlot />
        </>
      ) : (
        children
      )}
    </header>
  );
}

function InfiniteCanvasWindowFrameBodySlot({
  children,
  className,
  style,
}: InfiniteCanvasWindowFrameBodyProps) {
  const {
    actions,
    bodyPointerBehavior,
    chrome,
    definition,
    isActive,
    isSelected,
    state,
    textSelection,
    window,
  } = useInfiniteCanvasWindowFrameRuntimeContext();

  return (
    <section
      className={mergeClassNames("absolute inset-x-0 bottom-0 pointer-events-auto", className)}
      data-infinite-canvas-body="true"
      data-slot={INFINITE_CANVAS_SLOTS.windowBody}
      data-infinite-canvas-body-pan={bodyPointerBehavior === "canvas-pan" ? "true" : undefined}
      data-infinite-canvas-native-scroll={
        definition.wheelBehavior === "native-scroll" ? "true" : undefined
      }
      data-infinite-canvas-native-text-selection={textSelection === "native" ? "true" : undefined}
      onPointerDownCapture={(event) => {
        if (!isPrimaryButton(event)) {
          return;
        }

        if (textSelection === "none") {
          clearNativeTextSelection();
        }

        if (event.shiftKey || event.metaKey || event.ctrlKey) {
          event.preventDefault();
        }

        if (applyModifiedPointerSelection(actions, event, window.id)) {
          event.stopPropagation();
        } else {
          actions.focusWindow(window.id);
        }
      }}
      style={{
        overflowY: definition.overflowY ?? "auto",
        top: `${chrome.headerHeight}px`,
        userSelect: textSelection === "native" ? undefined : "none",
        ...style,
      }}
    >
      {children === undefined ? (
        <InfiniteCanvasWindowBody
          actions={actions}
          chrome={chrome}
          definition={definition}
          isActive={isActive}
          isSelected={isSelected}
          state={state}
          textSelection={textSelection}
          window={window}
        />
      ) : (
        children
      )}
    </section>
  );
}

function InfiniteCanvasWindowFrameActiveCornersSlot({
  className,
  style,
}: InfiniteCanvasWindowFrameActiveCornersProps) {
  const { chrome, isActive } = useInfiniteCanvasWindowFrameRuntimeContext();

  return isActive ? (
    <div
      aria-hidden="true"
      className={className}
      data-slot={INFINITE_CANVAS_SLOTS.windowCorners}
      style={style}
    >
      <ActiveWindowCorners chrome={chrome} />
    </div>
  ) : null;
}

function InfiniteCanvasWindowFrameSurfaceSlot({
  children,
  className,
  style,
}: InfiniteCanvasWindowFrameSurfaceProps) {
  const { chrome, isActive, isSelected, theme } = useInfiniteCanvasWindowFrameRuntimeContext();

  return (
    <div
      className={mergeClassNames(
        "pointer-events-auto absolute inset-0 overflow-hidden border bg-[#07080b]",
        className,
      )}
      data-slot={INFINITE_CANVAS_SLOTS.windowSurface}
      style={{
        background: theme.bodyBackground,
        borderColor: isActive
          ? theme.activeBorder
          : isSelected
            ? theme.selectionBorder
            : theme.idleBorder,
        borderWidth: `${chrome.borderWidth}px`,
        ...style,
      }}
    >
      {children}
    </div>
  );
}

function ActiveWindowCorners({
  chrome,
}: Readonly<{
  chrome: InfiniteCanvasChromeMetrics;
}>) {
  const cornerStyle = {
    height: `${chrome.cornerSize}px`,
    pointerEvents: "none",
    width: `${chrome.cornerSize}px`,
  } satisfies CSSProperties;

  return (
    <>
      <div
        aria-hidden="true"
        className="absolute border-l border-t border-white/25"
        data-corner="top-left"
        data-slot={INFINITE_CANVAS_SLOTS.windowCorner}
        style={{
          ...cornerStyle,
          left: "5px",
          top: "5px",
        }}
      />
      <div
        aria-hidden="true"
        className="absolute border-r border-t border-white/25"
        data-corner="top-right"
        data-slot={INFINITE_CANVAS_SLOTS.windowCorner}
        style={{
          ...cornerStyle,
          right: "5px",
          top: "5px",
        }}
      />
      <div
        aria-hidden="true"
        className="absolute border-b border-l border-white/25"
        data-corner="bottom-left"
        data-slot={INFINITE_CANVAS_SLOTS.windowCorner}
        style={{
          ...cornerStyle,
          bottom: "5px",
          left: "5px",
        }}
      />
      <div
        aria-hidden="true"
        className="absolute border-b border-r border-white/25"
        data-corner="bottom-right"
        data-slot={INFINITE_CANVAS_SLOTS.windowCorner}
        style={{
          ...cornerStyle,
          bottom: "5px",
          right: "5px",
        }}
      />
    </>
  );
}

function mergeClassNames(...classNames: readonly (string | undefined)[]) {
  return classNames
    .filter((className) => className !== undefined && className.length > 0)
    .join(" ");
}

function getEventViewportPoint(event: ReactPointerEvent<HTMLElement>): InfiniteCanvasPoint {
  const viewport = event.currentTarget.closest<HTMLElement>(
    "[data-infinite-canvas-viewport='true']",
  );

  return viewport === null
    ? getClientPoint(event)
    : getViewportPoint(viewport, getClientPoint(event));
}

function focusEventCommandSurface(event: ReactPointerEvent<HTMLElement>) {
  const viewport = event.currentTarget.closest<HTMLElement>(
    "[data-infinite-canvas-viewport='true']",
  );

  focusInfiniteCanvasCommandSurface(getCommandSurfaceElement(viewport));
}

function getCommandSurfaceElement(viewport: HTMLElement | null) {
  return (
    viewport?.querySelector<HTMLElement>("[data-infinite-canvas-command-scope='surface']") ?? null
  );
}

function applyModifiedPointerSelection<Kind extends string>(
  actions: InfiniteCanvasCommands<Kind>,
  event: ReactPointerEvent<HTMLElement>,
  windowId: string,
) {
  if (event.shiftKey) {
    event.preventDefault();
    actions.dispatch({
      type: "selection.add",
      windowIds: [windowId],
    });

    return true;
  }

  if (event.metaKey || event.ctrlKey) {
    event.preventDefault();
    actions.toggleWindowSelection(windowId);

    return true;
  }

  return false;
}

export {
  DEFAULT_INFINITE_CANVAS_WINDOW_FRAME_SLOTS,
  InfiniteCanvasWindowFrameRuntimeContext,
  getEventViewportPoint,
};
export type { InfiniteCanvasWindowFrameRuntimeContextValue };
