import { useRender } from "@base-ui/react/use-render";
import { useValue } from "@legendapp/state/react";
import { useMeasure } from "@legendapp/state/react-hooks/useMeasure";
import { motion, useTransform, type HTMLMotionProps } from "motion/react";
import { Children, isValidElement, useImperativeHandle, useLayoutEffect, useRef, type ComponentProps, type ReactNode } from "react";

import { tv } from "../../tv.ts";
import {
  DisclosureRoot,
  DisclosureTrigger,
  DisclosureItem,
  useDisclosureState,
  useMotionPresence,
  useSpringSize,
  type DisclosureTargetSize,
} from "./disclosure.tsx";

const expand = tv({
  slots: {
    viewport: "min-w-0",
    region: "min-w-0 overflow-hidden",
    content: "flex min-w-0 flex-col",
    item: "empty:hidden",
  },
});

export type ExpandInPlaceViewportProps = Omit<HTMLMotionProps<"div">, "children" | "animate" | "initial" | "exit" | "layout"> & {
  readonly summary?: ReactNode;
  readonly children: ReactNode;
  readonly summaryProps?: Omit<ComponentProps<"div">, "children">;
  readonly contentProps?: Omit<ComponentProps<"div">, "children">;
  readonly stagger?: number;
  readonly distance?: number;
  readonly gap?: number;
  readonly onTargetSizeChange?: (size: DisclosureTargetSize) => void;
};

/** Trades summary height for detail height without changing width. */
function ExpandInPlaceViewport({
  summary,
  children,
  summaryProps,
  contentProps,
  stagger = 0.1,
  distance = 10,
  gap = 12,
  onTargetSizeChange,
  ref,
  className,
  ...props
}: ExpandInPlaceViewportProps) {
  const { open, progress, panelId } = useDisclosureState();
  const styles = expand();
  const viewportRef = useRef<HTMLDivElement | null>(null);
  useImperativeHandle(ref, () => viewportRef.current!, []);
  const summaryRef = useRef<HTMLDivElement | null>(null);
  const contentRef = useRef<HTMLDivElement | null>(null);
  // Legend v3's ref declaration predates nullable React 19 refs.
  const summarySize$ = useMeasure(summaryRef as Parameters<typeof useMeasure>[0]);
  const contentSize$ = useMeasure(contentRef as Parameters<typeof useMeasure>[0]);
  const measuredSummary = useValue(summarySize$.height);
  const measuredContent = useValue(contentSize$.height);
  const targetHeight = open ? measuredContent : (measuredSummary ?? 0);
  useLayoutEffect(() => {
    if (targetHeight === undefined || viewportRef.current === null) return;
    onTargetSizeChange?.({ height: targetHeight, element: viewportRef.current });
  }, [targetHeight, onTargetSizeChange]);
  const summarySize = useSpringSize(measuredSummary);
  const contentSize = useSpringSize(measuredContent);
  const summaryHeight = useTransform(() => Math.max(0, summarySize.get() * (1 - progress.get())));
  const contentHeight = useTransform(() => Math.max(0, contentSize.get() * progress.get()));
  const summaryOpacity = useTransform(progress, (value) => Math.max(0, Math.min(1, 1 - value * 1.8)));
  const contentOpacity = useTransform(progress, (value) => Math.max(0, Math.min(1, value * 1.6)));
  const summaryInteractive = useMotionPresence({ progress: summaryOpacity, active: !open, ref: summaryRef });
  const contentInteractive = useMotionPresence({ progress: contentOpacity, active: open, ref: contentRef });
  const items = Children.toArray(children);

  const summaryElement = useRender({
    defaultTagName: "div",
    ref: [summaryRef, summaryProps?.ref ?? null],
    props: { ...summaryProps, "aria-hidden": open, inert: !summaryInteractive, children: summary },
  });
  const contentElement = useRender({
    defaultTagName: "div",
    ref: [contentRef, contentProps?.ref ?? null],
    props: {
      ...contentProps,
      className: styles.content({ className: contentProps?.className }),
      style: { ...contentProps?.style, gap },
      "aria-hidden": !open,
      inert: !contentInteractive,
      children: items.map((child, index) => (
        <DisclosureItem
          count={items.length}
          distance={distance}
          index={index}
          key={isValidElement(child) ? child.key : index}
          stagger={stagger}
        >
          {child}
        </DisclosureItem>
      )),
    },
  });

  return (
    <motion.div {...props} ref={viewportRef} className={styles.viewport({ className })} data-slot="expand-in-place" id={panelId}>
      {summary === undefined ? null : (
        <motion.div className={styles.region()} style={{ height: measuredSummary === undefined ? (open ? 0 : "auto") : summaryHeight, opacity: summaryOpacity }}>
          {summaryElement}
        </motion.div>
      )}
      <motion.div className={styles.region()} style={{ height: measuredContent === undefined ? (open ? "auto" : 0) : contentHeight, opacity: contentOpacity }}>
        {contentElement}
      </motion.div>
    </motion.div>
  );
}

export const ExpandInPlace = {
  Root: DisclosureRoot,
  Trigger: DisclosureTrigger,
  Viewport: ExpandInPlaceViewport,
};
