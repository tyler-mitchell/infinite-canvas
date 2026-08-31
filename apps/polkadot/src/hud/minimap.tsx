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
import { FLOATING_SURFACE } from "../material";
import { useHudOccluder } from "./hud-occluders";
import { HudSurface } from "./hud-surfaces";

const MINIMAP_SIZE = { height: 104, width: 156 } as const;

const MINIMAP_PADDING_PX = 6;

const minimap = tv({
  slots: {
    close: "absolute top-1 right-1 z-10",
    frame: `relative overflow-hidden rounded-[var(--radius-md)] ${FLOATING_SURFACE} shadow-[var(--lift-2)]`,
    group: "fill-[var(--surface-hover)]",
    hairline: "fill-[var(--edge-light)]",
    plate: "block cursor-crosshair touch-none bg-[var(--ground-sunken)]",
    window: "transition-[fill] duration-100 ease-[var(--ease-swift)]",
    viewport: "fill-none stroke-[var(--accent)] stroke-[1.5]",
  },
  variants: {
    state: {
      active: { window: "fill-[var(--ink)]" },
      idle: { window: "fill-[var(--ink-faint)]" },
      selected: { window: "fill-[var(--ink-muted)]" },
    },
  },
});

const getWindowState = (window: InfiniteCanvasMinimapLayout["windows"][number]) => {
  if (window.isActive) {
    return "active" as const;
  }

  return window.isSelected ? ("selected" as const) : ("idle" as const);
};

// offsetX uses the child target, so map coordinates use the SVG rectangle.
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
  const frameRef = useRef<HTMLDivElement>(null);

  const layout = getInfiniteCanvasMinimapLayout(state, MINIMAP_SIZE, {
    paddingPx: MINIMAP_PADDING_PX,
  });

  useHudOccluder("minimap", frameRef, open && layout !== null);

  if (layout === null) {
    return null;
  }

  const navigate = (event: React.PointerEvent<SVGSVGElement>) => {
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
          {[
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
            layout.viewport === null ? null : (
              <rect
                className={styles.viewport()}
                height={layout.viewport.height}
                key="viewport"
                rx={2}
                width={layout.viewport.width}
                x={layout.viewport.x}
                y={layout.viewport.y}
              />
            ),
            <rect
              className={styles.hairline()}
              height={1}
              key="hairline"
              width={MINIMAP_SIZE.width}
              x={0}
              y={0}
            />,
          ]}
        </svg>
      </div>
    </HudSurface>
  );
}
