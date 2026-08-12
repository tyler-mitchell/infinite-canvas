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
import { isWorldRectCulled, projectWorldRectToScreen } from "./geometry";
import {
  DEFAULT_INFINITE_CANVAS_GROUP_METRICS,
  getInfiniteCanvasGroupLayout,
  getInfiniteCanvasGroupMinimumSize,
  type InfiniteCanvasGroupAccordionHeader,
  type InfiniteCanvasGroupMetrics,
} from "./group-layout";
import {
  findInfiniteCanvasGroupNode,
  getInfiniteCanvasGroupWindowIds,
  isInfiniteCanvasGroupContainer,
} from "./group-tree";
import { getInfiniteCanvasWorkspaceWindowIds } from "./workspace-membership";
import { capturePointer, isPrimaryButton, releasePointer } from "./runtime";
import { useInfiniteCanvasActions, useInfiniteCanvasSelector } from "./store";
import { getNextInfiniteCanvasRovingIndex } from "./window-focus";
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
 * No rect here comes from the DOM. Every one comes from the same solver the reducer used
 * to place the windows, so the chrome cannot drift out of alignment with the panes it
 * separates. The single exception is `getTabDropIndex`, which hit-tests a tab strip during
 * a reorder drag: tab widths are flex content and no solver knows them. It decides *which
 * slot the pointer is over*, never where anything is drawn.
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
 * A tab travels a few pixels before it means anything. Below the threshold the gesture is
 * a click that activates the tab.
 *
 * Past it, **where the pointer goes decides what the drag is** (TAB-001, DOCK-004). Inside
 * the strip it reorders; leaving the strip tears the window out and hands the same pointer
 * to `interaction.startMove`, exactly as a floating window's header would have started it.
 * This is the rule every real tab bar uses, and until 2026-07-08 the strip did not have it:
 * *any* six pixels of travel tore the tab out, which made reordering unreachable by drag,
 * however hard you tried to slide a tab sideways.
 *
 * Tear-out hands the window no rect. It keeps the one the solver already gave it, which for
 * a hidden tab is the size it would have been revealed at, so nothing jumps and nothing
 * swells to fill the shell.
 *
 * Only a window can float. A tab whose child is a nested container has nowhere to go, so it
 * stays inside the strip — and, now, can still be reordered within it.
 */
const TAB_DRAG_THRESHOLD_PX = 6;

/**
 * Where a tab dropped at `clientX` belongs, as an index among its *siblings*.
 *
 * The dragged tab is excluded from the scan because `reorderChild` splices it out before
 * inserting at `toIndex` — so the index it wants is an index into the others, and counting
 * the dragged tab's own slot would overshoot by one every time you dragged rightwards.
 *
 * This is the only place in this file that measures the DOM, and it measures a *hit test*,
 * never a layout: tab widths come from flex content, which no solver knows. Every rect that
 * decides where anything is drawn still comes from `group-layout.ts`.
 */
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

      // Captured even when the child cannot float: a container tab still reorders.
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

      // Leaving the strip has to cost the same six screen pixels that entering the drag
      // did. The strip's height is fixed in *world* units, so at low zoom it is only a few
      // screen pixels tall and a bare `clientY > bottom` would tear a tab out on the first
      // downward wobble of a sideways drag. Same trap as the resize handles that used to
      // straddle a world-sized gutter.
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

      // Read the live DOM order rather than a `childIds` prop: a reorder dispatched on an
      // earlier pointermove has already moved this tab, and the prop in this closure is a
      // render behind.
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

      // The pointer is still over the slot this tab already occupies.
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
  metrics,
  resizeHandleSize,
  viewport,
}: Readonly<{
  camera: InfiniteCanvasCamera;
  canvasInstanceId: string;
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
  // The solver emits headers flat; each container is its own roving-focus scope, so they
  // are regrouped by `containerId` with source order preserved inside each.
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
    // A shell is gutters, tab strips, accordion headers and eight resize handles, all of which
    // are only reachable where the shell is drawn — so an offscreen group's chrome is skipped
    // on the same margin its panes are, and by the same predicate, so the two can never
    // disagree and strand a gutter without the panes it divides. Purely geometric, unlike the
    // window frame's: a group whose rect is a viewport away has nothing visible to preserve,
    // and the active window inside it keeps its own frame live on its own policy.
    contentVisibility: isWorldRectCulled(camera, viewport, group.rect) ? "auto" : "visible",
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
        />
      ))}
      {accordionsByContainer.map(([containerId, headers]) => (
        <InfiniteCanvasGroupAccordionHeaders group={group} headers={headers} key={containerId} />
      ))}
    </div>
  );
}

