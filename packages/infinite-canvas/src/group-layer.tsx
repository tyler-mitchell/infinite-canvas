"use client";

import {
  useMemo,
  useRef,
  useState,
  type CSSProperties,
  type PointerEvent as ReactPointerEvent,
} from "react";

import { INFINITE_CANVAS_SLOTS } from "./data-attributes";
import { getEventViewportPoint } from "./frame-slots";
import { projectWorldRectToScreen } from "./geometry";
import {
  DEFAULT_INFINITE_CANVAS_GROUP_METRICS,
  getInfiniteCanvasGroupLayout,
  getInfiniteCanvasGroupMinimumSize,
  type InfiniteCanvasGroupMetrics,
} from "./group-layout";
import { findInfiniteCanvasGroupNode, isInfiniteCanvasGroupContainer } from "./group-tree";
import { capturePointer, isPrimaryButton, releasePointer } from "./runtime";
import { useInfiniteCanvasActions, useInfiniteCanvasSelector } from "./store";
import type {
  InfiniteCanvasCamera,
  InfiniteCanvasCommands,
  InfiniteCanvasGroup,
  InfiniteCanvasRect,
  InfiniteCanvasResizeHandle,
  InfiniteCanvasViewport,
} from "./types";

/**
 * Group chrome: the shell, the seams between split panes, tab strips, and
 * accordion headers.
 *
 * This is one layer beneath the window layer, and it never needs to fight it for
 * stacking. The solver gives a tab strip and a gutter each their own rect and
 * places member windows in what is left over, so group chrome and window frames
 * are disjoint by construction — no chrome is ever underneath a window it should
 * be drawn over.
 *
 * Nothing here reads the DOM. Every rect comes from the same solver the reducer
 * used to place the windows, so the chrome cannot drift out of alignment with
 * the panes it separates.
 */

const SHELL_RESIZE_HANDLE_SIZE_CSS_VARIABLE = "--icx-resize-handle-size";
const SHELL_RESIZE_HANDLE_EXTENT = `var(${SHELL_RESIZE_HANDLE_SIZE_CSS_VARIABLE})`;
const SHELL_RESIZE_HANDLE_OUTSET = `calc(${SHELL_RESIZE_HANDLE_EXTENT} * -1)`;

type InfiniteCanvasShellResizeHandleDescriptor = Readonly<{
  cursor: CSSProperties["cursor"];
  handle: InfiniteCanvasResizeHandle;
  style: CSSProperties;
}>;

/** React's `CSSProperties` has no slot for custom properties. Widen just this one. */
type InfiniteCanvasGroupShellStyle = CSSProperties &
  Readonly<Record<typeof SHELL_RESIZE_HANDLE_SIZE_CSS_VARIABLE, string>>;

/**
 * A shell's handles sit **entirely outside** its rect, unlike a window frame's, which
 * straddle the edge and hang half their extent out.
 *
 * Everything inside the shell is member-window DOM, and the window plane draws above the
 * group layer. An inward half would therefore be buried under a pane and never receive a
 * pointerdown — which is precisely the bug that made a grouped window's own handles eat
 * the gutter between two panes. Outside the shell there is nothing to be buried under.
 *
 * Corners come last so they paint over the edges they overlap and win the hit test.
 */
