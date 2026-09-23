"use client";
import { useRender } from "@base-ui/react/use-render";

import {
  Fragment,
  createContext,
  useContext,
  useRef,
  type CSSProperties,
  type FragmentInstance,
  type FocusEvent as ReactFocusEvent,
  type KeyboardEvent as ReactKeyboardEvent,
  type MouseEvent as ReactMouseEvent,
  type PointerEvent as ReactPointerEvent,
} from "react";

import { INFINITE_CANVAS_SLOTS } from "./data-attributes";
import type { InfiniteCanvasDetailLevel } from "./detail-level";
import { useInfiniteCanvasIcons } from "./icons";
import { useInfiniteCanvasStore } from "./react/store";
import { FocusGuard } from "./focus-guard";
import { focusInfiniteCanvasCommandSurfaceFrom } from "./keyboard";
import { InfiniteCanvasWindowBody } from "./rasterization-layer";
import { mergeProps } from "@base-ui/react/merge-props";
import { DRAG_THRESHOLD_PX } from "./constants";
import {
  capturePointer,
  clearNativeTextSelection,
  getClientPoint,
  getViewportPoint,
  isInteractiveTarget,
  isPrimaryButton,
  releasePointer,
} from "./input";
import type {
  InfiniteCanvasChromeMetrics,
  InfiniteCanvasDispatch,
  InfiniteCanvasPoint,
  InfiniteCanvasRect,
  InfiniteCanvasSelectionTarget,
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
import { isInfiniteCanvasWindowCapable } from "./window-capabilities";

/** Holds window data so slot subtrees do not rerender on camera updates. */
type InfiniteCanvasWindowFrameRuntimeContextValue<Kind extends string> = Readonly<{
  dispatch: InfiniteCanvasDispatch<Kind>;
  bodyPointerBehavior: InfiniteCanvasWindowBodyPointerBehavior;
  chrome: InfiniteCanvasChromeMetrics;
  definition: InfiniteCanvasWindowDefinition<Kind>;
  /** At `summary` detail, slots must omit unreadable labels and controls. */
  detailLevel: InfiniteCanvasDetailLevel;
  isActive: boolean;
  isSelected: boolean;
  rect: InfiniteCanvasRect;
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
  render,
  ref,
  ...consumerProps
}: InfiniteCanvasWindowFrameTitleProps) {
  const { detailLevel, window } = useInfiniteCanvasWindowFrameRuntimeContext();
  const props = {
    ...mergeProps<"div">(
      {
        style: {
          minWidth: 0,
          overflow: "hidden",
          textOverflow: "ellipsis",
          whiteSpace: "nowrap",
        },
      },
      consumerProps,
    ),
    "data-slot": INFINITE_CANVAS_SLOTS.windowTitle,
  };
  // Keep consumer content because the framework does not own it.
  const defaultTitle = detailLevel === "summary" ? null : window.title;
  const content = children === undefined ? defaultTitle : children;

  return useRender({ defaultTagName: "div", render, ref, props: { ...props, children: content } });
}

