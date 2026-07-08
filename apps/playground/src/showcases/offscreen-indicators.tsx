import {
  getInfiniteCanvasOffscreenIndicators,
  useInfiniteCanvasActions,
  useInfiniteCanvasState,
} from "@infinite-canvas/react";

/**
 * Arrows on the viewport edge pointing at everything you have panned away from.
 *
 * `getInfiniteCanvasOffscreenIndicators` hands over the bearing, the distance, and the point on
 * the edge to draw at. Everything below is this playground's taste, exactly as with the minimap:
 * the framework owns the projection because that is the part a consumer cannot easily get right,
 * and a chevron is the part they can.
 *
 * Click one to fly to it. `behavior: "center"` rather than `"fit"` — a click on an arrow says
 * *"take me there"*, not *"and change my zoom while you're at it"*. Zoom is a thing the user set,
 * and quietly overwriting it is the sort of helpfulness that makes a canvas feel possessed.
 */

/**
 * Twelve, because the arrows exist to be scanned in the periphery, and a ring of a hundred and
 * forty is a border rather than a hint. The framework's `limit` is unbounded by default and this
 * is the consumer picking one — which is exactly why the count is *rendered*. A silent cap reads
 * as "that is everything" precisely when it isn't.
 */
const INDICATOR_LIMIT = 12;

/** Screen pixels. Far enough in that a rotated chevron is never half-clipped by the viewport. */
const INDICATOR_INSET_PX = 28;

/**
 * A window one pixel past the edge does not need an arrow: it needs you to look slightly left.
 * The arrow would land on top of the window it points at and jitter as you pan.
 *
 * This is `marginPx` rather than a filter on `distancePx`, and the difference matters twice.
 * The framework applies the margin *before* it sorts and caps, so `indicators.length` still
 * means what the label below claims it means — filtering afterwards would strip the nearest
 * entries out of an already-capped list and undercount. And a margin measures the target's
 * *edge* against the viewport's, so a window mostly offscreen still gets an arrow even though
 * its centre is far away, which a centre-distance test would have suppressed.
 */
const INDICATOR_MARGIN_PX = 96;

export function CanvasOffscreenIndicators() {
  // Follows the camera, so it subscribes to everything. Correct for an overlay — it is expected
  // to re-render per frame — and wrong for a window body, which must not.
  const state = useInfiniteCanvasState();
  const actions = useInfiniteCanvasActions();

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
            actions.navigateToRect({ behavior: { type: "center" }, rect: indicator.rect });

            if (indicator.kind === "window") {
              actions.focusWindow(indicator.id);
            }
          }}
          onPointerDown={(event) => {
            // The overlay sits inside the canvas's React tree; without this the pointerdown
            // reaches the canvas root and starts a marquee behind the arrow.
            event.stopPropagation();
          }}
          style={{
            // `point` is where the arrow *points from*, so the button is centred on it rather
            // than hung off its top-left corner.
            left: indicator.point.x,
            top: indicator.point.y,
            transform: "translate(-50%, -50%)",
          }}
          title={
            indicator.kind === "group"
              ? `Group ${indicator.id} — ${Math.round(indicator.distancePx)}px away`
              : `${state.windows.find((window) => window.id === indicator.id)?.title ?? indicator.id} — ${Math.round(indicator.distancePx)}px away`
          }
          type="button"
        >
          {/* Rotated by the bearing. The chevron is drawn pointing right (`+x`), which is where
              `angle === 0` points, so the rotation needs no offset. */}
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
