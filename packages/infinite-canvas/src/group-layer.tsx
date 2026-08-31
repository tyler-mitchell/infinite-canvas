"use client";

import {
  useMemo,
  useRef,
  useState,
  type CSSProperties,
  type PointerEvent as ReactPointerEvent,
} from "react";

import { INFINITE_CANVAS_SLOTS, getInfiniteCanvasWindowFrameElementId } from "./data-attributes";
import { getEventViewportPoint } from "./frame-slots";
import { getInfiniteCanvasWindowDetailLevel, type InfiniteCanvasDetailLevel } from "./detail-level";
import { isWorldRectCulled, projectWorldRectToScreen } from "./geometry";
import {
  getInfiniteCanvasGroupLayout,
  getInfiniteCanvasGroupMinimumSize,
  type InfiniteCanvasGroupAccordionHeader,
} from "./group-layout";
import {
  findInfiniteCanvasGroupNode,
  getInfiniteCanvasGroupWindowIds,
  isInfiniteCanvasGroupContainer,
} from "./group-tree";
import {
  getInfiniteCanvasGroupTabLabel,
  getInfiniteCanvasGroupTitle,
  type InfiniteCanvasGroupTabLabel,
} from "./group-state";
import { getInfiniteCanvasWorkspaceWindowIds } from "./workspace-membership";
import { capturePointer, isPrimaryButton, releasePointer } from "./runtime";
import { useInfiniteCanvasActions, useInfiniteCanvasSelector } from "./store";
import { getNextInfiniteCanvasRovingIndex } from "./window-focus";
import type {
  InfiniteCanvasCamera,
  InfiniteCanvasCommands,
  InfiniteCanvasGroup,
  InfiniteCanvasGroupMetrics,
  InfiniteCanvasRect,
  InfiniteCanvasResizeHandle,
  InfiniteCanvasWindow,
  InfiniteCanvasViewport,
  InfiniteCanvasViewportInsets,
} from "./types";

/** Solves group chrome from model geometry. Only tab hit tests read the DOM. */

const SHELL_RESIZE_HANDLE_SIZE_CSS_VARIABLE = "--icx-resize-handle-size";
const SHELL_RESIZE_HANDLE_EXTENT = `var(${SHELL_RESIZE_HANDLE_SIZE_CSS_VARIABLE})`;
const SHELL_RESIZE_HANDLE_OUTSET = `calc(${SHELL_RESIZE_HANDLE_EXTENT} * -1)`;
const SHELL_LABEL_SIZE_CSS_VARIABLE = "--icx-group-label-size";
const SHELL_LABEL_EXTENT = `var(${SHELL_LABEL_SIZE_CSS_VARIABLE})`;

type InfiniteCanvasShellResizeHandleDescriptor = Readonly<{
  cursor: CSSProperties["cursor"];
  handle: InfiniteCanvasResizeHandle;
  style: CSSProperties;
}>;

/** Adds the two custom properties that `CSSProperties` omits. */
type InfiniteCanvasGroupShellStyle = CSSProperties &
  Readonly<
    Record<
      typeof SHELL_LABEL_SIZE_CSS_VARIABLE | typeof SHELL_RESIZE_HANDLE_SIZE_CSS_VARIABLE,
      string
    >
  >;

/** Places shell handles outside the rect so panes cannot cover their hit areas. */
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

/** Reorders inside the strip and starts tear-out after the pointer leaves it. */
const TAB_DRAG_THRESHOLD_PX = 6;

/** Returns a sibling index and excludes the dragged tab from the scan. */
function getTabDropIndex(siblings: readonly HTMLElement[], clientX: number): number {
  const index = siblings.findIndex((sibling) => {
    const rect = sibling.getBoundingClientRect();

    return clientX < rect.left + rect.width / 2;
  });

  return index === -1 ? siblings.length : index;
}

