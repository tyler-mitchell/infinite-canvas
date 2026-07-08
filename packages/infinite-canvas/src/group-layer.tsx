"use client";

import { useMemo, type CSSProperties } from "react";

import { INFINITE_CANVAS_SLOTS } from "./data-attributes";
import { getEventViewportPoint } from "./frame-slots";
import { projectWorldRectToScreen } from "./geometry";
import {
  DEFAULT_INFINITE_CANVAS_GROUP_METRICS,
  getInfiniteCanvasGroupLayout,
  type InfiniteCanvasGroupMetrics,
} from "./group-layout";
import { findInfiniteCanvasGroupNode } from "./group-tree";
import { capturePointer, isPrimaryButton, releasePointer } from "./runtime";
import { useInfiniteCanvasActions, useInfiniteCanvasSelector } from "./store";
import type {
  InfiniteCanvasCamera,
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
            <button
              aria-selected={childId === strip.activeChildId}
              data-active={childId === strip.activeChildId ? "" : undefined}
              data-slot={INFINITE_CANVAS_SLOTS.groupTab}
              key={childId}
              onClick={() => {
                actions.setGroupActiveChild({
                  childId,
                  containerId: strip.containerId,
                  groupId: group.id,
                });
              }}
              role="tab"
              type="button"
            >
              {getTabLabel(group, childId)}
            </button>
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
