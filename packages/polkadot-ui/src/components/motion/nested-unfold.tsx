import { useValue } from "@legendapp/state/react";
import { useMeasure } from "@legendapp/state/react-hooks/useMeasure";
import { motion, useMotionValue, useSpring, useTransform, type HTMLMotionProps } from "motion/react";
import { createContext, use, useLayoutEffect, useRef, type ReactNode } from "react";

import {
  DISCLOSURE_SPRINGS,
  DisclosureRoot,
  DisclosureTrigger,
  getStaggerProgress,
  useDisclosureState,
  useMotionPresence,
  useSpringSize,
  type DisclosureRootProps,
  type DisclosureSpring,
  type DisclosureTargetSize,
} from "./disclosure.tsx";

const LayoutContext = createContext<Readonly<{ width: number; height: number }>>({ width: 0, height: 0 });

function NestedUnfoldRoot(props: DisclosureRootProps) {
  return <DisclosureRoot {...props} spring={props.spring ?? DISCLOSURE_SPRINGS.unfold} />;
}

function NestedUnfoldViewport({ children, columns = 2, gap = 12, onTargetSizeChange }: Readonly<{
  children: ReactNode;
  columns?: number;
  gap?: number;
  onTargetSizeChange?: (size: DisclosureTargetSize) => void;
}>) {
  const { open, progress, panelId } = useDisclosureState();
  const viewportRef = useRef<HTMLDivElement | null>(null);
  const contentRef = useRef<HTMLDivElement | null>(null);
  const size$ = useMeasure(contentRef as Parameters<typeof useMeasure>[0]);
  const size = useValue(size$);
  const naturalHeight = size.height ?? 0;
  const contentHeight = useSpringSize(size.height);
  const height = useTransform(() => Math.max(0, contentHeight.get() * progress.get()));
  const interactive = useMotionPresence({ progress, active: open, ref: contentRef });

  useLayoutEffect(() => {
    if (viewportRef.current === null) return;
    onTargetSizeChange?.({ height: open ? naturalHeight : 0, element: viewportRef.current });
  }, [naturalHeight, open, onTargetSizeChange]);

  return (
    <motion.div ref={viewportRef} id={panelId} data-slot="nested-unfold" style={{ height, overflow: "hidden" }}>
      <LayoutContext value={{ width: size.width ?? 0, height: naturalHeight }}>
        <div ref={contentRef} inert={!interactive} aria-hidden={!open} style={{
          position: "relative", display: "grid", gap,
          gridTemplateColumns: `repeat(${columns}, minmax(0, 1fr))`,
        }}>
          {children}
        </div>
      </LayoutContext>
    </motion.div>
  );
}

function NestedUnfoldItem({
  index, count, stagger = 0.1, scaleFrom = 0.86,
  spring = { stiffness: 260, damping: 27, mass: 1 }, children, style, ...props
}: Omit<HTMLMotionProps<"div">, "ref" | "animate" | "initial" | "exit" | "layout"> & Readonly<{
  index: number;
  count: number;
  stagger?: number;
  scaleFrom?: number;
  spring?: DisclosureSpring;
}>) {
  const { progress, reducedMotion } = useDisclosureState();
  const layout = use(LayoutContext);
  const ref = useRef<HTMLDivElement | null>(null);
  const origin = useMotionValue({ x: 0, y: 0 });
  const lag = useTransform(progress, (value) => getStaggerProgress({ progress: value, index, count, stagger }));
  const targetX = useTransform(() => (1 - lag.get()) * origin.get().x);
  const targetY = useTransform(() => (1 - lag.get()) * origin.get().y);
  const x = useSpring(targetX, spring);
  const y = useSpring(targetY, spring);
  const scale = useTransform(lag, (value) => scaleFrom + (1 - scaleFrom) * value);

  useLayoutEffect(() => {
    const element = ref.current;
    if (element === null) return;
    origin.set({
      x: (layout.width - element.offsetWidth) / 2 - element.offsetLeft,
      y: (layout.height - element.offsetHeight) / 2 - element.offsetTop,
    });
  }, [layout.width, layout.height, origin, index, count]);

  return <motion.div {...props} ref={ref} style={{
    ...style, minWidth: 0, opacity: lag,
    x: reducedMotion ? 0 : x, y: reducedMotion ? 0 : y, scale: reducedMotion ? 1 : scale,
  }}>{children}</motion.div>;
}

export const NestedUnfold = { Root: NestedUnfoldRoot, Trigger: DisclosureTrigger, Viewport: NestedUnfoldViewport, Item: NestedUnfoldItem };