function useInfiniteCanvasTabDrag(
  actions: InfiniteCanvasCommands,
  group: InfiniteCanvasGroup,
  childId: string,
) {
  const originRef = useRef<{ x: number; y: number } | null>(null);
  const node = findInfiniteCanvasGroupNode(group.tree, childId);
  const canTearOut = node !== null && !isInfiniteCanvasGroupContainer(node);

  return {
    onPointerDown: (event: ReactPointerEvent<HTMLElement>) => {
      if (!isPrimaryButton(event)) {
        return;
      }

      originRef.current = { x: event.clientX, y: event.clientY };
      capturePointer(event.currentTarget, event.pointerId);
    },
    onPointerMove: (event: ReactPointerEvent<HTMLElement>) => {
      const origin = originRef.current;
      const tab = event.currentTarget;
      const strip = tab.parentElement;

      if (origin === null || strip === null) {
        return;
      }

      if (Math.hypot(event.clientX - origin.x, event.clientY - origin.y) < TAB_DRAG_THRESHOLD_PX) {
        return;
      }

      // Apply the drag threshold outside the strip to prevent low-zoom tear-out.
      const stripRect = strip.getBoundingClientRect();
      const hasLeftStrip =
        event.clientX < stripRect.left - TAB_DRAG_THRESHOLD_PX ||
        event.clientX > stripRect.right + TAB_DRAG_THRESHOLD_PX ||
        event.clientY < stripRect.top - TAB_DRAG_THRESHOLD_PX ||
        event.clientY > stripRect.bottom + TAB_DRAG_THRESHOLD_PX;

      if (hasLeftStrip) {
        if (!canTearOut) {
          return;
        }

        originRef.current = null;
        releasePointer(tab, event.pointerId);
        actions.undockWindow({ windowId: childId });
        actions.startMove({
          pointerId: event.pointerId,
          point: getEventViewportPoint(event),
          windowId: childId,
        });

        return;
      }

      // Read live tab order because an earlier pointer move can reorder it.
      const tabs = [
        ...strip.querySelectorAll<HTMLElement>(
          `:scope > [data-slot="${INFINITE_CANVAS_SLOTS.groupTab}"]`,
        ),
      ];
      const fromIndex = tabs.indexOf(tab);

      if (fromIndex === -1) {
        return;
      }

      const toIndex = getTabDropIndex(
        tabs.filter((candidate) => candidate !== tab),
        event.clientX,
      );

      if (toIndex !== fromIndex) {
        actions.reorderGroupChild({ childId, groupId: group.id, toIndex });
      }
    },
    onPointerUp: (event: ReactPointerEvent<HTMLElement>) => {
      originRef.current = null;
      releasePointer(event.currentTarget, event.pointerId);
    },
  };
}

