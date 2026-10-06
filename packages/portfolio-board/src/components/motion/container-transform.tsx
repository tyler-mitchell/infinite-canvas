import { useValue } from "@legendapp/state/react";
import { useMeasure } from "@legendapp/state/react-hooks/useMeasure";
import { motion, useTransform } from "motion/react";
import { Children, useRef, type ReactNode } from "react";

import {
  DISCLOSURE_SPRINGS,
  DisclosureItem,
  DisclosureRoot,
  DisclosureTrigger,
  useDisclosureState,
  useMotionPresence,
  useSpringSize,
  type DisclosureRootProps,
} from "./disclosure.tsx";

function ContainerTransformRoot(props: DisclosureRootProps) {
  return <DisclosureRoot {...props} spring={props.spring ?? DISCLOSURE_SPRINGS.transform} />;
}

function ContainerTransformViewport({
  summary,
  children,
  collapsedRadius = 14,
  expandedRadius = 12,
  detailStart = 0.42,
  stagger = 0.1,
  distance = 12,
  gap = 12,
}: Readonly<{
  summary: ReactNode;
  children: ReactNode;
  collapsedRadius?: number;
  expandedRadius?: number;
  detailStart?: number;
  stagger?: number;
  distance?: number;
  gap?: number;
}>) {
  const { open, progress, panelId } = useDisclosureState();
  const viewportRef = useRef<HTMLDivElement | null>(null);
  const summaryRef = useRef<HTMLDivElement | null>(null);
  const contentRef = useRef<HTMLDivElement | null>(null);
  const viewportSize$ = useMeasure(viewportRef as Parameters<typeof useMeasure>[0]);
  const summarySize$ = useMeasure(summaryRef as Parameters<typeof useMeasure>[0]);
  const contentSize$ = useMeasure(contentRef as Parameters<typeof useMeasure>[0]);
  const hostWidth = useValue(viewportSize$.width);
  const summarySize = useValue(summarySize$);
  const contentSize = useValue(contentSize$);
  const collapsedHeight = useSpringSize(summarySize.height);
  const expandedHeight = useSpringSize(contentSize.height);
  const collapsedWidth = useSpringSize(summarySize.width);
  const expandedWidth = useSpringSize(hostWidth);
  const height = useTransform(() =>
    Math.max(
      0,
      collapsedHeight.get() + (expandedHeight.get() - collapsedHeight.get()) * progress.get(),
    ),
  );
  const width = useTransform(() =>
    Math.max(
      0,
      collapsedWidth.get() + (expandedWidth.get() - collapsedWidth.get()) * progress.get(),
    ),
  );
  const x = useTransform(() => (expandedWidth.get() - width.get()) / 2);
  const radius = useTransform(progress, [0, 1], [collapsedRadius, expandedRadius]);
  const summaryOpacity = useTransform(progress, (value) =>
    Math.max(0, Math.min(1, 1 - value * 2.4)),
  );
  const detailOpacity = useTransform(progress, (value) =>
    Math.max(0, Math.min(1, (value - detailStart) / (1 - detailStart))),
  );
  const summaryInteractive = useMotionPresence({
    progress: summaryOpacity,
    active: !open,
    ref: summaryRef,
  });
  const detailInteractive = useMotionPresence({
    progress: detailOpacity,
    active: open,
    ref: contentRef,
  });
  const items = Children.toArray(children);

  return (
    <motion.div
      ref={viewportRef}
      id={panelId}
      data-slot="container-transform"
      style={{ position: "relative", height, overflow: "hidden" }}
    >
      <motion.div
        data-slot="container-transform-surface"
        style={{
          position: "absolute",
          insetBlockStart: 0,
          insetInlineStart: 0,
          width,
          height,
          x,
          borderRadius: radius,
          overflow: "hidden",
        }}
      />
      <motion.div
        ref={summaryRef}
        inert={!summaryInteractive}
        aria-hidden={open}
        style={{
          position: "absolute",
          insetBlockStart: 0,
          insetInlineStart: 0,
          width: "max-content",
          maxWidth: "100%",
          x,
          opacity: summaryOpacity,
        }}
      >
        {summary}
      </motion.div>
      <motion.div
        ref={contentRef}
        inert={!detailInteractive}
        aria-hidden={!open}
        style={{
          display: "flex",
          flexDirection: "column",
          gap,
          width: "100%",
          opacity: detailOpacity,
        }}
      >
        {Children.map(items, (child, index) => (
          <DisclosureItem
            index={index}
            count={items.length}
            stagger={stagger}
            distance={distance}
            start={detailStart}
          >
            {child}
          </DisclosureItem>
        ))}
      </motion.div>
    </motion.div>
  );
}

export const ContainerTransform = {
  Root: ContainerTransformRoot,
  Trigger: DisclosureTrigger,
  Viewport: ContainerTransformViewport,
};