/**
 * One accordion's headers, and one tab stop between them (ACC-001).
 *
 * The same roving-`tabIndex` contract the tab strip uses, with one difference that is the
 * whole point of the scenario: **the arrows follow the container's axis.** An accordion
 * stacked vertically answers to Up/Down; one stacked horizontally answers to Left/Right.
 * Hard-coding Left/Right, as a tablist may, would make Down walk a row of side-by-side
 * headers — the diagonal drift that `window-focus.ts` refuses everywhere else.
 *
 * Each container is its own scope, so a shell holding two accordions has two tab stops,
 * not one. The wrapper exists only to make `:scope >` mean "this accordion's headers"; it
 * has no box and no role, and passes pointer events straight through.
 */
function InfiniteCanvasGroupAccordionHeaders({
  group,
  headers,
}: Readonly<{
  group: InfiniteCanvasGroup;
  headers: readonly InfiniteCanvasGroupAccordionHeader[];
}>) {
  const actions = useInfiniteCanvasActions();
  const headersRef = useRef<HTMLDivElement>(null);
  const [focusedChildId, setFocusedChildId] = useState<string | null>(null);
  const childIds = headers.map((header) => header.childId);
  const expandedChildId = headers.find((header) => header.isExpanded)?.childId;
  // Falls back to the expanded fold when the header that held the stop has left the
  // accordion, and to the first header when nothing is expanded.
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

        // Home/End and the arrows would otherwise scroll the nearest scroll container.
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
          {getTabLabel(group, header.childId)}
        </button>
      ))}
    </div>
  );
}

/** Focus a roving sibling without scrolling ancestors to reveal it. */
function focusRovingSibling(container: HTMLElement | null, slot: string, index: number) {
  // Siblings are direct children in source order, so the index addresses the element
  // without escaping a consumer-supplied id into a selector. `preventScroll` because the
  // control lives inside the shell's `transform: scale(zoom)`: a plain `focus()` scrolls
  // ancestors to reveal a control that is already exactly where the user can see it.
  container
    ?.querySelectorAll<HTMLButtonElement>(`:scope > [data-slot="${slot}"]`)
    [index]?.focus({ preventScroll: true });
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
  canvasInstanceId,
  childIds,
  containerId,
  group,
  style,
}: Readonly<{
  activeChildId: string;
  canvasInstanceId: string;
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
        // A tab strip always lays out horizontally, whatever its container's axis.
        const nextIndex =
          index === -1
            ? null
            : getNextInfiniteCanvasRovingIndex(event.key, index, childIds.length, "horizontal");

        if (nextIndex === null) {
          return;
        }

        // Home/End and the arrows would otherwise scroll the nearest scroll container.
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
}: Readonly<{
  canvasInstanceId: string;
  childId: string;
  containerId: string;
  group: InfiniteCanvasGroup;
  isActive: boolean;
  isTabStop: boolean;
  onFocus: (childId: string) => void;
}>) {
  const actions = useInfiniteCanvasActions();
  const tabDrag = useInfiniteCanvasTabDrag(actions, group, childId);

  return (
    <button
      // The tab's `childId` IS the window id, so it controls that window's frame panel (FR-9)
      // — but only the *active* child of a tabs container is rendered. An inactive tab named a
      // panel that was not in the document, and a dangling `aria-controls` is worse than an
      // absent one: assistive technology follows it, finds nothing, and says nothing. APG
      // recommends the reference where the panel exists; it does not ask for one that lies.
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
  canvasInstanceId,
  devicePixelRatio,
  metrics = DEFAULT_INFINITE_CANVAS_GROUP_METRICS,
  resizeHandleSize,
  zIndex,
}: Readonly<{
  /** Per-canvas token, shared with the window layer, so a tab's `aria-controls` matches a frame id. */
  canvasInstanceId: string;
  devicePixelRatio: number;
  metrics?: InfiniteCanvasGroupMetrics;
  resizeHandleSize: number;
  zIndex: number;
}>) {
  const camera = useInfiniteCanvasSelector((state) => state.camera);
  const viewport = useInfiniteCanvasSelector((state) => state.viewport);
  const allGroups = useInfiniteCanvasSelector((state) => state.groups);
  // A group shell is chrome for its members, so it belongs on the desktops they are on.
  // Rendering every group regardless would leave tab strips and gutters standing over
  // windows the active workspace filtered out. Membership is group-complete, so asking about
  // any one member answers for the shell.
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
