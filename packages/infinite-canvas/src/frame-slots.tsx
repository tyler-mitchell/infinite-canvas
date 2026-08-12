"use client";

import {
  createContext,
  useContext,
  type CSSProperties,
  type KeyboardEvent as ReactKeyboardEvent,
  type PointerEvent as ReactPointerEvent,
} from "react";

import { INFINITE_CANVAS_SLOTS } from "./data-attributes";
import { useInfiniteCanvasIcons } from "./icons";
import { trapInfiniteCanvasTabKey } from "./focus-trap";
import { focusInfiniteCanvasCommandSurface } from "./keyboard";
import { InfiniteCanvasWindowBody } from "./rasterization-layer";
import { mergeInfiniteCanvasSlotProps } from "./slot";
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
import { isInfiniteCanvasWindowCapable } from "./window-capabilities";

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
  render,
  ...consumerProps
}: InfiniteCanvasWindowFrameTitleProps) {
  const { window } = useInfiniteCanvasWindowFrameRuntimeContext();
  const props = mergeInfiniteCanvasSlotProps(
    {
      "data-slot": INFINITE_CANVAS_SLOTS.windowTitle,
      style: {
        minWidth: 0,
        overflow: "hidden",
        textOverflow: "ellipsis",
        whiteSpace: "nowrap",
      },
    },
    consumerProps,
  );
  const content = children === undefined ? window.title : children;

  return render === undefined ? (
    <div {...props}>{content}</div>
  ) : (
    render(props, { children: content })
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
  render,
  ...consumerProps
}: InfiniteCanvasWindowFrameControlsProps) {
  const { actions, window } = useInfiniteCanvasWindowFrameRuntimeContext();
  const {
    close: CloseIcon,
    maximize: MaximizeIcon,
    minimize: MinimizeIcon,
    pin: PinIcon,
  } = useInfiniteCanvasIcons();

  const props = mergeInfiniteCanvasSlotProps(
    {
      "data-slot": INFINITE_CANVAS_SLOTS.windowControls,
      style: {
        alignItems: "center",
        display: "flex",
        flexShrink: 0,
        gap: "4px",
      },
    },
    consumerProps,
  );
  const content = (
    <>
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
        data-disabled={isInfiniteCanvasWindowCapable(window, "minimizable") ? undefined : ""}
        data-slot={INFINITE_CANVAS_SLOTS.windowControl}
        disabled={!isInfiniteCanvasWindowCapable(window, "minimizable")}
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
        data-disabled={isInfiniteCanvasWindowCapable(window, "maximizable") ? undefined : ""}
        data-slot={INFINITE_CANVAS_SLOTS.windowControl}
        disabled={!isInfiniteCanvasWindowCapable(window, "maximizable")}
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
        data-disabled={isInfiniteCanvasWindowCapable(window, "closable") ? undefined : ""}
        data-slot={INFINITE_CANVAS_SLOTS.windowControl}
        disabled={!isInfiniteCanvasWindowCapable(window, "closable")}
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
    </>
  );

  return render === undefined ? (
    <div {...props}>{content}</div>
  ) : (
    render(props, { children: content })
  );
}

function InfiniteCanvasWindowFrameHeaderSlot({
  children,
  render,
  ...consumerProps
}: InfiniteCanvasWindowFrameHeaderProps) {
  const { actions, chrome, window } = useInfiniteCanvasWindowFrameRuntimeContext();
  const props = mergeInfiniteCanvasSlotProps(
    {
      "data-infinite-canvas-control": "true",
      "data-slot": INFINITE_CANVAS_SLOTS.windowHeader,
      onLostPointerCapture: (event: ReactPointerEvent<HTMLElement>) => {
        actions.finishInteraction(event.pointerId);
      },
      onPointerCancel: (event: ReactPointerEvent<HTMLElement>) => {
        actions.finishInteraction(event.pointerId);
      },
      onPointerDown: (event: ReactPointerEvent<HTMLElement>) => {
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
      },
      onPointerUp: (event: ReactPointerEvent<HTMLElement>) => {
        releasePointer(event.currentTarget, event.pointerId);
        actions.finishInteraction(event.pointerId);
      },
      style: {
        alignItems: "center",
        borderBottomWidth: `max(${chrome.headerAccentHeight}px, var(--icx-chrome-stroke))`,
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
      },
    },
    consumerProps,
  );
  const content =
    children === undefined ? (
      <>
        <InfiniteCanvasWindowFrameTitleSlot />
        <InfiniteCanvasWindowFrameControlsSlot />
      </>
    ) : (
      children
    );

  return render === undefined ? (
    <header {...props}>{content}</header>
  ) : (
    render(props, { children: content })
  );
}

