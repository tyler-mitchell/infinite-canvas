import {
  getInfiniteCanvasActivity,
  isInfiniteCanvasActivityTransient,
  useInfiniteCanvasSelector,
  type InfiniteCanvasActivity,
} from "@hyphened/infinite-canvas";
import { AnimatePresence, motion } from "motion/react";
import type { ReactNode } from "react";
import { tv } from "ui/tv";

/**
 * The HUD's frame: where surfaces sit, and when they are allowed to be there.
 *
 * A HUD is not a toolbar. It is a set of surfaces whose presence is a function of what the canvas
 * is doing, and the single rule that matters most is that **chrome recedes while the pointer is
 * down**. A rail hovering over the window you are dragging is the most common way canvas chrome
 * ruins a canvas: it occludes the thing you are positioning, at exactly the moment you are
 * judging where it goes.
 *
 * `getInfiniteCanvasActivity` answers that from the framework, so the rule lives in one place
 * rather than being re-derived from `state.interaction?.kind` at every surface.
 *
 * Receding is not hiding. Surfaces stay mounted and keep their layout — they drop opacity and
 * lift slightly out of the way — so nothing reflows when the drag ends and the eye does not have
 * to re-find anything.
 */

const hud = tv({
  slots: {
    // The HUD never eats pointer events as a layer; each surface opts itself back in.
    root: "pointer-events-none absolute inset-0 z-80",
    surface: "pointer-events-auto absolute flex items-center gap-1",
  },
  variants: {
    anchor: {
      "bottom-center": { surface: "bottom-4 left-1/2 -translate-x-1/2" },
      "bottom-right": { surface: "right-4 bottom-4" },
      /**
       * Clear of the framework's own navigation rail, which puts itself in that corner.
       *
       * The offset is not decoration: the rail is the framework's and this app does not get to
       * move it, so a surface sharing the corner has to sit above it or overlap something the
       * consumer does not own.
       */
      "bottom-right-above": { surface: "right-4 bottom-16" },
      /**
       * A full-height edge, for a surface you work *against* rather than reach for.
       *
       * `items-stretch` rather than the shared `items-center`: a rail this tall has internal
       * structure — a header, a scrolling body — and centring would collapse it to its content.
       */
      left: { surface: "top-3 bottom-3 left-3 items-stretch" },
      "top-left": { surface: "top-3 left-3" },
      "top-right": { surface: "top-3 right-3" },
    },
  },
});

/** Springs, not ramps. Surfaces settle into place the way objects do. */
const SETTLE = { damping: 30, mass: 0.6, stiffness: 420, type: "spring" } as const;

type HudAnchor = NonNullable<Parameters<typeof hud>[0]>["anchor"];

function useCanvasActivity(): InfiniteCanvasActivity {
  return useInfiniteCanvasSelector(getInfiniteCanvasActivity);
}

/**
 * One HUD surface.
 *
 * `present` decides whether it exists at all — that is composition, and it animates in and out.
 * Receding is separate and automatic: any surface not marked `persistent` fades back while an
 * interaction is live, without unmounting.
 */
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
          exit={{ opacity: 0, scale: 0.96, y: 4 }}
          initial={{ opacity: 0, scale: 0.96, y: 6 }}
          // Opacity alone during a drag: no spring, because a surface springing while the user is
          // already moving something reads as a second thing moving.
          transition={receded ? { duration: 0.12 } : SETTLE}
        >
          {children}
        </motion.div>
      ) : null}
    </AnimatePresence>
  );
}

/**
 * The HUD's frame, shrunk to whatever the app's own panels leave.
 *
 * Moving the frame's own left edge rather than padding it: an absolutely positioned child resolves
 * against its containing block's *padding box*, so padding here would have moved nothing. Shrinking
 * the box moves every surface at once — the identity rail stops sitting under the library, and the
 * selection rail re-centres on what the user can see rather than on the element. Doing it per
 * anchor would mean each surface deciding separately, which is how they drift apart.
 *
 * This is the same number the canvas gets as `viewportInsets`. One value, two consumers: the camera
 * aims inside it and the chrome sits inside it.
 */
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
