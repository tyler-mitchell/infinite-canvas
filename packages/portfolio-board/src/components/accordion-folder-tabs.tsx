import { X } from "lucide-react";
import {
  AnimatePresence,
  animate as animateValue,
  motion,
  useMotionValue,
  useReducedMotion,
  useSpring,
  useTransform,
  type MotionValue,
  type SpringOptions,
} from "motion/react";
import {
  useCallback,
  useEffect,
  useId,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  type PointerEvent as ReactPointerEvent,
  type ReactNode,
} from "react";
import { createPortal } from "react-dom";
import { tv } from "../tv.ts";

const accordionFolderTabs = tv({
  slots: {
    root: "relative isolate min-w-0 overflow-hidden rounded-pk-card border border-pk-line bg-pk-surface-sunken font-pk-sans text-pk-ink",
    railWrap:
      "relative overflow-x-auto overflow-y-hidden [scrollbar-width:none] [&::-webkit-scrollbar]:hidden",
    railContent: "relative h-full",
    rail: "relative z-30 flex h-full gap-3",
    snapPoint: "pointer-events-none h-px shrink-0 snap-start",
    actions: "absolute z-30 flex w-max items-center",
    tab: "group absolute top-0 left-0 flex touch-pan-y items-stretch select-none [-webkit-touch-callout:none]",
    tabBox: "relative flex items-stretch",
    inactiveFace:
      "absolute inset-x-0 top-0 bottom-1 rounded-t-pk-control bg-transparent transition-colors duration-(--pk-duration-hover) ease-pk-swift group-hover:bg-pk-ink/[0.06]",
    button:
      "group relative z-10 flex h-full w-full min-w-0 items-center gap-2 overflow-hidden rounded-t-pk-control px-3 text-left outline-none transition-colors duration-(--pk-duration-hover) ease-pk-swift",
    focus:
      "pointer-events-none absolute inset-x-1 top-1 opacity-0 transition-opacity duration-(--pk-duration-hover) ease-pk-swift group-focus-visible:opacity-100",
    icon: "grid size-8 shrink-0 place-items-center",
    label: "min-w-0 truncate whitespace-nowrap text-pk-control font-medium leading-none",
    close:
      "absolute right-2 top-1/2 z-20 grid size-6 -translate-y-1/2 place-items-center rounded-pk-control-inner text-pk-ink-dim transition-colors duration-(--pk-duration-hover) ease-pk-swift hover:bg-pk-ink/[0.06] hover:text-pk-ink-bright focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-pk-accent/50",
    closeIcon: "size-3.5 stroke-[1.5]",
    surface: "pointer-events-none absolute inset-x-0 top-0 w-full fill-pk-surface-selected",
    emptySurface:
      "pointer-events-none absolute inset-x-0 top-0 w-full fill-none stroke-pk-ink-soft/50",
    content: "relative z-20 min-h-64 overflow-hidden text-pk-ink",
    contentInner: "min-h-64",
    empty: "relative z-20 mx-3 grid min-h-64 place-items-center p-6 text-center",
    emptyTitle: "font-pk-sans text-pk-control font-medium text-pk-ink-bright",
    emptyDescription: "mt-1 font-pk-sans text-pk-meta text-pk-ink-dim",
  },
  variants: {
    active: {
      true: {
        button: "text-pk-ink-bright",
        focus: "bottom-0 rounded-t-pk-control border-x-2 border-t-2 border-pk-accent/60",
        close: "text-pk-ink-soft hover:bg-pk-ink/[0.08] hover:text-pk-ink-bright",
      },
      false: {
        button: "text-pk-ink-dim hover:text-pk-ink",
        focus: "bottom-1 rounded-t-pk-control border-2 border-pk-accent/60",
        close: "text-pk-ink-faint hover:bg-pk-ink/[0.08] hover:text-pk-ink",
      },
    },
    dragging: {
      true: { tab: "z-30 cursor-grabbing", inactiveFace: "bg-pk-pane-active" },
      false: { tab: "cursor-grab" },
    },
    disabled: {
      true: { tab: "cursor-not-allowed opacity-40" },
      false: {},
    },
    closable: {
      true: { button: "pr-10" },
      false: {},
    },
  },
});

const DEFAULT_GEOMETRY = {
  dragThreshold: 5,
  maxTabWidth: 160,
  minTabWidth: 112,
  tabHeight: 40,
  tabRadius: 18,
  railHeight: 64,
  surfaceInset: 12,
  join: 16,
  panelRadius: 16,
} as const;

export type AccordionFolderTabsGeometry = { [K in keyof typeof DEFAULT_GEOMETRY]: number };
export type AccordionFolderTabItem = {
  id: string;
  label: string;
  icon?: ReactNode;
  content: ReactNode;
  disabled?: boolean;
};