function InfiniteCanvasGroupShell({
  camera,
  canvasInstanceId,
  devicePixelRatio,
  group,
  insets,
  isActive,
  labelSize,
  metrics,
  resizeHandleSize,
  tabLabel,
  title,
  viewport,
}: Readonly<{
  camera: InfiniteCanvasCamera;
  canvasInstanceId: string;
  devicePixelRatio: number;
  group: InfiniteCanvasGroup;
  /** Viewport insets constrain pinned group labels. */
  insets: InfiniteCanvasViewportInsets;
  isActive: boolean;
  /** Label height in screen pixels. A value of `0` hides labels. */
  labelSize: number;
  metrics: InfiniteCanvasGroupMetrics;
  resizeHandleSize: number;
  tabLabel: InfiniteCanvasGroupTabLabel;
  /** Resolves a label with access to the current windows. */
  title: string;
  viewport: InfiniteCanvasViewport;
}>) {
  const actions = useInfiniteCanvasActions();
  const layout = useMemo(
    () => getInfiniteCanvasGroupLayout(group.tree, group.rect, metrics),
    [group.rect, group.tree, metrics],
  );
  // Each container owns one roving-focus scope.
  const accordionsByContainer = useMemo(() => {
    const byContainer = new Map<string, InfiniteCanvasGroupAccordionHeader[]>();

    for (const header of layout.accordionHeaders) {
      const existing = byContainer.get(header.containerId);

      if (existing === undefined) {
        byContainer.set(header.containerId, [header]);
      } else {
        existing.push(header);
      }
    }

    return [...byContainer];
  }, [layout.accordionHeaders]);
  const { screenRect, screenTransform } = projectWorldRectToScreen(
    camera,
    viewport,
    group.rect,
    devicePixelRatio,
  );
  /** Keeps a label within the visible part of its shell. */
  const labelPinOffset = useMemo(() => {
    const scale = screenTransform.scale;

    if (scale <= 0) {
      return 0;
    }

    const naturalTop = screenRect.top - resizeHandleSize - labelSize;
    const held = Math.max(naturalTop, insets.top);
    const pinned = Math.min(held, screenRect.top + screenRect.height - labelSize);

    return Math.max(0, pinned - naturalTop) / scale;
  }, [
    insets.top,
    labelSize,
    resizeHandleSize,
    screenRect.height,
    screenRect.top,
    screenTransform.scale,
  ]);
  const shellStyle: InfiniteCanvasGroupShellStyle = {
    ...getWorldRectStyle(camera, viewport, group.rect, devicePixelRatio),
    // Convert fixed screen sizes to world units for the scaled shell.
    [SHELL_RESIZE_HANDLE_SIZE_CSS_VARIABLE]: `${
      screenTransform.scale <= 0 ? resizeHandleSize : resizeHandleSize / screenTransform.scale
    }px`,
    [SHELL_LABEL_SIZE_CSS_VARIABLE]: `${
      screenTransform.scale <= 0 ? labelSize : labelSize / screenTransform.scale
    }px`,
    // Cull shell chrome with the same viewport margin as its panes.
    contentVisibility: isWorldRectCulled(camera, viewport, group.rect) ? "auto" : "visible",
    pointerEvents: "none",
    zIndex: group.zIndex,
  };

  // Hide resize handles at summary detail. Keep keyboard controls.
  const handleDetailRef = useRef<InfiniteCanvasDetailLevel>("full");
  const handleDetail = getInfiniteCanvasWindowDetailLevel(
    group.rect,
    camera.zoom,
    handleDetailRef.current,
  );

  handleDetailRef.current = handleDetail;

  return (
    <div
      aria-label={title}
      // Mark the group that contains the active window.
      aria-current={isActive ? "true" : undefined}
      aria-roledescription="window group"
      data-active={isActive ? "" : undefined}
      data-infinite-canvas-group-id={group.id}
      data-slot={INFINITE_CANVAS_SLOTS.groupShell}
      role="group"
      style={shellStyle}
    >
      {title === "" || labelSize <= 0 ? null : (
        <div
          aria-hidden="true"
          data-slot={INFINITE_CANVAS_SLOTS.groupLabel}
          style={{
            bottom: `calc(100% + ${SHELL_RESIZE_HANDLE_EXTENT} - ${String(labelPinOffset)}px)`,
            // Keep group labels at a fixed screen height.
            height: SHELL_LABEL_EXTENT,
            left: 0,
            maxWidth: "100%",
            position: "absolute",
          }}
        >
          {title}
        </div>
      )}
      {(handleDetail === "full" ? SHELL_RESIZE_HANDLE_DESCRIPTORS : []).map((descriptor) => (
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
              minSize: getInfiniteCanvasGroupMinimumSize(group.tree, metrics),
              point: getEventViewportPoint(event),
              pointerId: event.pointerId,
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
          canvasInstanceId={canvasInstanceId}
          childIds={strip.childIds}
          containerId={strip.containerId}
          group={group}
          key={strip.containerId}
          style={getLocalRectStyle(strip.rect, group.rect)}
          tabLabel={tabLabel}
        />
      ))}
      {accordionsByContainer.map(([containerId, headers]) => (
        <InfiniteCanvasGroupAccordionHeaders
          group={group}
          headers={headers}
          key={containerId}
          tabLabel={tabLabel}
        />
      ))}
    </div>
  );
}