const SHELL_RESIZE_HANDLE_DESCRIPTORS: readonly InfiniteCanvasShellResizeHandleDescriptor[] = [
  {
    cursor: "ns-resize",
    handle: "north",
    style: {
      height: SHELL_RESIZE_HANDLE_EXTENT,
      left: 0,
      right: 0,
      top: SHELL_RESIZE_HANDLE_OUTSET,
    },
  },
  {
    cursor: "ns-resize",
    handle: "south",
    style: {
      bottom: SHELL_RESIZE_HANDLE_OUTSET,
      height: SHELL_RESIZE_HANDLE_EXTENT,
      left: 0,
      right: 0,
    },
  },
  {
    cursor: "ew-resize",
    handle: "west",
    style: {
      bottom: 0,
      left: SHELL_RESIZE_HANDLE_OUTSET,
      top: 0,
      width: SHELL_RESIZE_HANDLE_EXTENT,
    },
  },
  {
    cursor: "ew-resize",
    handle: "east",
    style: {
      bottom: 0,
      right: SHELL_RESIZE_HANDLE_OUTSET,
      top: 0,
      width: SHELL_RESIZE_HANDLE_EXTENT,
    },
  },
  {
    cursor: "nwse-resize",
    handle: "north-west",
    style: {
      height: SHELL_RESIZE_HANDLE_EXTENT,
      left: SHELL_RESIZE_HANDLE_OUTSET,
      top: SHELL_RESIZE_HANDLE_OUTSET,
      width: SHELL_RESIZE_HANDLE_EXTENT,
    },
  },
  {
    cursor: "nesw-resize",
    handle: "north-east",
    style: {
      height: SHELL_RESIZE_HANDLE_EXTENT,
      right: SHELL_RESIZE_HANDLE_OUTSET,
      top: SHELL_RESIZE_HANDLE_OUTSET,
      width: SHELL_RESIZE_HANDLE_EXTENT,
    },
  },
  {
    cursor: "nesw-resize",
    handle: "south-west",
    style: {
      bottom: SHELL_RESIZE_HANDLE_OUTSET,
      height: SHELL_RESIZE_HANDLE_EXTENT,
      left: SHELL_RESIZE_HANDLE_OUTSET,
      width: SHELL_RESIZE_HANDLE_EXTENT,
    },
  },
  {
    cursor: "nwse-resize",
    handle: "south-east",
    style: {
      bottom: SHELL_RESIZE_HANDLE_OUTSET,
      height: SHELL_RESIZE_HANDLE_EXTENT,
      right: SHELL_RESIZE_HANDLE_OUTSET,
      width: SHELL_RESIZE_HANDLE_EXTENT,
    },
  },
];

/** World rect → the absolutely-positioned screen box that draws it. */
function getWorldRectStyle(
  camera: InfiniteCanvasCamera,
  viewport: InfiniteCanvasViewport,
  rect: InfiniteCanvasRect,
  devicePixelRatio: number,
): CSSProperties {
  const { screenTransform } = projectWorldRectToScreen(camera, viewport, rect, devicePixelRatio);

  return {
    height: `${screenTransform.height}px`,
    left: "0px",
    position: "absolute",
    top: "0px",
    transform: `translate(${screenTransform.x}px, ${screenTransform.y}px) scale(${screenTransform.scale})`,
    transformOrigin: "top left",
    width: `${screenTransform.width}px`,
  };
}

/**
 * A tab travels a few pixels before it means anything. Below the threshold the
 * gesture is a click that activates the tab; past it, the window is torn out of
 * the tree and the drag becomes an ordinary window move — the same
 * `interaction.startMove` a floating window's header would have started.
 *
 * Tear-out hands the window no rect. It keeps the one the solver already gave it,
 * which for a hidden tab is the size it would have been revealed at, so nothing
 * jumps and nothing swells to fill the shell.
 *
 * Only a window can float. A tab whose child is a nested container has nowhere to
 * go, so it stays put and remains clickable.
 */
const TAB_TEAR_OUT_THRESHOLD_PX = 6;

function useInfiniteCanvasTabTearOut(
  actions: InfiniteCanvasCommands,
  group: InfiniteCanvasGroup,
  childId: string,
) {
  const originRef = useRef<{ x: number; y: number } | null>(null);
  const node = findInfiniteCanvasGroupNode(group.tree, childId);
  const canTearOut = node !== null && !isInfiniteCanvasGroupContainer(node);

  return {
    onPointerDown: (event: ReactPointerEvent<HTMLElement>) => {
      if (!isPrimaryButton(event) || !canTearOut) {
        return;
      }

      originRef.current = { x: event.clientX, y: event.clientY };
      capturePointer(event.currentTarget, event.pointerId);
    },
    onPointerMove: (event: ReactPointerEvent<HTMLElement>) => {
      const origin = originRef.current;

      if (origin === null) {
        return;
      }

      const travel = Math.hypot(event.clientX - origin.x, event.clientY - origin.y);

      if (travel < TAB_TEAR_OUT_THRESHOLD_PX) {
        return;
      }

      originRef.current = null;
      releasePointer(event.currentTarget, event.pointerId);
      actions.undockWindow({ windowId: childId });
      actions.startMove({
        pointerId: event.pointerId,
        point: getEventViewportPoint(event),
        windowId: childId,
      });
    },
    onPointerUp: (event: ReactPointerEvent<HTMLElement>) => {
      originRef.current = null;
      releasePointer(event.currentTarget, event.pointerId);
    },
  };
}

