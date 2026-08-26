import {
  getInfiniteCanvasOffscreenIndicators,
  useInfiniteCanvasActions,
  useInfiniteCanvasState,
} from "@hyphened/infinite-canvas";
import { tv } from "ui/tv";

import type { WindowKind } from "./window-registry";

/**
 * Where the things you cannot see went.
 *
 * A bounded document can only scroll, so a lost window is always one `Home` away. On an infinite
 * canvas it can be anywhere, and fit-all is a blunt instrument: it moves the camera off everything
 * else in order to find one thing. These are the peripheral answer — a bearing and a distance,
 * pinned to the edge of what you can see.
 *
 * Every number here is the framework's. `getInfiniteCanvasOffscreenIndicators` decides what counts
 * as one thing (a docked group is one indicator, not four stacked on the same pixel), sorts by how
 * far each is from the eye rather than from the camera's origin, and projects onto a ring that sits
 * inside whatever the app's own chrome leaves. What is left for the product is the part a product
 * should own: what an arrow looks like, how many are worth showing, and what happens when you click
 * one.
 */

/**
 * Five, because this is peripheral vision rather than a list.
 *
 * The framework returns everything offscreen, nearest first. On a canvas of two hundred notes that
 * is two hundred arrows, which is a border rather than information — and the ones that matter are
 * always the near ones. The rail is where you go to see everything.
 */
const INDICATOR_LIMIT = 5;

/** Pulled in far enough that a chip sits fully inside the edge rather than half over it. */
const RING_INSET_PX = 26;

const indicators = tv({
  slots: {
    arrow: "size-3",
    /**
     * Centred on its own point, then the arrow alone is rotated.
     *
     * Rotating the chip would rotate its text and its shadow with it — the shadow is what makes it
     * read as floating above the canvas, and a shadow pointing sideways reads as a mistake.
     */
    chip: "pointer-events-auto absolute grid size-6 -translate-x-1/2 -translate-y-1/2 place-items-center rounded-[var(--radius-pill)] bg-[var(--surface)] text-[var(--ink-faint)] shadow-[var(--lift-1)] inset-ring-1 inset-ring-[var(--edge-light)] backdrop-blur-2xl transition-colors duration-100 ease-[var(--ease-swift)] hover:text-[var(--ink)]",
    root: "pointer-events-none absolute inset-0 z-70",
  },
  variants: {
    active: {
      // The window you were last working in, so returning to it is one glance rather than a hunt.
      true: { chip: "bg-[var(--accent-wash)] text-[var(--accent)]" },
    },
  },
});

export function OffscreenIndicators() {
  const actions = useInfiniteCanvasActions<WindowKind>();
  const state = useInfiniteCanvasState<WindowKind>();
  const styles = indicators();
  const offscreen = getInfiniteCanvasOffscreenIndicators(state, {
    insetPx: RING_INSET_PX,
    limit: INDICATOR_LIMIT,
  });

  if (offscreen.length === 0) {
    return null;
  }

  return (
    <div className={styles.root()}>
      {offscreen.map((indicator) => {
        const title =
          indicator.kind === "group"
            ? (state.groups.find((group) => group.id === indicator.id)?.title ?? "Group")
            : (state.windows.find((window) => window.id === indicator.id)?.title ?? "Window");

        return (
          <button
            aria-label={`Go to ${title}`}
            className={styles.chip({ active: indicator.isActive })}
            key={`${indicator.kind}:${indicator.id}`}
            onClick={() => {
              actions.executeCommand({
                // Centre rather than fit: the user asked to go *there*, not to rescale everything
                // around it, and changing their zoom to answer a "where is it" gesture is a
                // bigger edit than they made.
                request: {
                  behavior: { type: "center" },
                  target: { rect: indicator.rect, type: "rect" },
                },
                type: "view.navigate",
              });
            }}
            // Screen pixels from the framework; nothing here recomputes a projection.
            style={{ left: indicator.point.x, top: indicator.point.y }}
            title={`Go to ${title}`}
            type="button"
          >
            {/*
              One arrow, rotated. `angle` is `Math.atan2` as the framework gives it: 0 points right
              and it grows clockwise, which is what a CSS rotation of a right-pointing glyph wants,
              so no sign correction belongs here.
            */}
            <svg
              className={styles.arrow()}
              style={{ transform: `rotate(${String(indicator.angle)}rad)` }}
              viewBox="0 0 12 12"
            >
              <path d="M2 6h7M6 3l3 3-3 3" fill="none" stroke="currentColor" strokeWidth="1.5" />
            </svg>
          </button>
        );
      })}
    </div>
  );
}
