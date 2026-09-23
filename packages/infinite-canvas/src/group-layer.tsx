"use client";
import { GroupActionMenu } from "./context-actions";
import type { ContextMenuPolicy } from "./types";
import { Accordion } from "@base-ui/react/accordion";
import { Tabs } from "@base-ui/react/tabs";

import { useValue } from "@legendapp/state/react";
import {
  memo,
  useMemo,
  useRef,
  type CSSProperties,
  type PointerEvent as ReactPointerEvent,
} from "react";

import { InfiniteCanvasCameraLayer } from "./camera-layer";
import { INFINITE_CANVAS_SLOTS, getInfiniteCanvasWindowFrameElementId } from "./data-attributes";
import { applyModifiedPointerTargetSelection, getEventViewportPoint } from "./frame-slots";
import { useInfiniteCanvasDetailLevel } from "./react/detail-level";
import { worldRectToScreenRect } from "./geometry";
import { getInfiniteCanvasPointerOwnedIds } from "./interaction";
import { INFINITE_CANVAS_LAYOUT_TRANSITION } from "./layout-motion";
import { getResizeHandleDescriptors } from "../next/geometry";
import { type InfiniteCanvasGroupAccordionHeader, type InfiniteCanvasGroupLayout } from "./layout";
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
import { DRAG_THRESHOLD_PX } from "./constants";
import { capturePointer, isPrimaryButton, releasePointer } from "../next/input";
import {
  useInfiniteCanvasDispatch,
  useInfiniteCanvasState$,
  useInfiniteCanvasStore,
} from "./react/store";
import type {
  InfiniteCanvasDispatch,
  InfiniteCanvasGroup,
  InfiniteCanvasRect,
  InfiniteCanvasWindow,
  InfiniteCanvasViewportInsets,
} from "./types";

/** Solves group chrome from model geometry. Only tab hit tests read the DOM. */

const SHELL_RESIZE_HANDLE_SIZE_CSS_VARIABLE = "--icx-resize-handle-size";
const SHELL_RESIZE_HANDLE_EXTENT = `var(${SHELL_RESIZE_HANDLE_SIZE_CSS_VARIABLE})`;
const SHELL_RESIZE_HANDLE_OUTSET = `calc(${SHELL_RESIZE_HANDLE_EXTENT} * -1)`;
const SHELL_LABEL_SIZE_CSS_VARIABLE = "--icx-group-label-size";
const SHELL_LABEL_EXTENT = `var(${SHELL_LABEL_SIZE_CSS_VARIABLE})`;

/** Adds the two custom properties that `CSSProperties` omits. */
type InfiniteCanvasGroupShellStyle = CSSProperties &
  Readonly<
    Record<
      typeof SHELL_LABEL_SIZE_CSS_VARIABLE | typeof SHELL_RESIZE_HANDLE_SIZE_CSS_VARIABLE,
      string
    >
  >;

const SHELL_RESIZE_HANDLE_DESCRIPTORS = getResizeHandleDescriptors({
  size: SHELL_RESIZE_HANDLE_EXTENT,
  offset: SHELL_RESIZE_HANDLE_OUTSET,
  inset: 0,
});

/** A shell in world units under the layer's camera transform; its rect changes tween. */
function getWorldRectStyle(rect: InfiniteCanvasRect, isPointerOwned: boolean): CSSProperties {
  return {
    height: `${rect.height}px`,
    left: "0px",
    position: "absolute",
    top: "0px",
    transform: `translate(${rect.x}px, ${rect.y}px)`,
    transition: isPointerOwned ? "none" : INFINITE_CANVAS_LAYOUT_TRANSITION,
    width: `${rect.width}px`,
  };
}

/** Reorders inside the strip and starts tear-out after the pointer leaves it. */
const TAB_DRAG_THRESHOLD_PX = DRAG_THRESHOLD_PX;

/** Returns a sibling index and excludes the dragged tab from the scan. */
function getTabDropIndex(siblings: readonly HTMLElement[], clientX: number): number {
  const index = siblings.findIndex((sibling) => {
    const rect = sibling.getBoundingClientRect();

    return clientX < rect.left + rect.width / 2;
  });

  return index === -1 ? siblings.length : index;
}