function InfiniteCanvasGroupShell({
  camera,
  devicePixelRatio,
  group,
  metrics,
  resizeHandleSize,
  viewport,
}: Readonly<{
  camera: InfiniteCanvasCamera;
  devicePixelRatio: number;
  group: InfiniteCanvasGroup;
  metrics: InfiniteCanvasGroupMetrics;
  resizeHandleSize: number;
  viewport: InfiniteCanvasViewport;
}>) {
  const actions = useInfiniteCanvasActions();
  const layout = useMemo(
    () => getInfiniteCanvasGroupLayout(group.tree, group.rect, metrics),
    [group.rect, group.tree, metrics],
  );
  const { screenTransform } = projectWorldRectToScreen(
    camera,
    viewport,
    group.rect,
    devicePixelRatio,
  );
  const shellStyle: InfiniteCanvasGroupShellStyle = {
    ...getWorldRectStyle(camera, viewport, group.rect, devicePixelRatio),
    // The shell's box is in world units and `scale` maps it to the screen, so the handles
    // need a world extent that shrinks as zoom grows. Publishing it as a custom property
    // on a style that is rewritten every camera tick anyway keeps the handle elements
    // themselves referentially stable.
    [SHELL_RESIZE_HANDLE_SIZE_CSS_VARIABLE]: `${
      screenTransform.scale <= 0 ? resizeHandleSize : resizeHandleSize / screenTransform.scale
    }px`,
    pointerEvents: "none",
    zIndex: group.zIndex,
  };

  return (
    <div
      aria-label={group.title}
      aria-roledescription="window group"
      data-infinite-canvas-group-id={group.id}
      data-slot={INFINITE_CANVAS_SLOTS.groupShell}
      role="group"
      style={shellStyle}
    >
      {SHELL_RESIZE_HANDLE_DESCRIPTORS.map((descriptor) => (
        <div
          data-handle={descriptor.handle}
          data-infinite-canvas-control="true"
          data-slot={INFINITE_CANVAS_SLOTS.groupResizeHandle}
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
            capturePointer(event.currentTarget, event.pointerId);
            actions.startGroupResize({
              groupId: group.id,
              handle: descriptor.handle,
              // Measured with the metrics this shell was laid out with, not the defaults
              // the reducer would otherwise have to assume.
              minSize: getInfiniteCanvasGroupMinimumSize(group.tree, metrics),
              point: getEventViewportPoint(event),
              pointerId: event.pointerId,
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
            ...descriptor.style,
            cursor: descriptor.cursor,
            pointerEvents: "auto",
            position: "absolute",
          }}
        />
      ))}
      {layout.gutters.map((gutter) => (
        <div
          aria-hidden="true"
          data-axis={gutter.axis}
          data-infinite-canvas-control="true"
          data-slot={INFINITE_CANVAS_SLOTS.groupGutter}
          key={`${gutter.containerId}:${gutter.afterChildId}`}
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
            capturePointer(event.currentTarget, event.pointerId);
            actions.startGroupGutterDrag({
              afterChildId: gutter.afterChildId,
              availableExtent: gutter.availableExtent,
              axis: gutter.axis,
              beforeChildId: gutter.beforeChildId,
              containerId: gutter.containerId,
              groupId: group.id,
              point: getEventViewportPoint(event),
              pointerId: event.pointerId,
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
            ...getLocalRectStyle(gutter.rect, group.rect),
            cursor: gutter.axis === "horizontal" ? "ew-resize" : "ns-resize",
            pointerEvents: "auto",
          }}
        />
      ))}
      {layout.tabStrips.map((strip) => (
        <InfiniteCanvasGroupTabStrip
          activeChildId={strip.activeChildId}
          childIds={strip.childIds}
          containerId={strip.containerId}
          group={group}
          key={strip.containerId}
          style={getLocalRectStyle(strip.rect, group.rect)}
        />
      ))}
      {layout.accordionHeaders.map((header) => (
        <button
          aria-expanded={header.isExpanded}
          data-active={header.isExpanded ? "" : undefined}
          data-slot={INFINITE_CANVAS_SLOTS.groupAccordionHeader}
          key={header.childId}
          onClick={() => {
            actions.setGroupActiveChild({
              childId: header.childId,
              containerId: header.containerId,
              groupId: group.id,
            });
          }}
          style={{
            ...getLocalRectStyle(header.rect, group.rect),
            pointerEvents: "auto",
          }}
          type="button"
        >
          {getTabLabel(group, header.childId)}
        </button>
      ))}
    </div>
  );
}