export type AccordionFolderTabsClassNames = {
  root?: string;
  railWrap?: string;
  railContent?: string;
  rail?: string;
  snapPoint?: string;
  actions?: string;
  tabFrame?: string;
  tabBox?: string;
  inactiveFace?: string;
  tab?: string;
  surface?: string;
  emptySurface?: string;
  focus?: string;
  icon?: string;
  label?: string;
  close?: string;
  closeIcon?: string;
  content?: string;
  contentInner?: string;
  empty?: string;
  emptyTitle?: string;
  emptyDescription?: string;
};

export interface AccordionFolderTabsProps {
  items: readonly AccordionFolderTabItem[];
  value?: string | null;
  defaultValue?: string | null;
  onValueChange?: (id: string | null) => void;
  onOrderChange?: (items: AccordionFolderTabItem[]) => void;
  onClose?: (id: string) => void;
  actions?: ReactNode;
  emptyState?: ReactNode;
  scrollSnap?: "mandatory" | "proximity" | "none";
  ariaLabel?: string;
  className?: string;
  classNames?: AccordionFolderTabsClassNames;
  geometry?: Partial<AccordionFolderTabsGeometry>;
  glide?: SpringOptions;
  press?: SpringOptions;
  style?: React.CSSProperties;
}

type DragSession = {
  id: string;
  pointerId: number;
  originX: number;
  originScrollLeft: number;
  startLeft: number;
  startIndex: number;
  targetIndex: number;
  moved: boolean;
  finishing: boolean;
  startOrder: string[];
  slotLefts: number[];
};

type SpringTabProps = {
  id: string;
  targetLeft: number;
  dragging: boolean;
  dragLeft: MotionValue<number>;
  surfaceLeft: MotionValue<number>;
  railScroll: MotionValue<number>;
  reduce: boolean;
  active: boolean;
  anyDragging: boolean;
  surfaceHost: HTMLDivElement | null;
  surfaceWidth: number;
  surfaceHeight: number;
  tabWidth: number;
  geometry: AccordionFolderTabsGeometry;
  glide: SpringOptions;
  surfaceClassName?: string;
  zIndex: number;
  className: string;
  children: ReactNode;
  registerPosition: (id: string, position: MotionValue<number> | null) => void;
  onPointerDown: (event: ReactPointerEvent<HTMLDivElement>) => void;
  onPointerMove: (event: ReactPointerEvent<HTMLDivElement>) => void;
  onPointerUp: (event: ReactPointerEvent<HTMLDivElement>) => void;
  onPointerCancel: (event: ReactPointerEvent<HTMLDivElement>) => void;
  onLostPointerCapture: (event: ReactPointerEvent<HTMLDivElement>) => void;
};

const DEFAULT_GLIDE: SpringOptions = { stiffness: 420, damping: 38, mass: 0.9 };
const DEFAULT_PRESS: SpringOptions = { stiffness: 300, damping: 30 };

function sameOrder(a: string[], b: string[]) {
  return a.length === b.length && a.every((id, index) => id === b[index]);
}

function moveItem(order: string[], from: number, to: number) {
  if (from === to) return order.slice();
  const next = order.slice();
  const [item] = next.splice(from, 1);
  next.splice(to, 0, item);
  return next;
}

export function tabWidthForRail({
  surfaceWidth,
  count,
  actionsWidth,
  hasActions,
  tabGap,
  geometry,
}: {
  surfaceWidth: number;
  count: number;
  actionsWidth: number;
  hasActions: boolean;
  tabGap: number;
  geometry: AccordionFolderTabsGeometry;
}) {
  if (!surfaceWidth || count === 0) return geometry.maxTabWidth;
  const inner = surfaceWidth - geometry.surfaceInset * 2 - (hasActions ? actionsWidth + tabGap : 0);
  const available = Math.floor((inner - tabGap * (count - 1)) / count);
  return Math.max(geometry.minTabWidth, Math.min(geometry.maxTabWidth, available));
}

