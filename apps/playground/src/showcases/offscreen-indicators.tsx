import {
  findInfiniteCanvasWindow,
  getInfiniteCanvasOffscreenIndicators,
  useInfiniteCanvasDispatch,
  useInfiniteCanvasState,
} from "@hyphened/infinite-canvas";

/** The framework projects indicators. The playground limits and renders them. */
const INDICATOR_LIMIT = 12;

/** The inset keeps rotated chevrons inside the viewport edge. */
const INDICATOR_INSET_PX = 28;

/** The margin hides near-edge indicators before the sort and limit steps. */
const INDICATOR_MARGIN_PX = 96;

export function CanvasOffscreenIndicators() {
  // Indicators follow camera changes, so they subscribe to all state.
  const state = useInfiniteCanvasState();
  const dispatch = useInfiniteCanvasDispatch();

  const indicators = getInfiniteCanvasOffscreenIndicators(state, {
    insetPx: INDICATOR_INSET_PX,
    limit: INDICATOR_LIMIT,
    marginPx: INDICATOR_MARGIN_PX,
  });

  if (indicators.length === 0) {
    return null;
  }

  return (
    <div className="pointer-events-none absolute inset-0 z-[60]">
      {indicators.map((indicator) => (
        <button
          className={[
            "pointer-events-auto absolute grid h-6 w-6 place-items-center rounded-full border backdrop-blur transition-colors",
            indicator.isActive
              ? "border-emerald-300/70 bg-emerald-300/15 text-emerald-200"
              : "border-white/15 bg-popover/80 text-white/55 hover:border-white/35 hover:text-white/85",
          ].join(" ")}
          key={`${indicator.kind}:${indicator.id}`}
          onClick={() => {
            dispatch({
              request: {
                behavior: { type: "center" },
                target: { rect: indicator.rect, type: "rect" },
              },
              type: "camera.navigate",
            });

            if (indicator.kind === "window") {
              dispatch({ type: "window.focus", windowId: indicator.id });
            }
          }}
          onPointerDown={(event) => {
            // stopPropagation blocks the button event before the canvas can start a marquee.
            event.stopPropagation();
          }}
          style={{
            // The style centers the button on the projected point.
            left: indicator.point.x,
            top: indicator.point.y,
            transform: "translate(-50%, -50%)",
          }}
          title={
            indicator.kind === "group"
              ? `Group ${indicator.id} — ${Math.round(indicator.distancePx)}px away`
              : `${findInfiniteCanvasWindow(state, indicator.id)?.title ?? indicator.id} — ${Math.round(indicator.distancePx)}px away`
          }
          type="button"
        >
          {/* The chevron points right. This direction matches angle zero. */}
          <svg
            aria-hidden="true"
            className="h-3 w-3"
            fill="none"
            stroke="currentColor"
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth="2.5"
            style={{ transform: `rotate(${indicator.angle}rad)` }}
            viewBox="0 0 24 24"
          >
            <path d="M8 4l8 8-8 8" />
          </svg>
        </button>
      ))}

      <div className="absolute bottom-4 left-1/2 -translate-x-1/2 rounded-full border border-border bg-popover/80 px-2.5 py-1 font-mono text-[9px] tracking-wider text-muted-foreground uppercase backdrop-blur">
        {indicators.length === INDICATOR_LIMIT
          ? `${INDICATOR_LIMIT} nearest offscreen`
          : `${indicators.length} offscreen`}
      </div>
    </div>
  );
}
