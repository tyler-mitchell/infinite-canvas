import {
  isSelectionTargetSelected,
  useInfiniteCanvasState,
  worldPointToScreenPoint,
  type InfiniteCanvasPoint,
} from "@hyphened/infinite-canvas";
import { useValue } from "@legendapp/state/react";
import { tv } from "ui/tv";

import { relations$ } from "../notes/relations";
import { getDrawnConnectors } from "./connector-geometry";
import type { WindowKind } from "./window-registry";

/**
 * Typed relations, drawn between the windows that show them.
 *
 * Geometry is the framework's, and it is derived once in `connector-geometry` so that this layer
 * and the spatial resolver that makes these clickable cannot disagree about where a connector is.
 * Nothing here computes an intersection or a transform.
 *
 * Rendered through `renderUnderlay`, so a connector passes beneath the windows it joins instead of
 * drawing a line across the note you are reading.
 */

const connectors = tv({
  slots: {
    /*
     * No transparent hit-twin under this line, deliberately.
     *
     * A 1.5px stroke is impossible to click, and the obvious fix is a fat invisible polyline over
     * it. That would be a second hit-testing mechanism racing the framework's — and the framework's
     * is better: `createInfiniteCanvasEdgeTargetResolver` catches within a radius measured in
     * *screen* pixels, so a connector stays equally easy to hit at 25% and at 400%, which a DOM
     * stroke drawn in a scaled layer cannot be.
     */
    path: "fill-none stroke-[var(--accent)] transition-[stroke-width,opacity] duration-100 ease-[var(--ease-swift)]",
    svg: "pointer-events-none absolute inset-0 h-full w-full overflow-visible",
  },
  variants: {
    selected: {
      false: { path: "stroke-[1.5] opacity-40" },
      // Selection has to read at a glance on a hairline, so it takes both weight and light.
      true: { path: "stroke-[2.5] opacity-100" },
    },
  },
});

const toPoints = (points: readonly InfiniteCanvasPoint[]) =>
  points.map((point) => `${String(point.x)},${String(point.y)}`).join(" ");

export function ConnectorLayer() {
  const state = useInfiniteCanvasState<WindowKind>();
  const relations = useValue(relations$);
  const styles = connectors();
  const drawn = getDrawnConnectors(state, relations);

  return drawn.length === 0 ? null : (
    <svg className={styles.svg()} data-slot="connector-layer">
      {drawn.map((connector, index) => {
        const points = toPoints(
          connector.points.map((point) =>
            worldPointToScreenPoint(state.camera, state.viewport, point),
          ),
        );

        return (
          <polyline
            className={styles.path({
              selected: isSelectionTargetSelected(state, {
                id: connector.relation.id,
                type: "edge",
              }),
            })}
            data-relation-id={connector.relation.id}
            key={`${connector.relation.id}:${String(index)}`}
            points={points}
          />
        );
      })}
    </svg>
  );
}
