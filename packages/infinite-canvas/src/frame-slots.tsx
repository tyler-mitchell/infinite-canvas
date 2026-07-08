"use client";

import {
  createContext,
  useContext,
  type CSSProperties,
  type PointerEvent as ReactPointerEvent,
} from "react";

import { INFINITE_CANVAS_SLOTS } from "./data-attributes";
import { useInfiniteCanvasIcons } from "./icons";
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

/**
 * Everything a frame slot needs, and deliberately no canvas state: this value
 * is memoized on the window's own identity so the slot subtree does not
 * reconcile on camera ticks. Slots that need reactive state subscribe to it
 * directly — see `InfiniteCanvasWindowBody`.
 */
type InfiniteCanvasWindowFrameRuntimeContextValue<Kind extends string> = Readonly<{
  actions: InfiniteCanvasCommands<Kind>;
  bodyPointerBehavior: InfiniteCanvasWindowBodyPointerBehavior;
  chrome: InfiniteCanvasChromeMetrics;
  definition: InfiniteCanvasWindowDefinition<Kind>;
  isActive: boolean;
  isSelected: boolean;
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
      className={className}
      data-slot={INFINITE_CANVAS_SLOTS.windowTitle}
      style={{
        minWidth: 0,
        overflow: "hidden",
        textOverflow: "ellipsis",
        whiteSpace: "nowrap",
        ...style,
      }}
    >
      {children === undefined ? window.title : children}
    </div>
  );
}

const WINDOW_CONTROL_BUTTON_STYLE = {
  alignItems: "center",
  cursor: "pointer",
  display: "flex",
  height: "24px",
  justifyContent: "center",
  width: "24px",
} satisfies CSSProperties;

function InfiniteCanvasWindowFrameControlsSlot({
  className,
  style,
}: InfiniteCanvasWindowFrameControlsProps) {
  const { actions, window } = useInfiniteCanvasWindowFrameRuntimeContext();
  const {
    close: CloseIcon,
    maximize: MaximizeIcon,
    minimize: MinimizeIcon,
    pin: PinIcon,
  } = useInfiniteCanvasIcons();

  return (
    <div
      className={className}
      data-slot={INFINITE_CANVAS_SLOTS.windowControls}
      style={{
        alignItems: "center",
        display: "flex",
        flexShrink: 0,
        gap: "4px",
        ...style,
      }}
    >
      <button
        aria-label={window.isPinned ? "Unpin window" : "Pin window"}
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
        style={WINDOW_CONTROL_BUTTON_STYLE}
        type="button"
      >
        <PinIcon />
      </button>
      <button
        aria-label="Minimize window"
        data-action="minimize"
        data-slot={INFINITE_CANVAS_SLOTS.windowControl}
        onClick={(event) => {
          event.stopPropagation();
          // This button is about to unmount with its window.
          focusCommandSurfaceFrom(event.currentTarget);
          actions.minimizeWindow(window.id);
        }}
        onPointerDown={(event) => {
          event.stopPropagation();
        }}
        style={WINDOW_CONTROL_BUTTON_STYLE}
        type="button"
      >
        <MinimizeIcon />
      </button>
      <button
        aria-label={window.mode === "maximized" ? "Restore window" : "Maximize window"}
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
        style={WINDOW_CONTROL_BUTTON_STYLE}
        type="button"
      >
        <MaximizeIcon />
      </button>
      <button
        aria-label="Close window"
        data-action="close"
        data-slot={INFINITE_CANVAS_SLOTS.windowControl}
        onClick={(event) => {
          event.stopPropagation();
          // This button is about to unmount with its window.
          focusCommandSurfaceFrom(event.currentTarget);
          actions.closeWindow(window.id);
        }}
        onPointerDown={(event) => {
          event.stopPropagation();
        }}
        style={WINDOW_CONTROL_BUTTON_STYLE}
        type="button"
      >
        <CloseIcon />
      </button>
    </div>
  );
}

function InfiniteCanvasWindowFrameHeaderSlot({
  children,
  className,
  style,
}: InfiniteCanvasWindowFrameHeaderProps) {
  const { actions, chrome, window } = useInfiniteCanvasWindowFrameRuntimeContext();

  return (
    <header
      className={className}
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
          // Hold Alt while dragging to dock instead of overlap.
          dockIntent: event.altKey,
          pointerId: event.pointerId,
          point: getEventViewportPoint(event),
        });
      }}
      onPointerUp={(event) => {
        releasePointer(event.currentTarget, event.pointerId);
        actions.finishInteraction(event.pointerId);
      }}
      style={{
        alignItems: "center",
        borderBottomWidth: `${chrome.headerAccentHeight}px`,
        cursor: "grab",
        display: "flex",
        gap: "12px",
        height: `${chrome.headerHeight}px`,
        justifyContent: "space-between",
        left: 0,
        paddingLeft: "12px",
        paddingRight: "12px",
        pointerEvents: "auto",
        position: "absolute",
        right: 0,
        top: 0,
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
    textSelection,
    window,
  } = useInfiniteCanvasWindowFrameRuntimeContext();

  return (
    <section
      className={className}
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
        bottom: 0,
        left: 0,
        overflowY: definition.overflowY ?? "auto",
        pointerEvents: "auto",
        position: "absolute",
        right: 0,
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
  const { chrome } = useInfiniteCanvasWindowFrameRuntimeContext();

  return (
    <div
      className={className}
      data-slot={INFINITE_CANVAS_SLOTS.windowSurface}
      style={{
        borderWidth: `${chrome.borderWidth}px`,
        inset: 0,
        overflow: "hidden",
        pointerEvents: "auto",
        position: "absolute",
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
    position: "absolute",
    width: `${chrome.cornerSize}px`,
  } satisfies CSSProperties;

  return (
    <>
      <div
        aria-hidden="true"
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

function getEventViewportPoint(event: ReactPointerEvent<HTMLElement>): InfiniteCanvasPoint {
  const viewport = event.currentTarget.closest<HTMLElement>(
    "[data-infinite-canvas-viewport='true']",
  );

  return viewport === null
    ? getClientPoint(event)
    : getViewportPoint(viewport, getClientPoint(event));
}

/**
 * Hand keyboard control back to the canvas from any element inside it.
 *
 * Hotkeys only fire for events that land inside the command surface, so
 * whenever an element that currently holds DOM focus is about to leave the
 * document, something must claim focus first — otherwise it falls to `<body>`,
 * every shortcut silently stops working, and the user has no way to know why
 * except to click the canvas again.
 */
function focusCommandSurfaceFrom(element: HTMLElement) {
  const viewport = element.closest<HTMLElement>("[data-infinite-canvas-viewport='true']");

  focusInfiniteCanvasCommandSurface(getCommandSurfaceElement(viewport));
}

function focusEventCommandSurface(event: ReactPointerEvent<HTMLElement>) {
  focusCommandSurfaceFrom(event.currentTarget);
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
