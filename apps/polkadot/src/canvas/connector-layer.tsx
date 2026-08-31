import {
  isSelectionTargetSelected,
  useInfiniteCanvasState,
  worldPointToScreenPoint,
  type InfiniteCanvasPoint,
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

const toPoints = (points: readonly InfiniteCanvasPoint[]) =>
  points.map((point) => `${String(point.x)},${String(point.y)}`).join(" ");

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
        const points = toPoints(
          connector.points.map((point) =>
            worldPointToScreenPoint(state.camera, state.viewport, point),
          ),
        );
        const label = getRelationLabel(connector.relation);
        const anchor =
          connector.anchor === null
            ? null
            : worldPointToScreenPoint(state.camera, state.viewport, connector.anchor);

        return (
          <g key={`${connector.relation.id}:${String(index)}`}>
            <polyline
              className={styles.path()}
              data-relation-id={connector.relation.id}
              points={points}
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
        const points = toPoints(
          stub.points.map((point) => worldPointToScreenPoint(state.camera, state.viewport, point)),
        );
        const anchor = worldPointToScreenPoint(state.camera, state.viewport, stub.endpoint);

        return (
          <g key={`${stub.itemId}:hidden:${String(index)}`}>
            <polyline
              className={connectors().stub()}
              data-hidden-stub={stub.itemId}
              points={points}
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
