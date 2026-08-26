import {
  isSelectionTargetSelected,
  useInfiniteCanvasState,
  worldPointToScreenPoint,
  type InfiniteCanvasPoint,
} from "@hyphened/infinite-canvas";
import { useValue } from "@legendapp/state/react";
import { tv } from "ui/tv";

import { getRelationLabel, relations$ } from "../notes/relations";
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
    /*
     * The line is knocked out from behind the word rather than boxed away from it.
     *
     * A chip or a plate under a label is a second surface floating on the ground, and the bar here
     * bans exactly that kind of outline-drawn UI. `paint-order: stroke` paints a ground-coloured
     * halo first and the glyphs over it, so the connector simply stops where the word starts —
     * the technique every map label uses, and it needs no rectangle to measure.
     */
    label:
      "select-none fill-[var(--ink-muted)] stroke-[var(--ground)] stroke-[3px] font-medium [paint-order:stroke]",
    path: "fill-none stroke-[var(--accent)] transition-[stroke-width,opacity] duration-100 ease-[var(--ease-swift)]",
    svg: "pointer-events-none absolute inset-0 h-full w-full overflow-visible",
  },
  variants: {
    selected: {
      false: { path: "stroke-[1.5] opacity-40" },
      // Selection has to read at a glance on a hairline, so it takes both weight and light.
      true: { path: "stroke-[2.5] opacity-100", label: "fill-[var(--ink)]" },
    },
  },
});

/**
 * What a label does when it cannot be read.
 *
 * It belongs to the edge, so it scales with the camera rather than floating at a fixed size — a
 * label that stayed 11px while the canvas shrank would detach from the line it describes and start
 * competing with the HUD, and at 25% a screenful of them is soup rather than information.
 *
 * Below legibility it is dropped instead of shrunk. Sub-8px text carries nothing a reader can use,
 * so drawing it only adds noise to the one thing the connector still says clearly at that distance:
 * that these two notes are joined. The exception is a selected edge, which is drawn at any zoom
 * because there is exactly one of it and you asked.
 */
const LABEL_BASE_PX = 11;
const LABEL_MIN_PX = 8;

const toPoints = (points: readonly InfiniteCanvasPoint[]) =>
  points.map((point) => `${String(point.x)},${String(point.y)}`).join(" ");

export function ConnectorLayer() {
  const state = useInfiniteCanvasState<WindowKind>();
  const relations = useValue(relations$);
  const drawn = getDrawnConnectors(state, relations);
  const labelSize = LABEL_BASE_PX * state.camera.zoom;
  const isLabelLegible = labelSize >= LABEL_MIN_PX;

  return drawn.length === 0 ? null : (
    <svg className={connectors().svg()} data-slot="connector-layer">
      {drawn.map((connector, index) => {
        const selected = isSelectionTargetSelected(state, {
          id: connector.relation.id,
          type: "edge",
        });
        const styles = connectors({ selected });
        const points = toPoints(
          connector.points.map((point) =>
            worldPointToScreenPoint(state.camera, state.viewport, point),
          ),
        );
        const label = getRelationLabel(connector.relation.kind);
        const anchor = worldPointToScreenPoint(state.camera, state.viewport, connector.midpoint);

        return (
          <g key={`${connector.relation.id}:${String(index)}`}>
            <polyline
              className={styles.path()}
              data-relation-id={connector.relation.id}
              points={points}
            />
            {label === undefined || !(isLabelLegible || selected) ? null : (
              <text
                className={styles.label()}
                data-relation-label={connector.relation.id}
                dominantBaseline="central"
                fontSize={Math.max(labelSize, LABEL_MIN_PX)}
                textAnchor="middle"
                x={anchor.x}
                y={anchor.y}
              >
                {label}
              </text>
            )}
          </g>
        );
      })}
    </svg>
  );
}