function InfiniteCanvasWindowFrameBodySlot({
  children,
  render,
  ...consumerProps
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
  const props = mergeInfiniteCanvasSlotProps(
    {
      "data-infinite-canvas-body": "true",
      "data-infinite-canvas-body-pan": bodyPointerBehavior === "canvas-pan" ? "true" : undefined,
      "data-infinite-canvas-native-scroll":
        definition.wheelBehavior === "native-scroll" ? "true" : undefined,
      "data-infinite-canvas-native-text-selection": textSelection === "native" ? "true" : undefined,
      "data-slot": INFINITE_CANVAS_SLOTS.windowBody,
      onKeyDown: (event: ReactKeyboardEvent<HTMLElement>) => {
        // Focus containment (FR-9). A window body is a focus region the way an OS window is:
        // Tab cycles what is inside it and stops at its edges, and Escape hands you back to
        // the desktop. Without the Escape half a trap is a cage — the user would be inside a
        // window with no keyboard way out, and every canvas hotkey would stay dead because the
        // command surface never regains focus.
        if (event.key === "Escape") {
          event.preventDefault();
          event.stopPropagation();
          focusCommandSurfaceFrom(event.currentTarget);

          return;
        }

        if (event.key === "Tab" && trapInfiniteCanvasTabKey(event, event.currentTarget)) {
          event.preventDefault();
        }
      },
      onPointerDownCapture: (event: ReactPointerEvent<HTMLElement>) => {
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
      },
      style: {
        bottom: 0,
        left: 0,
        overflowY: definition.overflowY ?? "auto",
        pointerEvents: "auto",
        position: "absolute",
        right: 0,
        top: `${chrome.headerHeight}px`,
        userSelect: textSelection === "native" ? undefined : "none",
      },
      // Programmatically focusable, never a Tab stop. Entering a window is deliberate — the
      // desktop's Tab order must not walk into window contents — but a body with no controls
      // of its own still has to be enterable, or `Tab` from the command surface would look
      // broken rather than empty.
      tabIndex: -1,
    },
    consumerProps,
  );
  const content =
    children === undefined ? (
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
    );

  return render === undefined ? (
    <section {...props}>{content}</section>
  ) : (
    render(props, { children: content })
  );
}

function InfiniteCanvasWindowFrameActiveCornersSlot({
  render,
  ...consumerProps
}: InfiniteCanvasWindowFrameActiveCornersProps) {
  const { chrome, isActive } = useInfiniteCanvasWindowFrameRuntimeContext();
  const props = mergeInfiniteCanvasSlotProps(
    {
      "aria-hidden": "true",
      "data-slot": INFINITE_CANVAS_SLOTS.windowCorners,
    },
    consumerProps,
  );
  const content = <ActiveWindowCorners chrome={chrome} />;

  if (!isActive) {
    return null;
  }

  return render === undefined ? (
    <div {...props}>{content}</div>
  ) : (
    render(props, { children: content })
  );
}

function InfiniteCanvasWindowFrameSurfaceSlot({
  children,
  render,
  ...consumerProps
}: InfiniteCanvasWindowFrameSurfaceProps) {
  const props = mergeInfiniteCanvasSlotProps(
    {
      "data-slot": INFINITE_CANVAS_SLOTS.windowSurface,
      style: {
        // Never thinner than one screen pixel, however far the canvas is zoomed
        // out. The frame publishes the widened world-unit value; see window-frame.
        borderWidth: "var(--icx-chrome-stroke)",
        inset: 0,
        overflow: "hidden",
        pointerEvents: "auto",
        position: "absolute",
      },
    },
    consumerProps,
  );

  return render === undefined ? <div {...props}>{children}</div> : render(props, { children });
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