/** Which tab an Arrow / Home / End keypress moves focus to, or `null` to ignore the key. */
function getNextTabStopIndex(key: string, index: number, count: number): number | null {
  switch (key) {
    case "ArrowLeft": {
      return (index - 1 + count) % count;
    }
    case "ArrowRight": {
      return (index + 1) % count;
    }
    case "End": {
      return count - 1;
    }
    case "Home": {
      return 0;
    }
    default: {
      return null;
    }
  }
}

/**
 * A tab strip is one tab stop, not one per tab.
 *
 * Every tab used to be a natively focusable `<button>`, so Tab walked all of them:
 * three groups of four tabs put twelve stops between the user and anything else on
 * the page. The ARIA Tabs pattern instead puts a single tab stop on the tablist and
 * moves between tabs with Arrow / Home / End — which is the roving `tabIndex` below.
 *
 * **Manual activation**: an arrow key moves focus without switching tabs; Enter or
 * Space activates, through the same `onClick` the pointer uses. APG allows either,
 * and recommends manual whenever activation reveals expensive content. Activating a
 * tab here mounts a window body, so arrowing across four tabs with automatic
 * activation would mount and discard three of them.
 *
 * The roving stop follows focus, so tabbing away and back returns you to the tab you
 * were last on rather than to the selected one. It falls back to the active tab when
 * the tab it was on has left the strip — a torn-out tab cannot keep the tab stop.
 */
function InfiniteCanvasGroupTabStrip({
  activeChildId,
  childIds,
  containerId,
  group,
  style,
}: Readonly<{
  activeChildId: string;
  childIds: readonly string[];
  containerId: string;
  group: InfiniteCanvasGroup;
  style: CSSProperties;
}>) {
  const stripRef = useRef<HTMLDivElement>(null);
  const [focusedChildId, setFocusedChildId] = useState<string | null>(null);
  const tabStopChildId =
    focusedChildId !== null && childIds.includes(focusedChildId) ? focusedChildId : activeChildId;

  return (
    <div
      aria-orientation="horizontal"
      data-slot={INFINITE_CANVAS_SLOTS.groupTabStrip}
      onKeyDown={(event) => {
        const index = childIds.indexOf(tabStopChildId);
        const nextIndex =
          index === -1 ? null : getNextTabStopIndex(event.key, index, childIds.length);

        if (nextIndex === null) {
          return;
        }

        // Home/End and the arrows would otherwise scroll the nearest scroll container.
        event.preventDefault();
        setFocusedChildId(childIds[nextIndex] ?? null);
        // Tabs are direct children in `childIds` order, so the index addresses the
        // button without escaping a consumer-supplied window id into a selector.
        //
        // `preventScroll` because the strip sits inside the shell's `transform:
        // scale(zoom)`: a plain `focus()` scrolls ancestors to reveal the target, which
        // would drag the canvas out from under the user to chase a tab already in view.
        stripRef.current
          ?.querySelectorAll<HTMLButtonElement>(
            `:scope > [data-slot="${INFINITE_CANVAS_SLOTS.groupTab}"]`,
          )
          [nextIndex]?.focus({ preventScroll: true });
      }}
      ref={stripRef}
      role="tablist"
      style={{ ...style, alignItems: "stretch", display: "flex", pointerEvents: "auto" }}
    >
      {childIds.map((childId) => (
        <InfiniteCanvasGroupTab
          childId={childId}
          containerId={containerId}
          group={group}
          isActive={childId === activeChildId}
          isTabStop={childId === tabStopChildId}
          key={childId}
          onFocus={setFocusedChildId}
        />
      ))}
    </div>
  );
}

