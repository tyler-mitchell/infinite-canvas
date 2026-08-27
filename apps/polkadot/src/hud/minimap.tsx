import {
  getInfiniteCanvasMinimapLayout,
  getInfiniteCanvasMinimapWorldPoint,
  useInfiniteCanvasActions,
  useInfiniteCanvasState,
  type InfiniteCanvasMinimapLayout,
} from "@hyphened/infinite-canvas";
import { Map, X } from "lucide-react";
import { useRef } from "react";
import { Button } from "ui";
import { tv } from "ui/tv";

import type { WindowKind } from "../canvas/window-registry";
import { useHudOccluder } from "./hud-occluders";
import { HudSurface } from "./hud-surfaces";

/**
 * Where everything is, and where you are in it.
 *
 * An infinite canvas has a failure mode nothing bounded has: pan far enough and every landmark is
 * gone, with no scrollbar to say how far. The library rail answers "what exists" and the offscreen
 * chips answer "which way is that one" — neither answers "what shape is my canvas", which is the
 * question you have while moving rather than after arriving.
 *
 * **Every number here is the framework's.** `getInfiniteCanvasMinimapLayout` projects the windows,
 * the groups and the camera's own visible rect into this box, and
 * `getInfiniteCanvasMinimapWorldPoint` inverts that projection for a click. Two of its decisions
 * are the ones a hand-rolled version gets wrong: the camera's rect is unioned into the bounds, so
 * panning into empty space shrinks the content rather than pushing the indicator out of the map —
 * which is exactly the moment you reached for it — and the scale is uniform on both axes, because
 * a map that lies about aspect ratio is worse than no map. The product owns what a window looks
 * like at two pixels wide, and what dragging across the map does.
 *
 * This is the first time either function has been drawn by anything; `docs/API.md` carries the
 * `minimap` module as *unobserved* on exactly that ground.
 */

/**
 * Small enough to be peripheral, large enough that a note is not a speck.
 *
 * The height is what the app pays for in `viewportInsets` while the map is open, so it is the
 * number to argue with, not the width — the right edge is left alone deliberately.
 */
const MINIMAP_SIZE = { height: 104, width: 156 } as const;

/** Breathing room inside the box, so a window on the rim is not clipped by its own border. */
const MINIMAP_PADDING_PX = 6;

/**
 * The band the app reserves along the bottom while the map is open — now only the framework's own
 * navigation rail, not the map.
 *
 * This used to be `MINIMAP_SIZE.height + 64`, because `viewportInsets` takes one number per edge
 * and so could only describe the map as a full-width strip. Overstating it wrote off 168 of 900
 * pixels — 19% of the viewport — to reserve room for a box covering about 1%. The map declares its
 * own rect through `viewportOccluders` now, so what remains here is the part that genuinely does
 * span the edge.
 */
const MINIMAP_INSET = 64;

const minimap = tv({
  slots: {
    /** The map itself is not a button, so its own close control has to opt back in. */
    close: "absolute top-1 right-1 z-10",
    frame:
      "relative overflow-hidden rounded-[var(--radius-md)] bg-[var(--surface)] shadow-[var(--lift-2)] inset-ring-1 inset-ring-[var(--edge-light)] backdrop-blur-2xl",
    group: "fill-[var(--surface-hover)]",
    /** Cross-hatched with the ground so the map reads as a window onto the canvas, not a card. */
    plate: "block cursor-crosshair touch-none bg-[var(--ground)]",
    window: "transition-[fill] duration-100 ease-[var(--ease-swift)]",
    /**
     * Where the camera is looking.
     *
     * A stroked outline rather than a filled box: the viewport covers most of the map at ordinary
     * zoom, and a fill would hide the very windows the map exists to show. This is the one place
     * an outline is right — it is a frame around content, not a surface pretending to have edges.
     */
    viewport: "fill-none stroke-[var(--accent)] stroke-[1.5]",
  },
  variants: {
    state: {
      active: { window: "fill-[var(--accent)]" },
      idle: { window: "fill-[var(--ink-faint)]" },
      selected: { window: "fill-[var(--ink)]" },
    },
  },
});

/** The three states a window can be in on the map, named rather than stacked into conditions. */
const getWindowState = (window: InfiniteCanvasMinimapLayout["windows"][number]) => {
  if (window.isActive) {
    return "active" as const;
  }

  return window.isSelected ? ("selected" as const) : ("idle" as const);
};

/**
 * A pointer anywhere on the map, in the map's own pixels.
 *
 * Read from the SVG's bounding rect rather than from `offsetX`, which is relative to whatever
 * child element the pointer happens to be over — a two-pixel window rect included — and would make
 * a click on a note mean something different from a click beside it.
 */