/** Uses one tab stop per accordion and maps arrow keys to its axis. */
function InfiniteCanvasGroupAccordionHeaders({
  group,
  headers,
  tabLabel,
}: Readonly<{
  group: InfiniteCanvasGroup;
  headers: readonly InfiniteCanvasGroupAccordionHeader[];
  tabLabel: InfiniteCanvasGroupTabLabel;
}>) {
  const actions = useInfiniteCanvasActions();
  const headersRef = useRef<HTMLDivElement>(null);
  const [focusedChildId, setFocusedChildId] = useState<string | null>(null);
  const windows = useInfiniteCanvasSelector((state) => state.windows);
  const childIds = headers.map((header) => header.childId);
  const expandedChildId = headers.find((header) => header.isExpanded)?.childId;
  // Use the active or first header when the prior tab stop leaves the accordion.
  const tabStopChildId =
    focusedChildId !== null && childIds.includes(focusedChildId)
      ? focusedChildId
      : (expandedChildId ?? childIds[0]);
  const axis = headers[0]?.axis ?? "vertical";

  return (
    <div
      onKeyDown={(event) => {
        const index = childIds.indexOf(tabStopChildId ?? "");
        const nextIndex =
          index === -1
            ? null
            : getNextInfiniteCanvasRovingIndex(event.key, index, childIds.length, axis);

        if (nextIndex === null) {
          return;
        }

        // Prevent arrow and Home or End keys from scrolling the page.
        event.preventDefault();
        setFocusedChildId(childIds[nextIndex] ?? null);
        focusRovingSibling(
          headersRef.current,
          INFINITE_CANVAS_SLOTS.groupAccordionHeader,
          nextIndex,
        );
      }}
      ref={headersRef}
      style={{ inset: 0, pointerEvents: "none", position: "absolute" }}
    >
      {headers.map((header) => (
        <button
          aria-expanded={header.isExpanded}
          data-active={header.isExpanded ? "" : undefined}
          // Header text follows the accordion axis.
          data-axis={header.axis}
          data-slot={INFINITE_CANVAS_SLOTS.groupAccordionHeader}
          key={header.childId}
          onClick={() => {
            actions.setGroupActiveChild({
              childId: header.childId,
              containerId: header.containerId,
              groupId: group.id,
            });
          }}
          onFocus={() => {
            setFocusedChildId(header.childId);
          }}
          style={{
            ...getLocalRectStyle(header.rect, group.rect),
            pointerEvents: "auto",
          }}
          tabIndex={header.childId === tabStopChildId ? 0 : -1}
          type="button"
        >
          {tabLabel({ childId: header.childId, group, windows })}
        </button>
      ))}
    </div>
  );
}

/** Focuses a direct sibling without scrolling its ancestors. */
function focusRovingSibling(container: HTMLElement | null, slot: string, index: number) {
  container
    ?.querySelectorAll<HTMLButtonElement>(`:scope > [data-slot="${slot}"]`)
    [index]?.focus({ preventScroll: true });
}

/** Uses one tab stop with manual activation for each tab strip. */
function InfiniteCanvasGroupTabStrip({
  activeChildId,
  canvasInstanceId,
  childIds,
  containerId,
  group,
  style,
  tabLabel,
}: Readonly<{
  activeChildId: string;
  canvasInstanceId: string;
  childIds: readonly string[];
  containerId: string;
  group: InfiniteCanvasGroup;
  style: CSSProperties;
  tabLabel: InfiniteCanvasGroupTabLabel;
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
          index === -1
            ? null
            : getNextInfiniteCanvasRovingIndex(event.key, index, childIds.length, "horizontal");

        if (nextIndex === null) {
          return;
        }

        event.preventDefault();
        setFocusedChildId(childIds[nextIndex] ?? null);
        focusRovingSibling(stripRef.current, INFINITE_CANVAS_SLOTS.groupTab, nextIndex);
      }}
      ref={stripRef}
      role="tablist"
      style={{ ...style, alignItems: "stretch", display: "flex", pointerEvents: "auto" }}
    >
      {childIds.map((childId) => (
        <InfiniteCanvasGroupTab
          canvasInstanceId={canvasInstanceId}
          childId={childId}
          containerId={containerId}
          group={group}
          isActive={childId === activeChildId}
          isTabStop={childId === tabStopChildId}
          key={childId}
          onFocus={setFocusedChildId}
          tabLabel={tabLabel}
        />
      ))}
    </div>
  );
}

