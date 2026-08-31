import {
  getInfiniteCanvasActivity,
  isInfiniteCanvasActivityTransient,
  useInfiniteCanvasSelector,
  type InfiniteCanvasActivity,
} from "@hyphened/infinite-canvas";
import { AnimatePresence, motion } from "motion/react";
import type { ReactNode } from "react";
import { tv } from "ui/tv";

import { BARE_CORNER_PX, GAP_PX } from "./hud-clearance";

const hud = tv({
  slots: {
    root: "pointer-events-none absolute inset-0 z-80",
    surface: "pointer-events-auto absolute flex items-center gap-1",
  },
  variants: {
    anchor: {
      "bottom-center": { surface: "bottom-4 left-1/2 -translate-x-1/2" },
      "bottom-center-above": { surface: "bottom-16 left-1/2 -translate-x-1/2" },
      "bottom-right": { surface: "right-4 bottom-4" },
      "bottom-right-above": { surface: "right-4" },
      left: { surface: "top-3 bottom-3 left-3 items-stretch" },
      "top-left": { surface: "top-3 left-3" },
      "top-right": { surface: "top-3 right-3" },
    },
  },
});

const SETTLE = { damping: 30, mass: 0.6, stiffness: 420, type: "spring" } as const;

type HudAnchor = NonNullable<Parameters<typeof hud>[0]>["anchor"];

function useCanvasActivity(): InfiniteCanvasActivity {
  return useInfiniteCanvasSelector(getInfiniteCanvasActivity);
}

function HudSurface({
  anchor,
  children,
  persistent = false,
  present = true,
}: Readonly<{
  anchor: HudAnchor;
  children: ReactNode;
  persistent?: boolean;
  present?: boolean;
}>) {
  const activity = useCanvasActivity();
  const receded = !persistent && isInfiniteCanvasActivityTransient(activity);
  const styles = hud({ anchor });

  return (
    <AnimatePresence>
      {present ? (
        <motion.div
          animate={{ opacity: receded ? 0.25 : 1, scale: 1, y: 0 }}
          className={styles.surface()}
          data-activity={activity}
          style={
            anchor === "bottom-right-above"
              ? { bottom: `calc(var(--icx-hud-extent-bottom, ${BARE_CORNER_PX}px) + ${GAP_PX}px)` }
              : undefined
          }
          exit={{ opacity: 0, scale: 0.96, y: 4 }}
          initial={{ opacity: 0, scale: 0.96, y: 6 }}
          transition={receded ? { duration: 0.12 } : SETTLE}
        >
          {children}
        </motion.div>
      ) : null}
    </AnimatePresence>
  );
}

function HudRoot({
  children,
  insetLeft = 0,
}: Readonly<{ children: ReactNode; insetLeft?: number }>) {
  const styles = hud();

  return (
    <div className={styles.root()} style={{ left: insetLeft }}>
      {children}
    </div>
  );
}

export { HudRoot, HudSurface, useCanvasActivity };
export type { HudAnchor };