const getMinimapPoint = (event: React.PointerEvent<SVGSVGElement>) => {
  const bounds = event.currentTarget.getBoundingClientRect();

  return { x: event.clientX - bounds.left, y: event.clientY - bounds.top };
};

export function Minimap({
  onClose,
  open,
  onOpen,
}: Readonly<{ onClose: () => void; onOpen: () => void; open: boolean }>) {
  const actions = useInfiniteCanvasActions<WindowKind>();
  const state = useInfiniteCanvasState<WindowKind>();
  const styles = minimap();
  /*
   * The map declares the rect it covers, which is what stops it being described as a band.
   *
   * Only while it is open: closed, it is a single icon button that windows may sit under happily,
   * and reserving a corner for a thing that is not there is the same overstatement in miniature.
   */
  const frameRef = useRef<HTMLDivElement>(null);

  useHudOccluder("minimap", frameRef, open);

  const layout = open
    ? getInfiniteCanvasMinimapLayout(state, MINIMAP_SIZE, {
        paddingPx: MINIMAP_PADDING_PX,
      })
    : null;

  /**
   * Centre the camera where the pointer is, and keep centring while it moves.
   *
   * A minimap you can only click is a minimap you use twice. Scrubbing is what people expect from
   * one, and it costs nothing extra here: the framework's inverse projection is pure, and
   * `view.navigate` to a point is idempotent, so every move is the same call with a new argument.
   *
   * Centre rather than fit, for the reason the offscreen chips centre: the user asked to go
   * *there*, and rescaling their canvas to answer a "where" gesture is a bigger edit than they made.
   */
  const navigate = (event: React.PointerEvent<SVGSVGElement>) => {
    if (layout === null) {
      return;
    }

    actions.executeCommand({
      request: {
        behavior: { type: "center" },
        target: {
          point: getInfiniteCanvasMinimapWorldPoint(layout, getMinimapPoint(event)),
          type: "point",
        },
      },
      type: "view.navigate",
    });
  };

  if (!open) {
    return (
      <HudSurface anchor="bottom-right-above" persistent>
        <Button aria-label="Show the map" onClick={onOpen} size="icon-sm" title="Show the map">
          <Map />
        </Button>
      </HudSurface>
    );
  }

  return (
    <HudSurface anchor="bottom-right-above" persistent>
      {/*
        Persistent, for the same reason the library rail is: the canvas has reserved this band
        through `viewportInsets`, so the map is over nothing, and fading it during a drag would
        make the reserved gap read as a bug rather than as a panel. It is also the surface most
        worth having while the camera is moving, which is when every other surface recedes.
      */}
      <div className={styles.frame()} ref={frameRef}>
        <Button
          aria-label="Hide the map"
          className={styles.close()}
          onClick={onClose}
          size="icon-sm"
          title="Hide the map"
          variant="ghost"
        >
          <X />
        </Button>
        <svg
          aria-label="Canvas overview"
          className={styles.plate()}
          height={MINIMAP_SIZE.height}
          onPointerDown={(event) => {
            // Capture, so a scrub that leaves the box keeps steering instead of stopping at the rim.
            event.currentTarget.setPointerCapture(event.pointerId);
            navigate(event);
          }}
          onPointerMove={(event) => {
            if (event.currentTarget.hasPointerCapture(event.pointerId)) {
              navigate(event);
            }
          }}
          role="img"
          width={MINIMAP_SIZE.width}
        >
          {layout === null
            ? null
            : [
                ...layout.groups.map((group) => (
                  <rect
                    className={styles.group()}
                    height={group.rect.height}
                    key={`group:${group.groupId}`}
                    rx={1}
                    width={group.rect.width}
                    x={group.rect.x}
                    y={group.rect.y}
                  />
                )),
                ...layout.windows.map((window) => (
                  <rect
                    className={styles.window({ state: getWindowState(window) })}
                    height={Math.max(window.rect.height, 1.5)}
                    key={`window:${window.windowId}`}
                    rx={1}
                    width={Math.max(window.rect.width, 1.5)}
                    x={window.rect.x}
                    y={window.rect.y}
                  />
                )),
                <rect
                  className={styles.viewport()}
                  height={layout.viewport.height}
                  key="viewport"
                  rx={2}
                  width={layout.viewport.width}
                  x={layout.viewport.x}
                  y={layout.viewport.y}
                />,
              ]}
        </svg>
      </div>
    </HudSurface>
  );
}

export { MINIMAP_INSET };