export function liquidTabPath(
  tabLeft: number,
  surfaceWidth: number,
  surfaceHeight: number,
  tabWidth: number,
  geometry: AccordionFolderTabsGeometry,
) {
  const panelLeft = geometry.surfaceInset;
  const panelRight = surfaceWidth - geometry.surfaceInset;
  const left = Math.max(panelLeft, Math.min(panelRight - tabWidth, tabLeft));
  const right = left + tabWidth;
  const top = geometry.railHeight - geometry.tabHeight;
  const bottom = geometry.railHeight;
  const tabRadius = Math.min(geometry.tabRadius, tabWidth / 2);
  const leftJoin = Math.max(panelLeft, left - geometry.join);
  const rightJoin = Math.min(panelRight, right + geometry.join);
  const leftDepth = Math.min(geometry.join, left - leftJoin);
  const rightDepth = Math.min(geometry.join, rightJoin - right);
  const leftControl = leftDepth * 0.55;
  const rightControl = rightDepth * 0.55;
  const leftPanelRadius = Math.min(geometry.panelRadius, leftJoin - panelLeft);
  const rightPanelRadius = Math.min(geometry.panelRadius, panelRight - rightJoin);
  const leftBlend = leftPanelRadius / Math.max(geometry.panelRadius, 1);
  const rightBlend = rightPanelRadius / Math.max(geometry.panelRadius, 1);
  const leftCornerControl = leftPanelRadius * 0.55;
  const rightCornerControl = rightPanelRadius * 0.55;

  return [
    `M${panelLeft} ${bottom + leftPanelRadius}`,
    `C${panelLeft} ${bottom + leftPanelRadius - leftCornerControl} ${panelLeft + leftPanelRadius - leftCornerControl * leftBlend} ${bottom + leftCornerControl * (1 - leftBlend)} ${panelLeft + leftPanelRadius} ${bottom}`,
    `H${leftJoin}`,
    `C${leftJoin + leftControl * leftBlend} ${bottom - leftControl * (1 - leftBlend)} ${left} ${bottom - leftDepth + leftControl} ${left} ${bottom - leftDepth}`,
    `V${top + tabRadius}`,
    `Q${left} ${top} ${left + tabRadius} ${top}`,
    `H${right - tabRadius}`,
    `Q${right} ${top} ${right} ${top + tabRadius}`,
    `V${bottom - rightDepth}`,
    `C${right} ${bottom - rightDepth + rightControl} ${rightJoin - rightControl * rightBlend} ${bottom - rightControl * (1 - rightBlend)} ${rightJoin} ${bottom}`,
    `H${panelRight - rightPanelRadius}`,
    `C${panelRight - rightPanelRadius + rightCornerControl * rightBlend} ${bottom + rightCornerControl * (1 - rightBlend)} ${panelRight} ${bottom + rightPanelRadius - rightCornerControl} ${panelRight} ${bottom + rightPanelRadius}`,
    `V${surfaceHeight - geometry.panelRadius}`,
    `Q${panelRight} ${surfaceHeight} ${panelRight - geometry.panelRadius} ${surfaceHeight}`,
    `H${panelLeft + geometry.panelRadius}`,
    `Q${panelLeft} ${surfaceHeight} ${panelLeft} ${surfaceHeight - geometry.panelRadius}`,
    "Z",
  ].join(" ");
}

function SpringTab({
  id,
  targetLeft,
  dragging,
  dragLeft,
  surfaceLeft,
  railScroll,
  reduce,
  active,
  anyDragging,
  surfaceHost,
  surfaceWidth,
  surfaceHeight,
  tabWidth,
  geometry,
  glide,
  surfaceClassName,
  zIndex,
  className,
  children,
  registerPosition,
  onPointerDown,
  onPointerMove,
  onPointerUp,
  onPointerCancel,
  onLostPointerCapture,
}: SpringTabProps) {
  const target = useMotionValue(targetLeft);
  const position = useSpring(target, glide);
  const settledTransform = useTransform(
    reduce ? target : position,
    (left) => `translate3d(${left}px, 0, 0)`,
  );
  const draggedTransform = useTransform(dragLeft, (left) => `translate3d(${left}px, 0, 0)`);

  useLayoutEffect(() => {
    target.set(targetLeft);
    if (reduce) position.jump(targetLeft);
  }, [position, reduce, target, targetLeft]);

  useLayoutEffect(() => {
    registerPosition(id, position);
    return () => registerPosition(id, null);
  }, [id, position, registerPosition]);

  const liquidDriver = anyDragging ? (dragging ? dragLeft : position) : surfaceLeft;
  const viewportLeft = useTransform(
    [liquidDriver, railScroll],
    ([left, scroll]: number[]) => left - scroll,
  );

  return (
    <>
      {active && surfaceHost && surfaceWidth > geometry.surfaceInset * 2
        ? createPortal(
            <svg
              aria-hidden="true"
              focusable="false"
              viewBox={`0 0 ${surfaceWidth} ${surfaceHeight}`}
              preserveAspectRatio="none"
              className={accordionFolderTabs().surface({ className: surfaceClassName })}
              style={{
                height: surfaceHeight,
                zIndex: 0,
              }}
            >
              <LiquidSurfacePath
                key={anyDragging ? (dragging ? "dragged" : "displaced") : "idle"}
                left={viewportLeft}
                surfaceWidth={surfaceWidth}
                surfaceHeight={surfaceHeight}
                tabWidth={tabWidth}
                geometry={geometry}
              />
            </svg>,
            surfaceHost,
          )
        : null}
      <motion.div
        style={{
          zIndex,
          transform: dragging ? draggedTransform : settledTransform,
        }}
        className={className}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerCancel={onPointerCancel}
        onLostPointerCapture={onLostPointerCapture}
      >
        {children}
      </motion.div>
    </>
  );
}

function LiquidSurfacePath({
  left,
  surfaceWidth,
  surfaceHeight,
  tabWidth,
  geometry,
}: {
  left: MotionValue<number>;
  surfaceWidth: number;
  surfaceHeight: number;
  tabWidth: number;
  geometry: AccordionFolderTabsGeometry;
}) {
  const path = useTransform(left, (value) =>
    liquidTabPath(value, surfaceWidth, surfaceHeight, tabWidth, geometry),
  );
  return <motion.path d={path} />;
}