function InfiniteCanvasWindowFrameControlsSlot({
  children,
  render,
  ref,
  ...consumerProps
}: InfiniteCanvasWindowFrameControlsProps) {
  const { dispatch, detailLevel, window } = useInfiniteCanvasWindowFrameRuntimeContext();
  const {
    close: CloseIcon,
    maximize: MaximizeIcon,
    minimize: MinimizeIcon,
    pin: PinIcon,
  } = useInfiniteCanvasIcons();
  const canToggleMaximized =
    window.mode === "maximized" || isInfiniteCanvasWindowCapable(window, "maximizable");

  const props = {
    ...mergeProps<"div">(
      {
        style: {
          alignItems: "center",
          display: "flex",
          flexShrink: 0,
          gap: "4px",
        },
      },
      consumerProps,
    ),
    "data-slot": INFINITE_CANVAS_SLOTS.windowControls,
  };
  const content = (
    <>
      <button
        aria-label={window.isPinned ? "Unpin window" : "Pin window"}
        data-action="pin"
        data-active={window.isPinned ? "" : undefined}
        data-slot={INFINITE_CANVAS_SLOTS.windowControl}
        onClick={(event) => {
          event.stopPropagation();
          dispatch({ type: "window.togglePinned", windowId: window.id });
        }}
        onPointerDown={(event) => {
          event.stopPropagation();
        }}
        type="button"
      >
        <PinIcon />
      </button>
      <button
        aria-label="Minimize window"
        data-action="minimize"
        data-disabled={isInfiniteCanvasWindowCapable(window, "minimizable") ? undefined : ""}
        data-slot={INFINITE_CANVAS_SLOTS.windowControl}
        disabled={!isInfiniteCanvasWindowCapable(window, "minimizable")}
        onClick={(event) => {
          event.stopPropagation();
          // Restore focus before this button unmounts.
          focusInfiniteCanvasCommandSurfaceFrom(event.currentTarget);
          dispatch({ type: "window.minimize", windowId: window.id });
        }}
        onPointerDown={(event) => {
          event.stopPropagation();
        }}
        type="button"
      >
        <MinimizeIcon />
      </button>
      <button
        aria-label={window.mode === "maximized" ? "Restore window" : "Maximize window"}
        data-action={window.mode === "maximized" ? "restore" : "maximize"}
        data-disabled={canToggleMaximized ? undefined : ""}
        data-slot={INFINITE_CANVAS_SLOTS.windowControl}
        disabled={!canToggleMaximized}
        onClick={(event) => {
          event.stopPropagation();
          if (window.mode === "maximized") {
            dispatch({ type: "window.restore", windowId: window.id });
          } else {
            dispatch({ type: "window.maximize", windowId: window.id });
          }
        }}
        onPointerDown={(event) => {
          event.stopPropagation();
        }}
        type="button"
      >
        <MaximizeIcon />
      </button>
      <button
        aria-label="Close window"
        data-action="close"
        data-disabled={isInfiniteCanvasWindowCapable(window, "closable") ? undefined : ""}
        data-slot={INFINITE_CANVAS_SLOTS.windowControl}
        disabled={!isInfiniteCanvasWindowCapable(window, "closable")}
        onClick={(event) => {
          event.stopPropagation();
          // Restore focus before this button unmounts.
          focusInfiniteCanvasCommandSurfaceFrom(event.currentTarget);
          dispatch({ type: "window.close", windowId: window.id });
        }}
        onPointerDown={(event) => {
          event.stopPropagation();
        }}
        type="button"
      >
        <CloseIcon />
      </button>
    </>
  );

  // Keep the slot but omit default controls at summary detail.
  const rendered = children === undefined ? content : children;

  return useRender({
    defaultTagName: "div",
    render,
    ref,
    props: { ...props, children: detailLevel === "summary" ? null : rendered },
  });
}

function InfiniteCanvasWindowFrameHeaderSlot({
  children,
  render,
  ref,
  ...consumerProps
}: InfiniteCanvasWindowFrameHeaderProps) {
  const { dispatch, chrome, window } = useInfiniteCanvasWindowFrameRuntimeContext();
  const props = {
    ...mergeProps<"header">(
      {
        onPointerDown: (event: ReactPointerEvent<HTMLElement>) => {
          if (!isPrimaryButton(event)) {
            return;
          }

          event.preventDefault();
          event.stopPropagation();
          clearNativeTextSelection();
          focusEventCommandSurface(event);

          if (applyModifiedPointerSelection(dispatch, event, window.id)) {
            return;
          }

          capturePointer(event.currentTarget, event.pointerId);
          dispatch({
            type: "interaction.startMove",
            pointerId: event.pointerId,
            point: getEventViewportPoint(event),
            target: { type: "window", id: window.id },
          });
        },
        // Keep computed geometry inline because hit testing uses the same metrics.
        style: {
          alignItems: "center",
          borderBottomWidth: `max(${chrome.headerAccentHeight}px, var(--icx-chrome-stroke))`,
          cursor: "grab",
          display: "flex",
          gap: "12px",
          height: `${chrome.headerHeight}px`,
          left: 0,
          paddingLeft: "12px",
          paddingRight: "12px",
          pointerEvents: "auto",
          position: "absolute",
          right: 0,
          top: 0,
        },
      },
      consumerProps,
    ),
    "data-infinite-canvas-control": "true",
    "data-slot": INFINITE_CANVAS_SLOTS.windowHeader,
  };
  const content =
    children === undefined ? (
      <>
        <InfiniteCanvasWindowFrameTitleSlot />
        <InfiniteCanvasWindowFrameControlsSlot />
      </>
    ) : (
      children
    );

  return useRender({
    defaultTagName: "header",
    render,
    ref,
    props: { ...props, children: content },
  });
}