function useInfiniteCanvasTabDrag(
  dispatch: InfiniteCanvasDispatch,
  group: InfiniteCanvasGroup,
  childId: string,
) {
  const originRef = useRef<{ x: number; y: number } | null>(null);
  const reset = () => {
    originRef.current = null;
  };
  const node = findInfiniteCanvasGroupNode(group.tree, childId);
  const canTearOut = node !== null && !isInfiniteCanvasGroupContainer(node);

  return {
    onPointerDown: (event: ReactPointerEvent<HTMLElement>) => {
      if (!isPrimaryButton(event)) {
        return;
      }

      originRef.current = { x: event.clientX, y: event.clientY };
      capturePointer(event.currentTarget, event.pointerId);
      dispatch({
        type: "interaction.startGroupReorder",
        groupId: group.id,
        childId,
        pointerId: event.pointerId,
      });
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
        dispatch({
          type: "interaction.startMove",
          undock: true,
          pointerId: event.pointerId,
          point: getEventViewportPoint(event),
          target: { type: "window", id: childId },
        });
        releasePointer(tab, event.pointerId);

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
        dispatch({ type: "group.reorderChild", childId, groupId: group.id, toIndex });
      }
    },
    onPointerUp: reset,
    onPointerCancel: reset,
    onLostPointerCapture: reset,
  };
}

