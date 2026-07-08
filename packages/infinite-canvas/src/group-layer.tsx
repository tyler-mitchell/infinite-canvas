"use client";

import { useMemo, useRef, type CSSProperties, type PointerEvent as ReactPointerEvent } from "react";

import { INFINITE_CANVAS_SLOTS } from "./data-attributes";
import { getEventViewportPoint } from "./frame-slots";
import { projectWorldRectToScreen } from "./geometry";
import {
  DEFAULT_INFINITE_CANVAS_GROUP_METRICS,
  getInfiniteCanvasGroupLayout,
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
  viewport,
}: Readonly<{
  camera: InfiniteCanvasCamera;
  devicePixelRatio: number;
  group: InfiniteCanvasGroup;
  metrics: InfiniteCanvasGroupMetrics;
  viewport: InfiniteCanvasViewport;
}>) {
  const actions = useInfiniteCanvasActions();
  const layout = useMemo(
    () => getInfiniteCanvasGroupLayout(group.tree, group.rect, metrics),
    [group.rect, group.tree, metrics],
  );

  return (
    <div
      aria-label={group.title}
      aria-roledescription="window group"
      data-infinite-canvas-group-id={group.id}
      data-slot={INFINITE_CANVAS_SLOTS.groupShell}
      role="group"
      style={{
        ...getWorldRectStyle(camera, viewport, group.rect, devicePixelRatio),
        pointerEvents: "none",
        zIndex: group.zIndex,
      }}
    >
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
        <div
          data-slot={INFINITE_CANVAS_SLOTS.groupTabStrip}
          key={strip.containerId}
          role="tablist"
          style={{
            ...getLocalRectStyle(strip.rect, group.rect),
            alignItems: "stretch",
            display: "flex",
            pointerEvents: "auto",
          }}
        >
          {strip.childIds.map((childId) => (
            <InfiniteCanvasGroupTab
              childId={childId}
              containerId={strip.containerId}
              group={group}
              isActive={childId === strip.activeChildId}
              key={childId}
            />
          ))}
        </div>
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

function InfiniteCanvasGroupTab({
  childId,
  containerId,
  group,
  isActive,
}: Readonly<{
  childId: string;
  containerId: string;
  group: InfiniteCanvasGroup;
  isActive: boolean;
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
      onPointerDown={(event) => {
        event.stopPropagation();
        tearOut.onPointerDown(event);
      }}
      onPointerMove={tearOut.onPointerMove}
      onPointerUp={tearOut.onPointerUp}
      role="tab"
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
  zIndex,
}: Readonly<{
  devicePixelRatio: number;
  metrics?: InfiniteCanvasGroupMetrics;
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
          viewport={viewport}
        />
      ))}
    </div>
  );
}

export { InfiniteCanvasGroupLayer };