function InfiniteCanvasGroupTab({
  canvasInstanceId,
  childId,
  containerId,
  group,
  isActive,
  isTabStop,
  onFocus,
  tabLabel,
}: Readonly<{
  canvasInstanceId: string;
  childId: string;
  containerId: string;
  group: InfiniteCanvasGroup;
  isActive: boolean;
  isTabStop: boolean;
  onFocus: (childId: string) => void;
  tabLabel: InfiniteCanvasGroupTabLabel;
}>) {
  const actions = useInfiniteCanvasActions();
  const tabDrag = useInfiniteCanvasTabDrag(actions, group, childId);
  const windows = useInfiniteCanvasSelector((state) => state.windows);

  return (
    <button
      // Add `aria-controls` only when the active tab panel exists.
      aria-controls={
        isActive ? getInfiniteCanvasWindowFrameElementId(canvasInstanceId, childId) : undefined
      }
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
        tabDrag.onPointerDown(event);
      }}
      onPointerMove={tabDrag.onPointerMove}
      onPointerUp={tabDrag.onPointerUp}
      role="tab"
      tabIndex={isTabStop ? 0 : -1}
      type="button"
    >
      {tabLabel({ childId, group, windows })}
    </button>
  );
}

function getLocalRectStyle(rect: InfiniteCanvasRect, shell: InfiniteCanvasRect): CSSProperties {
  return {
    height: `${rect.height}px`,
    left: `${rect.x - shell.x}px`,
    position: "absolute",
    top: `${rect.y - shell.y}px`,
    width: `${rect.width}px`,
  };
}

function InfiniteCanvasGroupLayer({
  canvasInstanceId,
  devicePixelRatio,
  groupLabel = ({ group, windows }) => getInfiniteCanvasGroupTitle(group, windows),
  labelSize,
  resizeHandleSize,
  tabLabel = getInfiniteCanvasGroupTabLabel,
  zIndex,
}: Readonly<{
  /** Per-canvas token used to match tab controls with frame ids. */
  canvasInstanceId: string;
  devicePixelRatio: number;
  /** Resolves a group label. Return `""` to hide one label. */
  groupLabel?: (
    context: Readonly<{ group: InfiniteCanvasGroup; windows: readonly InfiniteCanvasWindow[] }>,
  ) => string;
  /** Label height in screen pixels. A value of `0` hides labels. */
  labelSize: number;
  resizeHandleSize: number;
  tabLabel?: InfiniteCanvasGroupTabLabel;
  zIndex: number;
}>) {
  const camera = useInfiniteCanvasSelector((state) => state.camera);
  const viewport = useInfiniteCanvasSelector((state) => state.viewport);
  const allGroups = useInfiniteCanvasSelector((state) => state.groups);
  const windows = useInfiniteCanvasSelector((state) => state.windows);
  const insets = useInfiniteCanvasSelector((state) => state.viewportInsets);
  const activeWindowId = useInfiniteCanvasSelector((state) => state.activeWindowId);
  // Use store metrics because the reducer uses them to place panes.
  const metrics = useInfiniteCanvasSelector((state) => state.groupMetrics);
  // Render a shell only when the active workspace includes its members.
  const admittedWindowIds = useInfiniteCanvasSelector(getInfiniteCanvasWorkspaceWindowIds);
  const groups =
    admittedWindowIds === null
      ? allGroups
      : allGroups.filter((group) =>
          getInfiniteCanvasGroupWindowIds(group.tree).some((windowId) =>
            admittedWindowIds.has(windowId),
          ),
        );

  if (groups.length === 0) {
    return null;
  }

  return (
    <div style={{ inset: 0, pointerEvents: "none", position: "absolute", zIndex }}>
      {groups.map((group) => (
        <InfiniteCanvasGroupShell
          camera={camera}
          canvasInstanceId={canvasInstanceId}
          devicePixelRatio={devicePixelRatio}
          group={group}
          isActive={
            activeWindowId !== null &&
            getInfiniteCanvasGroupWindowIds(group.tree).includes(activeWindowId)
          }
          insets={insets}
          key={group.id}
          labelSize={labelSize}
          metrics={metrics}
          resizeHandleSize={resizeHandleSize}
          tabLabel={tabLabel}
          title={groupLabel({ group, windows })}
          viewport={viewport}
        />
      ))}
    </div>
  );
}

export { InfiniteCanvasGroupLayer };