function InfiniteCanvasGroupShell({
  canvasInstanceId,
  contextMenu,
  group,
  insets,
  isActive,
  isDragging,
  isDropTarget,
  isPointerOwned,
  labelSize,
  layout,
  rect,
  resizeHandleSize,
  tabLabel,
  title,
  windowRects,
  windows,
  zoom,
}: Readonly<{
  canvasInstanceId: string;
  contextMenu?: ContextMenuPolicy | false;
  group: InfiniteCanvasGroup;
  /** Viewport insets constrain pinned group labels. */
  insets: InfiniteCanvasViewportInsets;
  isActive: boolean;
  /** A window is in the hand somewhere on the canvas. */
  isDragging: boolean;
  /** The window in the hand would dock into this group if released. */
  isDropTarget: boolean;
  /** The pointer writes this shell's rect each frame, so it must not tween. */
  isPointerOwned: boolean;
  /** Label height in screen pixels. A value of `0` hides labels. */
  labelSize: number;
  layout: InfiniteCanvasGroupLayout;
  rect: InfiniteCanvasRect;
  resizeHandleSize: number;
  tabLabel: InfiniteCanvasGroupTabLabel;
  /** Resolves a label with access to the current windows. */
  title: string;
  windowRects: ReadonlyMap<string, InfiniteCanvasRect>;
  windows: readonly InfiniteCanvasWindow[];
  zoom: number;
}>) {
  const dispatch = useInfiniteCanvasDispatch();
  const state$ = useInfiniteCanvasState$();
  const isSelected = useValue(() =>
    (state$.selection.targets.get() ?? []).some(
      (target) => target.type === "group" && target.id === group.id,
    ),
  );
  const selectionTarget = { type: "group", kind: "group", id: group.id } as const;
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
  const scale = zoom;
  // Keeps a label within the visible part of its shell. The camera is read here, not selected
  // by the shell, so a pan re-renders the shell only when the pinned offset changes.
  const labelPinOffset = useValue(() => {
    if (title === "" || labelSize <= 0) {
      return 0;
    }

    const camera = state$.camera.get();
    const screenRect = worldRectToScreenRect(camera, state$.viewport.get(), rect);

    if (camera.zoom <= 0) {
      return 0;
    }

    const naturalTop = screenRect.top - resizeHandleSize - labelSize;
    const held = Math.max(naturalTop, insets.top);
    const pinned = Math.min(held, screenRect.top + screenRect.height - labelSize);

    return Math.max(0, pinned - naturalTop) / camera.zoom;
  });
  const shellStyle: InfiniteCanvasGroupShellStyle = {
    ...getWorldRectStyle(rect, isPointerOwned),
    // Convert fixed screen sizes to world units for the scaled shell.
    [SHELL_RESIZE_HANDLE_SIZE_CSS_VARIABLE]: `${scale <= 0 ? resizeHandleSize : resizeHandleSize / scale}px`,
    [SHELL_LABEL_SIZE_CSS_VARIABLE]: `${scale <= 0 ? labelSize : labelSize / scale}px`,
    pointerEvents: "none",
    zIndex: group.zIndex,
  };

  // Hide resize handles at summary detail. Keep keyboard controls.
  const handleDetail = useInfiniteCanvasDetailLevel(rect);

  return (
    <div
      aria-label={title}
      // Mark the group that contains the active window.
      aria-current={isActive ? "true" : undefined}
      aria-roledescription="window group"
      data-active={isActive ? "" : undefined}
      data-selected={isSelected ? "" : undefined}
      data-dragging={isDragging ? "" : undefined}
      data-drop-target={isDropTarget ? "" : undefined}
      data-infinite-canvas-group-id={group.id}
      data-slot={INFINITE_CANVAS_SLOTS.groupShell}
      role="group"
      style={shellStyle}
    >
      {title === "" || labelSize <= 0 ? null : (
        <div
          data-slot="group-label-row"
          style={{
            bottom: `calc(100% + ${SHELL_RESIZE_HANDLE_EXTENT} - ${String(labelPinOffset)}px)`,
            height: SHELL_LABEL_EXTENT,
            left: 0,
            maxWidth: "100%",
            position: "absolute",
          }}
        >
          <button
            type="button"
            aria-pressed={isSelected}
            data-infinite-canvas-control="true"
            data-slot={INFINITE_CANVAS_SLOTS.groupLabel}
            onDoubleClick={(event) => {
              event.stopPropagation();
              dispatch({ type: "group.fitContents", groupId: group.id });
            }}
            onClick={(event) => {
              if (event.detail === 0)
                applyModifiedPointerTargetSelection(dispatch, event, selectionTarget);
            }}
            onPointerDown={(event) => {
              if (!isPrimaryButton(event)) return;
              event.preventDefault();
              event.stopPropagation();
              if (!isSelected || event.shiftKey || event.metaKey || event.ctrlKey) {
                applyModifiedPointerTargetSelection(dispatch, event, selectionTarget);
              }
              if (event.shiftKey || event.metaKey || event.ctrlKey) return;
              capturePointer(event.currentTarget, event.pointerId);
              dispatch({
                type: "interaction.startMove",
                target: { type: "group", id: group.id },
                point: getEventViewportPoint(event),
                pointerId: event.pointerId,
              });
            }}
            style={{
              pointerEvents: "auto",
              cursor: "grab",
              height: "100%",
              maxWidth: "100%",
            }}
          >
            {title}
          </button>
          <GroupActionMenu groupId={group.id} policy={contextMenu} />
        </div>
      )}
      {(handleDetail === "full" ? SHELL_RESIZE_HANDLE_DESCRIPTORS : []).map((descriptor) => (
        <div
          data-handle={descriptor.handle}
          data-infinite-canvas-control="true"
          data-slot={INFINITE_CANVAS_SLOTS.groupResizeHandle}
          key={descriptor.handle}
          onPointerDown={(event) => {
            if (!isPrimaryButton(event)) {
              return;
            }

            event.preventDefault();
            event.stopPropagation();
            capturePointer(event.currentTarget, event.pointerId);
            dispatch({
              type: "interaction.startGroupResize",
              groupId: group.id,
              handle: descriptor.handle,
              minSize: {
                width: Math.max(1, (2 * resizeHandleSize) / scale),
                height: Math.max(1, (2 * resizeHandleSize) / scale),
              },
              point: getEventViewportPoint(event),
              pointerId: event.pointerId,
            });
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
          onPointerDown={(event) => {
            if (!isPrimaryButton(event)) {
              return;
            }

            event.preventDefault();
            event.stopPropagation();
            capturePointer(event.currentTarget, event.pointerId);
            dispatch({
              type: "interaction.startGroupGutter",
              afterChildId: gutter.afterChildId,
              beforeChildId: gutter.beforeChildId,
              containerId: gutter.containerId,
              groupId: group.id,
              point: getEventViewportPoint(event),
              pointerId: event.pointerId,
            });
          }}
          style={{
            ...getLocalRectStyle(gutter.rect, rect),
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
          rect={rect}
          style={getLocalRectStyle(strip.rect, rect)}
          tabLabel={tabLabel}
          windowRects={windowRects}
          windows={windows}
        />
      ))}
      {accordionsByContainer.map(([containerId, headers]) => (
        <InfiniteCanvasGroupAccordionHeaders
          group={group}
          headers={headers}
          key={containerId}
          rect={rect}
          tabLabel={tabLabel}
          windowRects={windowRects}
          windows={windows}
        />
      ))}
    </div>
  );
}

/** Uses one tab stop per accordion and maps arrow keys to its axis. */
function InfiniteCanvasGroupAccordionHeaders({
  group,
  headers,
  rect,
  tabLabel,
  windowRects,
  windows,
}: Readonly<{
  group: InfiniteCanvasGroup;
  headers: readonly InfiniteCanvasGroupAccordionHeader[];
  rect: InfiniteCanvasRect;
  tabLabel: InfiniteCanvasGroupTabLabel;
  windowRects: ReadonlyMap<string, InfiniteCanvasRect>;
  windows: readonly InfiniteCanvasWindow[];
}>) {
  const dispatch = useInfiniteCanvasDispatch();
  const axis = headers[0]?.axis ?? "vertical";

  return (
    <Accordion.Root
      orientation={axis}
      value={headers.filter((header) => header.isExpanded).map((header) => header.childId)}
      onValueChange={(value) => {
        const header = headers.find((header) => header.childId === value[0]);
        if (header !== undefined)
          dispatch({
            type: "group.setActiveChild",
            childId: header.childId,
            containerId: header.containerId,
            groupId: group.id,
          });
      }}
      style={{ inset: 0, pointerEvents: "none", position: "absolute" }}
    >
      {headers.map((header) => (
        <Accordion.Item key={header.childId} value={header.childId} style={{ display: "contents" }}>
          <Accordion.Header style={{ display: "contents" }}>
            <Accordion.Trigger
              data-active={header.isExpanded ? "" : undefined}
              // Header text follows the accordion axis.
              data-axis={header.axis}
              data-slot={INFINITE_CANVAS_SLOTS.groupAccordionHeader}
              style={{
                ...getLocalRectStyle(header.rect, rect),
                pointerEvents: "auto",
              }}
            >
              {tabLabel({ childId: header.childId, group, rect, windowRects, windows })}
            </Accordion.Trigger>
          </Accordion.Header>
        </Accordion.Item>
      ))}
    </Accordion.Root>
  );
}

/** Uses one tab stop with manual activation for each tab strip. */
function InfiniteCanvasGroupTabStrip({
  activeChildId,
  canvasInstanceId,
  childIds,
  containerId,
  group,
  rect,
  style,
  tabLabel,
  windowRects,
  windows,
}: Readonly<{
  activeChildId: string;
  canvasInstanceId: string;
  childIds: readonly string[];
  containerId: string;
  group: InfiniteCanvasGroup;
  rect: InfiniteCanvasRect;
  style: CSSProperties;
  tabLabel: InfiniteCanvasGroupTabLabel;
  windowRects: ReadonlyMap<string, InfiniteCanvasRect>;
  windows: readonly InfiniteCanvasWindow[];
}>) {
  const dispatch = useInfiniteCanvasDispatch();

  return (
    <Tabs.Root
      value={activeChildId}
      style={{ display: "contents" }}
      onValueChange={(childId) => {
        if (typeof childId === "string")
          dispatch({ type: "group.setActiveChild", childId, containerId, groupId: group.id });
      }}
    >
      <Tabs.List
        data-slot={INFINITE_CANVAS_SLOTS.groupTabStrip}
        style={{ ...style, alignItems: "stretch", display: "flex", pointerEvents: "auto" }}
      >
        {childIds.map((childId) => (
          <InfiniteCanvasGroupTab
            canvasInstanceId={canvasInstanceId}
            childId={childId}
            containerId={containerId}
            group={group}
            isActive={childId === activeChildId}
            key={childId}
            rect={rect}
            tabLabel={tabLabel}
            windowRects={windowRects}
            windows={windows}
          />
        ))}
      </Tabs.List>
    </Tabs.Root>
  );
}

function InfiniteCanvasGroupTab({
  canvasInstanceId,
  childId,
  containerId,
  group,
  isActive,
  rect,
  tabLabel,
  windowRects,
  windows,
}: Readonly<{
  canvasInstanceId: string;
  childId: string;
  containerId: string;
  group: InfiniteCanvasGroup;
  isActive: boolean;
  rect: InfiniteCanvasRect;
  tabLabel: InfiniteCanvasGroupTabLabel;
  windowRects: ReadonlyMap<string, InfiniteCanvasRect>;
  windows: readonly InfiniteCanvasWindow[];
}>) {
  const dispatch = useInfiniteCanvasDispatch();
  const tabDrag = useInfiniteCanvasTabDrag(dispatch, group, childId);

  return (
    <Tabs.Tab
      value={childId}
      // Add `aria-controls` only when the active tab panel exists.
      aria-controls={
        isActive ? getInfiniteCanvasWindowFrameElementId(canvasInstanceId, childId) : undefined
      }
      data-active={isActive ? "" : undefined}
      data-infinite-canvas-control="true"
      data-slot={INFINITE_CANVAS_SLOTS.groupTab}
      onClick={() => {
        if (isActive)
          dispatch({ type: "group.setActiveChild", childId, containerId, groupId: group.id });
      }}
      onPointerDown={(event) => {
        event.stopPropagation();
        tabDrag.onPointerDown(event);
      }}
      onPointerMove={tabDrag.onPointerMove}
      onPointerUp={tabDrag.onPointerUp}
      onPointerCancel={tabDrag.onPointerCancel}
      onLostPointerCapture={tabDrag.onLostPointerCapture}
    >
      {tabLabel({ childId, group, rect, windowRects, windows })}
    </Tabs.Tab>
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

function InfiniteCanvasGroupLayerContent({
  canvasInstanceId,
  groupContextMenu,
  dropGroupId,
  groupLabel = ({ group, windows }) => getInfiniteCanvasGroupTitle(group, windows),
  labelSize,
  resizeHandleSize,
  tabLabel = getInfiniteCanvasGroupTabLabel,
  zIndex,
}: Readonly<{
  /** Per-canvas token used to match tab controls with frame ids. */
  canvasInstanceId: string;
  groupContextMenu?: ContextMenuPolicy | false;
  dropGroupId?: string;
  /** Resolves a group label. Return `""` to hide one label. */
  groupLabel?: (
    context: Readonly<{
      group: InfiniteCanvasGroup;
      rect: InfiniteCanvasRect;
      windowRects: ReadonlyMap<string, InfiniteCanvasRect>;
      windows: readonly InfiniteCanvasWindow[];
    }>,
  ) => string;
  /** Label height in screen pixels. A value of `0` hides labels. */
  labelSize: number;
  resizeHandleSize: number;
  tabLabel?: InfiniteCanvasGroupTabLabel;
  zIndex: number;
}>) {
  const store = useInfiniteCanvasStore();
  const zoom = useValue(store.state$.camera.zoom);
  const allGroups = useValue(store.state$.groups);
  const windows = useValue(store.state$.windows);
  const insets = useValue(store.state$.viewportInsets);
  const activeWindowId = useValue(store.state$.activeWindowId);
  const interaction = useValue(store.state$.interaction);
  const canvasLayout = useValue(store.layout$);
  const pointerOwnedGroupIds = useMemo(
    () => getInfiniteCanvasPointerOwnedIds(store.state$.peek()).groupIds,
    [allGroups, interaction, store],
  );
  // A shell shows itself while a window is in the hand, and marks itself as the drop target.
  const move = interaction?.kind === "move" ? interaction : null;
  const groups = allGroups.filter((group) => canvasLayout.visibleGroupIds.has(group.id));

  if (groups.length === 0) {
    return null;
  }

  return (
    <InfiniteCanvasCameraLayer zIndex={zIndex}>
      {groups.map((authoredGroup) => {
        const layout = canvasLayout.layouts.get(authoredGroup.id);
        if (layout === undefined) return null;
        const rect = canvasLayout.groupRects.get(authoredGroup.id);
        if (rect === undefined) return null;

        return (
          <InfiniteCanvasGroupShell
            canvasInstanceId={canvasInstanceId}
            contextMenu={groupContextMenu}
            group={authoredGroup}
            isActive={
              activeWindowId !== null &&
              getInfiniteCanvasGroupWindowIds(authoredGroup.tree).includes(activeWindowId)
            }
            isDragging={move !== null || dropGroupId !== undefined}
            isDropTarget={(dropGroupId ?? move?.dockPreview?.groupId) === authoredGroup.id}
            isPointerOwned={pointerOwnedGroupIds.has(authoredGroup.id)}
            insets={insets}
            key={authoredGroup.id}
            labelSize={labelSize}
            layout={layout}
            rect={rect}
            resizeHandleSize={resizeHandleSize}
            tabLabel={tabLabel}
            title={groupLabel({
              group: authoredGroup,
              rect,
              windowRects: canvasLayout.windowRects,
              windows,
            })}
            windowRects={canvasLayout.windowRects}
            windows={windows}
            zoom={zoom}
          />
        );
      })}
    </InfiniteCanvasCameraLayer>
  );
}

const InfiniteCanvasGroupLayer = memo(
  InfiniteCanvasGroupLayerContent,
) as typeof InfiniteCanvasGroupLayerContent;

export { InfiniteCanvasGroupLayer };