function InfiniteCanvasWindowFrameBodySlot({
  children,
  render,
  ref,
  ...consumerProps
}: InfiniteCanvasWindowFrameBodyProps) {
  const {
    dispatch,
    bodyPointerBehavior,
    chrome,
    definition,
    isActive,
    isSelected,
    rect,
    textSelection,
    window,
  } = useInfiniteCanvasWindowFrameRuntimeContext();
  const store = useInfiniteCanvasStore();
  // Start a move after the threshold and suppress the click that follows a drag.
  const pressRef = useRef<{ client: InfiniteCanvasPoint; viewport: InfiniteCanvasPoint } | null>(
    null,
  );
  const draggedRef = useRef(false);
  const contentRef = useRef<FragmentInstance>(null);
  const props = {
    ...mergeProps<"div">(
      {
        onFocus: (event: ReactFocusEvent<HTMLElement>) => {
          if (event.target === event.currentTarget) {
            contentRef.current?.focus({ preventScroll: true });
          }
        },
        onKeyDown: (event: ReactKeyboardEvent<HTMLElement>) => {
          // Escape returns focus to the canvas command surface.
          if (event.key === "Escape") {
            event.preventDefault();
            event.stopPropagation();
            if (store.state$.peek().interaction !== null) dispatch({ type: "desktop.cancel" });
            focusInfiniteCanvasCommandSurfaceFrom(event.currentTarget);

            return;
          }
        },
        onClickCapture: (event: ReactMouseEvent<HTMLElement>) => {
          if (draggedRef.current) {
            draggedRef.current = false;
            event.preventDefault();
            event.stopPropagation();
          }
        },
        onPointerCancel: () => {
          pressRef.current = null;
          draggedRef.current = false;
        },
        onLostPointerCapture: () => {
          pressRef.current = null;
        },
        onPointerDownCapture: (event: ReactPointerEvent<HTMLElement>) => {
          draggedRef.current = false;
          if (!isPrimaryButton(event)) {
            return;
          }

          if (isInteractiveTarget(event.target)) {
            pressRef.current = null;
            dispatch({ type: "window.focus", windowId: window.id });
            return;
          }

          if (textSelection === "none") {
            clearNativeTextSelection();
          }

          if (event.shiftKey || event.metaKey || event.ctrlKey) {
            event.preventDefault();
          }

          if (applyModifiedPointerSelection(dispatch, event, window.id)) {
            event.stopPropagation();
          } else if (!isSelected) {
            dispatch({ type: "window.focus", windowId: window.id });
          }

          pressRef.current =
            bodyPointerBehavior === "move"
              ? { client: getClientPoint(event), viewport: getEventViewportPoint(event) }
              : null;
          if (pressRef.current !== null) capturePointer(event.currentTarget, event.pointerId);
        },
        onPointerMove: (event: ReactPointerEvent<HTMLElement>) => {
          if (draggedRef.current) {
            event.preventDefault();
            return;
          }
          const press = pressRef.current;

          if (
            press === null ||
            Math.hypot(event.clientX - press.client.x, event.clientY - press.client.y) <
              (definition.bodyDragThresholdPx ?? DRAG_THRESHOLD_PX)
          ) {
            return;
          }

          pressRef.current = null;
          draggedRef.current = true;
          event.preventDefault();
          clearNativeTextSelection();
          // The viewport steps and finishes the move by pointer id from here on.
          dispatch({
            type: "interaction.startMove",
            pointerId: event.pointerId,
            point: press.viewport,
            target: { type: "window", id: window.id },
          });
        },
        onPointerUp: (event: ReactPointerEvent<HTMLElement>) => {
          pressRef.current = null;
          releasePointer(event.currentTarget, event.pointerId);
        },
        style: {
          bottom: 0,
          cursor: bodyPointerBehavior === "move" ? "grab" : undefined,
          left: 0,
          overflowY: definition.overflowY ?? "auto",
          pointerEvents: "auto",
          position: "absolute",
          right: 0,
          top: `${chrome.headerHeight}px`,
          userSelect: textSelection === "native" ? undefined : "none",
        },
        // The body receives programmatic focus but stays outside the tab order.
        tabIndex: -1,
      },
      consumerProps,
    ),
    "data-infinite-canvas-body": "true",
    "data-infinite-canvas-body-pan": bodyPointerBehavior === "canvas-pan" ? "true" : undefined,
    "data-infinite-canvas-native-scroll":
      definition.wheelBehavior === "native-scroll" ? "true" : undefined,
    "data-infinite-canvas-native-text-selection": textSelection === "native" ? "true" : undefined,
    "data-slot": INFINITE_CANVAS_SLOTS.windowBody,
  };
  const content =
    children === undefined ? (
      <InfiniteCanvasWindowBody
        key={window.kind}
        dispatch={dispatch}
        chrome={chrome}
        definition={definition}
        isActive={isActive}
        isSelected={isSelected}
        rect={rect}
        textSelection={textSelection}
        window={window}
      />
    ) : (
      children
    );

  const focusableContent = (
    <>
      <FocusGuard
        onFocus={(event) => {
          contentRef.current?.focusLast({ preventScroll: true });
          if (document.activeElement === event.currentTarget)
            focusInfiniteCanvasCommandSurfaceFrom(event.currentTarget);
        }}
      />
      <Fragment ref={contentRef}>{content}</Fragment>
      <FocusGuard
        onFocus={(event) => {
          contentRef.current?.focus({ preventScroll: true });
          if (document.activeElement === event.currentTarget)
            focusInfiniteCanvasCommandSurfaceFrom(event.currentTarget);
        }}
      />
    </>
  );

  return useRender({
    defaultTagName: "section",
    render,
    ref,
    props: { ...props, children: focusableContent },
  });
}

