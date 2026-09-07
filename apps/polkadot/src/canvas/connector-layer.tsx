import {
  getInfiniteCanvasPathData,
  isSelectionTargetSelected,
  useInfiniteCanvasState,
  worldPointToScreenPoint,
  type InfiniteCanvasPoint,
  type InfiniteCanvasState,
} from "@hyphened/infinite-canvas";
import { useValue } from "@legendapp/state/react";
import { tv } from "ui/tv";

import { getRelationLabel, relations$ } from "../relations/relation-store";
import { getDrawnConnectors, getHiddenConnectorStubs } from "./connector-geometry";
import type { WindowKind } from "./window-registry";

const connectors = tv({
  slots: {
    label:
      "select-none fill-[var(--ink-muted)] stroke-[var(--ground)] stroke-[3px] font-medium [paint-order:stroke]",
    mark: "fill-[var(--accent)] stroke-[var(--ground)] stroke-[2px] [paint-order:stroke]",
    path: "fill-none stroke-[var(--accent)] transition-[stroke-width,opacity] duration-100 ease-[var(--ease-swift)]",
    stub: "fill-none stroke-[var(--accent)] stroke-[1.5] opacity-25 [stroke-dasharray:3_5]",
    svg: "pointer-events-none absolute inset-0 h-full w-full overflow-visible",
  },
  variants: {
    selected: {
      false: { path: "stroke-[1.5] opacity-40" },
      true: {
        label: "fill-[var(--ink)]",
        mark: "fill-[var(--ink)]",
        path: "stroke-[2.5] opacity-100",
      },
    },
  },
});

const LABEL_BASE_PX = 11;
const LABEL_MIN_PX = 8;

/**
 * Screen pixels, so one corner reads the same at every zoom.
 *
 * The route is orthogonal, which draws as right angles. A right angle reads as a wire diagram; the
 * same turn with a radius reads as a drawn line, and that difference is most of the character of a
 * connector.
 */
const CORNER_RADIUS_PX = 10;

const toPathData = (
  points: readonly InfiniteCanvasPoint[],
  state: InfiniteCanvasState<WindowKind>,
) =>
  getInfiniteCanvasPathData(
    points.map((point) => worldPointToScreenPoint(state.camera, state.viewport, point)),
    { cornerRadius: CORNER_RADIUS_PX },
  );

export function ConnectorLayer() {
  const state = useInfiniteCanvasState<WindowKind>();
  const relations = useValue(relations$);
  const drawn = getDrawnConnectors(state, relations);
  const stubs = getHiddenConnectorStubs(state, relations);
  const labelSize = LABEL_BASE_PX * state.camera.zoom;
  const isLabelLegible = labelSize >= LABEL_MIN_PX;

  return drawn.length === 0 && stubs.length === 0 ? null : (
    <svg className={connectors().svg()} data-slot="connector-layer">
      {drawn.map((connector, index) => {
        const selected = isSelectionTargetSelected(state, {
          id: connector.relation.id,
          type: "edge",
        });
        const styles = connectors({ selected });
        const label = getRelationLabel(connector.relation);
        const anchor =
          connector.anchor === null
            ? null
            : worldPointToScreenPoint(state.camera, state.viewport, connector.anchor);

        return (
          <g key={`${connector.relation.id}:${String(index)}`}>
            <path
              className={styles.path()}
              d={toPathData(connector.points, state)}
              data-relation-id={connector.relation.id}
            />
            {label === undefined && anchor !== null ? (
              <circle
                className={styles.mark()}
                cx={anchor.x}
                cy={anchor.y}
                data-relation-mark={connector.relation.id}
                r={Math.max(labelSize * 0.18, 1.5)}
              />
            ) : null}
            {label !== undefined && anchor !== null && (isLabelLegible || selected) ? (
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
            ) : null}
          </g>
        );
      })}
      {stubs.map((stub, index) => {
        const anchor = worldPointToScreenPoint(state.camera, state.viewport, stub.endpoint);

        return (
          <g key={`${stub.itemId}:hidden:${String(index)}`}>
            <path
              className={connectors().stub()}
              d={toPathData(stub.points, state)}
              data-hidden-stub={stub.itemId}
            />
            {isLabelLegible ? (
              <text
                className={connectors().label()}
                data-hidden-count={stub.itemId}
                dominantBaseline="central"
                fontSize={labelSize}
                textAnchor="start"
                x={anchor.x + labelSize * 0.55}
                y={anchor.y}
              >
                {stub.count}
              </text>
            ) : null}
          </g>
        );
      })}
    </svg>
  );
}