export function AccordionFolderTabs({
  items,
  value,
  defaultValue,
  onValueChange,
  onOrderChange,
  onClose,
  actions,
  emptyState,
  scrollSnap = "mandatory",
  ariaLabel = "Tabs",
  className,
  classNames,
  geometry: geometryOptions,
  glide = DEFAULT_GLIDE,
  press = DEFAULT_PRESS,
  style,
}: AccordionFolderTabsProps) {
  const geometry = { ...DEFAULT_GEOMETRY, ...geometryOptions };
  const styles = accordionFolderTabs();
  const reduce = Boolean(useReducedMotion());
  const uid = useId();
  const itemIds = useMemo(() => items.map((item) => item.id), [items]);
  const itemMap = useMemo(() => new Map(items.map((item) => [item.id, item])), [items]);
  const [storedOrder, setOrder] = useState(itemIds);
  const order = useMemo(() => {
    const available = new Set(itemIds);
    const retained = storedOrder.filter((id) => available.has(id));
    const retainedSet = new Set(retained);
    return [...retained, ...itemIds.filter((id) => !retainedSet.has(id))];
  }, [itemIds, storedOrder]);
  const orderRef = useRef(order);
  orderRef.current = order;

  const [internalValue, setInternalValue] = useState<string | null>(
    defaultValue ?? itemIds[0] ?? null,
  );
  const controlled = value !== undefined;
  const currentValue = controlled ? (value ?? null) : internalValue;

  const rootRef = useRef<HTMLDivElement | null>(null);
  const railWrapRef = useRef<HTMLDivElement | null>(null);
  const railRef = useRef<HTMLDivElement | null>(null);
  const actionsRef = useRef<HTMLDivElement | null>(null);
  const tabButtonRefs = useRef<Record<string, HTMLButtonElement | null>>({});
  const tabPositionRefs = useRef<Record<string, MotionValue<number> | null>>({});
  const dragRef = useRef<DragSession | null>(null);
  const dragAnimationRef = useRef<ReturnType<typeof animateValue> | null>(null);
  const surfaceAnimationRef = useRef<ReturnType<typeof animateValue> | null>(null);
  const [surfaceWidth, setSurfaceWidth] = useState(0);
  const [surfaceHeight, setSurfaceHeight] = useState(0);
  const [tabGap, setTabGap] = useState(12);
  const [actionsWidth, setActionsWidth] = useState(0);
  const [draggingId, setDraggingId] = useState<string | null>(null);
  const [dragTargetIndex, setDragTargetIndex] = useState(-1);
  const dragLeft = useMotionValue(geometry.surfaceInset);
  const surfaceLeft = useMotionValue(geometry.surfaceInset);
  const railScroll = useMotionValue(0);

  useEffect(() => {
    const available = new Set(itemIds);
    setOrder((current) => {
      const retained = current.filter((id) => available.has(id));
      return sameOrder(current, retained) ? current : retained;
    });
  }, [itemIds]);

  const orderedItems = useMemo(
    () =>
      order.flatMap((id) => {
        const item = itemMap.get(id);
        return item ? [item] : [];
      }),
    [itemMap, order],
  );

  const firstEnabledItem = orderedItems.find((item) => !item.disabled) ?? null;
  const activeItem =
    currentValue && itemMap.has(currentValue) && !itemMap.get(currentValue)?.disabled
      ? (itemMap.get(currentValue) ?? null)
      : firstEnabledItem;
  const activeId = activeItem?.id ?? null;

  const tabWidth = tabWidthForRail({
    surfaceWidth,
    count: order.length,
    actionsWidth,
    hasActions: Boolean(actions),
    tabGap,
    geometry,
  });

  const slotLefts = useMemo(
    () => order.map((_, index) => geometry.surfaceInset + index * (tabWidth + tabGap)),
    [order, tabGap, tabWidth, geometry.surfaceInset],
  );
  const railWidth =
    geometry.surfaceInset * 2 +
    order.length * tabWidth +
    Math.max(0, order.length - 1) * tabGap +
    (actions ? actionsWidth + tabGap : 0);

  const dragStartIndex = draggingId ? order.indexOf(draggingId) : -1;

  const visualIndexFor = useCallback(
    (index: number) => {
      if (dragStartIndex < 0 || dragTargetIndex < 0) return index;
      if (index === dragStartIndex) return dragTargetIndex;

      if (dragTargetIndex > dragStartIndex && index > dragStartIndex && index <= dragTargetIndex) {
        return index - 1;
      }
      if (dragTargetIndex < dragStartIndex && index >= dragTargetIndex && index < dragStartIndex) {
        return index + 1;
      }
      return index;
    },
    [dragStartIndex, dragTargetIndex],
  );

  useLayoutEffect(() => {
    const root = rootRef.current;
    const rail = railRef.current;
    if (!root || !rail) return;

    const measure = () => {
      setSurfaceWidth(root.clientWidth);
      setSurfaceHeight(root.clientHeight);
      setActionsWidth(actionsRef.current?.offsetWidth ?? 0);
      const nextGap = Number.parseFloat(getComputedStyle(rail).columnGap);
      if (Number.isFinite(nextGap)) setTabGap(nextGap);
    };

    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(root);
    if (actionsRef.current) observer.observe(actionsRef.current);
    return () => observer.disconnect();
  }, [Boolean(actions)]);

  const setActive = useCallback(
    (id: string | null) => {
      if (id && itemMap.get(id)?.disabled) return;
      if (!controlled) setInternalValue(id);
      onValueChange?.(id);
    },
    [controlled, itemMap, onValueChange],
  );

  useEffect(() => {
    if (
      !controlled &&
      internalValue &&
      (!itemMap.has(internalValue) || itemMap.get(internalValue)?.disabled)
    ) {
      setInternalValue(firstEnabledItem?.id ?? null);
    }
  }, [controlled, firstEnabledItem?.id, internalValue, itemMap]);

  const activeOrderIndex = activeId ? order.indexOf(activeId) : -1;
  const activeVisualIndex = activeOrderIndex < 0 ? -1 : visualIndexFor(activeOrderIndex);

  useLayoutEffect(() => {
    const rail = railWrapRef.current;
    const left = slotLefts[activeVisualIndex];
    if (!rail || left === undefined || draggingId) return;
    const inset = geometry.surfaceInset;
    const visibleLeft = left - rail.scrollLeft;
    const previousScroll = rail.scrollLeft;
    if (visibleLeft < inset) rail.scrollLeft = left - inset;
    else if (visibleLeft + tabWidth > rail.clientWidth - inset) {
      rail.scrollLeft = left + tabWidth - rail.clientWidth + inset;
    }
    if (rail.scrollLeft !== previousScroll) {
      surfaceAnimationRef.current?.stop();
      surfaceLeft.set(surfaceLeft.get() + rail.scrollLeft - previousScroll);
    }
    railScroll.set(rail.scrollLeft);
  }, [
    activeVisualIndex,
    draggingId,
    geometry.surfaceInset,
    railScroll,
    slotLefts,
    surfaceLeft,
    tabWidth,
  ]);

  useLayoutEffect(() => {
    if (
      !activeId ||
      activeVisualIndex < 0 ||
      activeId === draggingId ||
      slotLefts[activeVisualIndex] === undefined
    ) {
      return;
    }

    surfaceAnimationRef.current?.stop();

    if (draggingId) return;

    surfaceAnimationRef.current = animateValue(
      surfaceLeft,
      slotLefts[activeVisualIndex],
      reduce ? { duration: 0 } : { type: "spring", ...glide },
    );
  }, [activeId, activeVisualIndex, draggingId, reduce, slotLefts, surfaceLeft, glide]);

  const commitOrder = useCallback(
    (next: string[], notify: boolean) => {
      orderRef.current = next;
      setOrder((current) => (sameOrder(current, next) ? current : next));
      if (notify) onOrderChange?.(next.flatMap((id) => itemMap.get(id) ?? []));
    },
    [itemMap, onOrderChange],
  );

  const registerPosition = useCallback((id: string, position: MotionValue<number> | null) => {
    tabPositionRefs.current[id] = position;
  }, []);

  const startDrag = useCallback(
    (id: string, event: ReactPointerEvent<HTMLDivElement>) => {
      if (event.button !== 0 || itemMap.get(id)?.disabled || dragRef.current) {
        return;
      }

      const startIndex = orderRef.current.indexOf(id);
      if (startIndex < 0) return;
      const capturedSlots = orderRef.current.map(
        (_, index) => geometry.surfaceInset + index * (tabWidth + tabGap),
      );
      const startLeft = capturedSlots[startIndex];

      dragAnimationRef.current?.stop();
      dragAnimationRef.current = null;
      dragLeft.set(startLeft);
      dragRef.current = {
        id,
        pointerId: event.pointerId,
        originX: event.clientX,
        originScrollLeft: railWrapRef.current?.scrollLeft ?? 0,
        startLeft,
        startIndex,
        targetIndex: startIndex,
        moved: false,
        finishing: false,
        startOrder: orderRef.current.slice(),
        slotLefts: capturedSlots,
      };
    },
    [dragLeft, itemMap, tabGap, tabWidth, geometry.surfaceInset],
  );

  const moveDrag = useCallback(
    (event: ReactPointerEvent<HTMLDivElement>) => {
      const drag = dragRef.current;
      if (!drag || drag.finishing || drag.pointerId !== event.pointerId) return;

      const rail = railWrapRef.current;
      if (drag.moved && rail) {
        const bounds = rail.getBoundingClientRect();
        const step = Math.max(8, tabWidth / 8);
        if (event.clientX < bounds.left + 32) rail.scrollLeft -= step;
        else if (event.clientX > bounds.right - 32) rail.scrollLeft += step;
        railScroll.set(rail.scrollLeft);
      }
      const delta =
        event.clientX - drag.originX + ((rail?.scrollLeft ?? 0) - drag.originScrollLeft);
      if (!drag.moved && Math.abs(delta) < geometry.dragThreshold) return;
      event.preventDefault();

      if (!drag.moved) {
        drag.moved = true;
        try {
          event.currentTarget.setPointerCapture(event.pointerId);
        } catch {
          dragRef.current = null;
          setDraggingId(null);
          setDragTargetIndex(-1);
          console.warn("Folder tab drag stopped: pointer capture failed.", {
            id: drag.id,
            pointerId: event.pointerId,
          });
          return;
        }
        if (drag.id === activeId) {
          surfaceAnimationRef.current?.stop();
          surfaceLeft.set(drag.startLeft);
        }
        setDraggingId(drag.id);
        setDragTargetIndex(drag.startIndex);
      }

      const minLeft = drag.slotLefts[0];
      const maxLeft = drag.slotLefts[drag.slotLefts.length - 1];
      const visualLeft = Math.max(minLeft, Math.min(maxLeft, drag.startLeft + delta));
      let targetIndex = drag.startIndex;

      if (visualLeft >= drag.startLeft) {
        for (let index = drag.startIndex + 1; index < drag.slotLefts.length; index += 1) {
          if (visualLeft + tabWidth / 2 >= drag.slotLefts[index]) {
            targetIndex = index;
          }
        }
      } else {
        for (let index = drag.startIndex - 1; index >= 0; index -= 1) {
          if (visualLeft <= drag.slotLefts[index] + tabWidth / 2) {
            targetIndex = index;
          }
        }
      }

      dragLeft.set(visualLeft);
      if (targetIndex !== drag.targetIndex) {
        drag.targetIndex = targetIndex;
        setDragTargetIndex(targetIndex);
      }
    },
    [activeId, dragLeft, railScroll, surfaceLeft, tabWidth, geometry.dragThreshold],
  );

  const finishDrag = useCallback(
    (pointerId: number) => {
      const drag = dragRef.current;
      if (!drag || drag.pointerId !== pointerId || drag.finishing) return;

      if (!drag.moved) {
        dragRef.current = null;
        return;
      }

      drag.finishing = true;
      const targetLeft = drag.slotLefts[drag.targetIndex];
      const next = moveItem(drag.startOrder, drag.startIndex, drag.targetIndex);
      const settle = () => {
        if (dragRef.current !== drag) return;
        if (drag.id === activeId) {
          surfaceLeft.set(targetLeft);
        } else if (activeId) {
          const activePosition = tabPositionRefs.current[activeId];
          if (activePosition) surfaceLeft.set(activePosition.get());
        }
        tabPositionRefs.current[drag.id]?.jump(targetLeft);
        dragAnimationRef.current = null;
        dragRef.current = null;
        commitOrder(next, !sameOrder(drag.startOrder, next));
        setDraggingId(null);
        setDragTargetIndex(-1);
      };
      if (reduce) {
        dragLeft.set(targetLeft);
        settle();
        return;
      }
      const controls = animateValue(dragLeft, targetLeft, {
        type: "spring",
        ...glide,
        onComplete: settle,
      });
      if (dragRef.current === drag) dragAnimationRef.current = controls;
    },
    [activeId, commitOrder, dragLeft, reduce, surfaceLeft, glide],
  );

  const cancelDrag = useCallback(
    (pointerId: number) => {
      const drag = dragRef.current;
      if (!drag || drag.pointerId !== pointerId || drag.finishing) return;
      dragAnimationRef.current?.stop();
      dragAnimationRef.current = null;
      dragLeft.set(drag.startLeft);
      if (drag.id === activeId) surfaceLeft.set(drag.startLeft);
      dragRef.current = null;
      setDraggingId(null);
      setDragTargetIndex(-1);
    },
    [activeId, dragLeft, surfaceLeft],
  );

  useEffect(() => {
    const finishFromWindow = (event: PointerEvent) => {
      finishDrag(event.pointerId);
    };
    const cancelFromWindow = (event: PointerEvent) => {
      cancelDrag(event.pointerId);
    };
    window.addEventListener("pointerup", finishFromWindow, true);
    window.addEventListener("pointercancel", cancelFromWindow, true);
    return () => {
      window.removeEventListener("pointerup", finishFromWindow, true);
      window.removeEventListener("pointercancel", cancelFromWindow, true);
    };
  }, [cancelDrag, finishDrag]);

  const moveBy = useCallback(
    (id: string, direction: -1 | 1) => {
      const current = orderRef.current;
      const index = current.indexOf(id);
      const nextIndex = index + direction;
      if (index < 0 || nextIndex < 0 || nextIndex >= current.length || itemMap.get(id)?.disabled) {
        return;
      }
      commitOrder(moveItem(current, index, nextIndex), true);
    },
    [commitOrder, itemMap],
  );

  const handleTabKeyDown = useCallback(
    (id: string, event: React.KeyboardEvent<HTMLButtonElement>) => {
      if (event.altKey && (event.key === "ArrowLeft" || event.key === "ArrowRight")) {
        event.preventDefault();
        moveBy(id, event.key === "ArrowLeft" ? -1 : 1);
        return;
      }
      if (!["ArrowLeft", "ArrowRight", "Home", "End"].includes(event.key)) return;
      const enabled = orderRef.current.filter((itemId) => !itemMap.get(itemId)?.disabled);
      const index = enabled.indexOf(id);
      if (index < 0) return;
      event.preventDefault();
      const nextIndex: Record<string, number> = {
        Home: 0,
        End: enabled.length - 1,
        ArrowLeft: (index - 1 + enabled.length) % enabled.length,
        ArrowRight: (index + 1) % enabled.length,
      };
      const nextId = enabled[nextIndex[event.key]];
      if (!nextId) return;
      setActive(nextId);
      requestAnimationFrame(() => tabButtonRefs.current[nextId]?.focus());
    },
    [itemMap, moveBy, setActive],
  );

  return (
    <div
      ref={rootRef}
      className={styles.root({
        className: [classNames?.root, className].filter(Boolean).join(" "),
      })}
      style={style}
    >
      {!orderedItems.length && surfaceWidth > geometry.surfaceInset * 2 ? (
        <svg
          aria-hidden="true"
          focusable="false"
          viewBox={`0 0 ${surfaceWidth} ${surfaceHeight}`}
          preserveAspectRatio="none"
          className={styles.emptySurface({ className: classNames?.emptySurface })}
          style={{ height: surfaceHeight }}
        >
          <path
            d={liquidTabPath(
              geometry.surfaceInset,
              surfaceWidth,
              surfaceHeight,
              tabWidth,
              geometry,
            )}
            strokeDasharray="5 5"
          />
        </svg>
      ) : null}
      <div
        ref={railWrapRef}
        className={styles.railWrap({ className: classNames?.railWrap })}
        style={{
          height: geometry.railHeight,
          scrollSnapType: draggingId || scrollSnap === "none" ? "none" : `x ${scrollSnap}`,
          scrollPaddingInlineStart: geometry.surfaceInset,
        }}
        onScroll={(event) => railScroll.set(event.currentTarget.scrollLeft)}
      >
        <div
          className={styles.railContent({ className: classNames?.railContent })}
          style={{ width: Math.max(surfaceWidth, railWidth) }}
        >
          <div
            ref={railRef}
            role={orderedItems.length ? "tablist" : undefined}
            aria-label={orderedItems.length ? ariaLabel : undefined}
            aria-orientation={orderedItems.length ? "horizontal" : undefined}
            className={styles.rail({ className: classNames?.rail })}
            style={{ paddingInlineStart: geometry.surfaceInset }}
          >
            {orderedItems.map((item) => (
              <span
                key={`${item.id}-snap`}
                aria-hidden="true"
                className={styles.snapPoint({ className: classNames?.snapPoint })}
                style={{ width: tabWidth }}
              />
            ))}
            {orderedItems.map((item, index) => {
              const isActive = item.id === activeId;
              const isDragging = item.id === draggingId;
              const visualIndex = visualIndexFor(index);
              const targetLeft = slotLefts[visualIndex] ?? geometry.surfaceInset;
              const tabId = `${uid}-tab-${encodeURIComponent(item.id)}`;
              const tabStyles = accordionFolderTabs({
                active: isActive,
                dragging: isDragging,
                disabled: item.disabled,
                closable: Boolean(onClose),
              });

              return (
                <SpringTab
                  key={item.id}
                  id={item.id}
                  targetLeft={targetLeft}
                  dragging={isDragging}
                  dragLeft={dragLeft}
                  surfaceLeft={surfaceLeft}
                  railScroll={railScroll}
                  reduce={reduce}
                  active={isActive}
                  anyDragging={Boolean(draggingId)}
                  surfaceHost={rootRef.current}
                  surfaceWidth={surfaceWidth}
                  surfaceHeight={surfaceHeight}
                  tabWidth={tabWidth}
                  geometry={geometry}
                  glide={glide}
                  surfaceClassName={classNames?.surface}
                  zIndex={isDragging ? 30 : isActive ? 20 : 1}
                  className={tabStyles.tab({ className: classNames?.tabFrame })}
                  registerPosition={registerPosition}
                  onPointerDown={(event) => startDrag(item.id, event)}
                  onPointerMove={moveDrag}
                  onPointerUp={(event) => finishDrag(event.pointerId)}
                  onPointerCancel={(event) => cancelDrag(event.pointerId)}
                  onLostPointerCapture={(event) => {
                    if (event.target !== event.currentTarget) return;
                    cancelDrag(event.pointerId);
                  }}
                >
                  <div
                    style={{
                      width: tabWidth,
                      height: geometry.tabHeight,
                      marginTop: geometry.railHeight - geometry.tabHeight,
                    }}
                    className={styles.tabBox({ className: classNames?.tabBox })}
                  >
                    {!isActive ? (
                      <span
                        aria-hidden
                        className={tabStyles.inactiveFace({ className: classNames?.inactiveFace })}
                      />
                    ) : null}

                    <button
                      ref={(node) => {
                        tabButtonRefs.current[item.id] = node;
                      }}
                      id={tabId}
                      type="button"
                      role="tab"
                      title={item.label}
                      aria-selected={isActive}
                      aria-controls={`${uid}-panel`}
                      aria-disabled={item.disabled || undefined}
                      tabIndex={isActive ? 0 : -1}
                      disabled={item.disabled}
                      onClick={() => {
                        const drag = dragRef.current;
                        if (drag?.id === item.id && drag.moved) return;
                        setActive(item.id);
                      }}
                      onKeyDown={(event) => handleTabKeyDown(item.id, event)}
                      className={tabStyles.button({ className: classNames?.tab })}
                    >
                      <span
                        aria-hidden
                        className={tabStyles.focus({ className: classNames?.focus })}
                      />
                      {item.icon ? (
                        <span aria-hidden className={styles.icon({ className: classNames?.icon })}>
                          {item.icon}
                        </span>
                      ) : null}
                      <span className={styles.label({ className: classNames?.label })}>
                        {item.label}
                      </span>
                    </button>

                    {onClose ? (
                      <button
                        type="button"
                        aria-label={`Close ${item.label}`}
                        onPointerDown={(event) => event.stopPropagation()}
                        onClick={(event) => {
                          event.stopPropagation();
                          onClose(item.id);
                          const next =
                            orderedItems.find(
                              (candidate) => candidate.id !== item.id && candidate.id === activeId,
                            ) ??
                            orderedItems.find(
                              (candidate) => candidate.id !== item.id && !candidate.disabled,
                            );
                          if (next) {
                            requestAnimationFrame(() => tabButtonRefs.current[next.id]?.focus());
                          } else {
                            requestAnimationFrame(() =>
                              actionsRef.current
                                ?.querySelector<HTMLElement>(
                                  "button:not(:disabled), a[href], [tabindex]:not([tabindex='-1'])",
                                )
                                ?.focus(),
                            );
                          }
                        }}
                        className={tabStyles.close({ className: classNames?.close })}
                      >
                        <X
                          aria-hidden
                          className={styles.closeIcon({ className: classNames?.closeIcon })}
                        />
                      </button>
                    ) : null}
                  </div>
                </SpringTab>
              );
            })}
          </div>
          {actions ? (
            <div
              ref={actionsRef}
              className={styles.actions({ className: classNames?.actions })}
              style={{
                left: order.length
                  ? geometry.surfaceInset + order.length * (tabWidth + tabGap)
                  : geometry.surfaceInset + (tabWidth - actionsWidth) / 2,
                top: geometry.railHeight - geometry.tabHeight,
                height: geometry.tabHeight,
              }}
            >
              {actions}
            </div>
          ) : null}
        </div>
      </div>

      {orderedItems.length ? (
        <div
          id={`${uid}-panel`}
          role="tabpanel"
          aria-labelledby={activeId ? `${uid}-tab-${encodeURIComponent(activeId)}` : undefined}
          className={styles.content({ className: classNames?.content })}
          style={{ marginInline: geometry.surfaceInset }}
        >
          <AnimatePresence mode="popLayout" initial={false}>
            {activeItem ? (
              <motion.div
                key={activeItem.id}
                initial={reduce ? { opacity: 0 } : { opacity: 0, y: 8, filter: "blur(6px)" }}
                animate={{ opacity: 1, y: 0, filter: "blur(0px)" }}
                exit={
                  reduce
                    ? {
                        opacity: 0,
                        transition: { duration: 0.08, ease: "easeOut" },
                      }
                    : {
                        opacity: 0,
                        y: -5,
                        filter: "blur(5px)",
                        transition: { duration: 0.12, ease: "easeOut" },
                      }
                }
                transition={
                  reduce ? { duration: 0.12, ease: "easeOut" } : { type: "spring", ...press }
                }
                className={styles.contentInner({ className: classNames?.contentInner })}
              >
                {activeItem.content}
              </motion.div>
            ) : null}
          </AnimatePresence>
        </div>
      ) : (
        <div role="status" className={styles.empty({ className: classNames?.empty })}>
          {emptyState ?? (
            <div>
              <div className={styles.emptyTitle({ className: classNames?.emptyTitle })}>
                No tabs yet
              </div>
              <div className={styles.emptyDescription({ className: classNames?.emptyDescription })}>
                Tabs will appear here when added.
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

export { accordionFolderTabs as accordionFolderTabsVariants };