function InfiniteCanvasWindowFrameActiveCornersSlot({
  children,
  render,
  ref,
  ...consumerProps
}: InfiniteCanvasWindowFrameActiveCornersProps) {
  const { chrome, isActive } = useInfiniteCanvasWindowFrameRuntimeContext();
  const props = {
    ...mergeProps<"div">(
      {
        "aria-hidden": "true",
      },
      consumerProps,
    ),
    "data-slot": INFINITE_CANVAS_SLOTS.windowCorners,
  };
  const content = children === undefined ? <ActiveWindowCorners chrome={chrome} /> : children;

  return useRender({
    defaultTagName: "div",
    render,
    ref,
    enabled: isActive,
    props: { ...props, children: content },
  });
}

function InfiniteCanvasWindowFrameSurfaceSlot({
  children,
  render,
  ref,
  ...consumerProps
}: InfiniteCanvasWindowFrameSurfaceProps) {
  const props = {
    ...mergeProps<"div">(
      {
        style: {
          inset: 0,
          overflow: "hidden",
          pointerEvents: "auto",
          position: "absolute",
        },
      },
      consumerProps,
    ),
    "data-slot": INFINITE_CANVAS_SLOTS.windowSurface,
  };

  return useRender({ defaultTagName: "div", render, ref, props: { ...props, children } });
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

function focusEventCommandSurface(event: ReactPointerEvent<HTMLElement>) {
  focusInfiniteCanvasCommandSurfaceFrom(event.currentTarget);
}

function applyModifiedPointerSelection<Kind extends string>(
  dispatch: InfiniteCanvasDispatch<Kind>,
  event: ReactPointerEvent<HTMLElement>,
  windowId: string,
) {
  if (event.shiftKey) {
    event.preventDefault();
    dispatch({
      type: "selection.add",
      targets: [{ type: "window" as const, id: windowId }],
    });

    return true;
  }

  if (event.metaKey || event.ctrlKey) {
    event.preventDefault();
    dispatch({ type: "selection.toggle", targets: [{ type: "window" as const, id: windowId }] });

    return true;
  }

  return false;
}

function applyModifiedPointerTargetSelection<Kind extends string>(
  dispatch: InfiniteCanvasDispatch<Kind>,
  event: Pick<ReactMouseEvent, "shiftKey" | "metaKey" | "ctrlKey">,
  target: InfiniteCanvasSelectionTarget,
) {
  if (event.shiftKey) {
    dispatch({ targets: [target], type: "selection.add" });
    return;
  }
  if (event.metaKey || event.ctrlKey) {
    dispatch({ targets: [target], type: "selection.toggle" });
    return;
  }
  dispatch({ targets: [target], type: "selection.replace" });
}

export {
  applyModifiedPointerTargetSelection,
  DEFAULT_INFINITE_CANVAS_WINDOW_FRAME_SLOTS,
  InfiniteCanvasWindowFrameRuntimeContext,
  getEventViewportPoint,
};
export type { InfiniteCanvasWindowFrameRuntimeContextValue };
