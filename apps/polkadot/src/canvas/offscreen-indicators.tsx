import {
  findInfiniteCanvasWindow,
  getInfiniteCanvasGroupTitle,
  getInfiniteCanvasOffscreenIndicators,
  useInfiniteCanvasDispatch,
  useInfiniteCanvasState,
  type InfiniteCanvasState,
} from "@hyphened/infinite-canvas/legacy";
import { tv } from "ui/tv";

import { FLOATING_SURFACE } from "../material";
import type { WindowKind } from "./window-registry";

const INDICATOR_LIMIT = 5;

const RING_INSET_PX = 26;

function getIndicatorTitle(
  indicator: Readonly<{ id: string; kind: string }>,
  state: InfiniteCanvasState<WindowKind>,
): string {
  if (indicator.kind !== "group") {
    return findInfiniteCanvasWindow(state, indicator.id)?.title ?? "Window";
  }

  const group = state.groups.find((candidate) => candidate.id === indicator.id);

  return group === undefined ? "Group" : getInfiniteCanvasGroupTitle(group, state.windows);
}

const indicators = tv({
  slots: {
    arrow: "size-3",
    badge:
      "pointer-events-none absolute -top-1 -right-1 grid h-3.5 min-w-3.5 place-items-center rounded-[var(--radius-pill)] bg-[var(--surface-raised)] px-1 font-mono text-[9px] leading-none tabular-nums text-[var(--ink-muted)]",
    chip: `pointer-events-auto absolute grid size-6 -translate-x-1/2 -translate-y-1/2 place-items-center rounded-[var(--radius-pill)] ${FLOATING_SURFACE} text-[var(--ink-faint)] shadow-[var(--lift-1)] transition-colors duration-100 ease-[var(--ease-swift)] hover:text-[var(--ink)]`,
    root: "pointer-events-none absolute inset-0 z-70",
  },
  variants: {
    active: {
      true: { chip: "bg-[var(--accent-wash)] text-[var(--accent)]" },
    },
  },
});

export { getIndicatorTitle };

export function OffscreenIndicators() {
  const dispatch = useInfiniteCanvasDispatch<WindowKind>();
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
        const title = getIndicatorTitle(indicator, state);

        const label =
          indicator.targetCount > 1
            ? `Go to ${title}, and ${String(indicator.targetCount - 1)} more this way`
            : `Go to ${title}`;

        return (
          <button
            aria-label={label}
            className={styles.chip({ active: indicator.isActive })}
            key={`${indicator.kind}:${indicator.id}`}
            onClick={() => {
              dispatch({
                request: {
                  behavior: { type: "center" },
                  target: { rect: indicator.rect, type: "rect" },
                },
                type: "camera.navigate",
              });
            }}
            style={{ left: indicator.point.x, top: indicator.point.y }}
            title={label}
            type="button"
          >
            <svg
              className={styles.arrow()}
              style={{ transform: `rotate(${String(indicator.angle)}rad)` }}
              viewBox="0 0 12 12"
            >
              <path d="M2 6h7M6 3l3 3-3 3" fill="none" stroke="currentColor" strokeWidth="1.5" />
            </svg>
            {indicator.targetCount > 1 ? (
              <span className={styles.badge()}>{indicator.targetCount}</span>
            ) : null}
          </button>
        );
      })}
    </div>
  );
}