function InfiniteCanvasGroupTab({
  childId,
  containerId,
  group,
  isActive,
  isTabStop,
  onFocus,
}: Readonly<{
  childId: string;
  containerId: string;
  group: InfiniteCanvasGroup;
  isActive: boolean;
  isTabStop: boolean;
  onFocus: (childId: string) => void;
}>) {
  const actions = useInfiniteCanvasActions();
  const tearOut = useInfiniteCanvasTabTearOut(actions, group, childId);

  return (
    <button
      aria-selected={isActive}
      data-active={isActive ? "" : undefined}
      data-infinite-canvas-control="true"
      data-slot={INFINITE_CANVAS_SLOTS.groupTab}
      onClick={() => {
        actions.setGroupActiveChild({ childId, containerId, groupId: group.id });
      }}
      onFocus={() => {
        onFocus(childId);
      }}
      onPointerDown={(event) => {
        event.stopPropagation();
        tearOut.onPointerDown(event);
      }}
      onPointerMove={tearOut.onPointerMove}
      onPointerUp={tearOut.onPointerUp}
      role="tab"
      tabIndex={isTabStop ? 0 : -1}
      type="button"
    >
      {getTabLabel(group, childId)}
    </button>
  );
}

/** Chrome rects are solved in world space; the shell already carries that offset. */
function getLocalRectStyle(rect: InfiniteCanvasRect, shell: InfiniteCanvasRect): CSSProperties {
  return {
    height: `${rect.height}px`,
    left: `${rect.x - shell.x}px`,
    position: "absolute",
    top: `${rect.y - shell.y}px`,
    width: `${rect.width}px`,
  };
}

/**
 * A tab names a window when it is one, and a container otherwise — a split or
 * accordion nested inside a tab has no title of its own, so it borrows the
 * group's. Consumers who want richer labels replace this layer wholesale.
 */
function getTabLabel(group: InfiniteCanvasGroup, childId: string): string {
  const node = findInfiniteCanvasGroupNode(group.tree, childId);

  return node !== null && node.kind === "window" ? node.id : group.title;
}

function InfiniteCanvasGroupLayer({
  devicePixelRatio,
  metrics = DEFAULT_INFINITE_CANVAS_GROUP_METRICS,
  resizeHandleSize,
  zIndex,
}: Readonly<{
  devicePixelRatio: number;
  metrics?: InfiniteCanvasGroupMetrics;
  resizeHandleSize: number;
  zIndex: number;
}>) {
  const camera = useInfiniteCanvasSelector((state) => state.camera);
  const viewport = useInfiniteCanvasSelector((state) => state.viewport);
  const groups = useInfiniteCanvasSelector((state) => state.groups);

  if (groups.length === 0) {
    return null;
  }

  return (
    <div style={{ inset: 0, pointerEvents: "none", position: "absolute", zIndex }}>
      {groups.map((group) => (
        <InfiniteCanvasGroupShell
          camera={camera}
          devicePixelRatio={devicePixelRatio}
          group={group}
          key={group.id}
          metrics={metrics}
          resizeHandleSize={resizeHandleSize}
          viewport={viewport}
        />
      ))}
    </div>
  );
}

export { InfiniteCanvasGroupLayer };
