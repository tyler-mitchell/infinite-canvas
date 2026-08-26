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
    /*
     * What an unlabelled connector shows instead of a word: one small mark, in the same place.
     *
     * A `relates` edge draws no label by design — the default means only "these belong together",
     * which the line already says. But that left the least-annotated edges with nothing at all to
     * aim at, which is the opposite of what is wanted: those are the ones whose only visible
     * feature is a hairline, and on a canvas where two notes nearly touch the hairline is a few
     * pixels long.
     *
     * Label or mark, never both. Every connector gets exactly one thing on its visible run, at the
     * anchor the occlusion query already chose, so "where do I aim" has a single answer whether or
     * not anyone wrote a sentence on the edge.
     *
     * Ground-coloured stroke for the same reason the label has one: it knocks the line out from
     * behind the mark rather than boxing it, so nothing here needs a second surface.
     */
    mark: "fill-[var(--accent)] stroke-[var(--ground)] stroke-[2px] [paint-order:stroke]",
    path: "fill-none stroke-[var(--accent)] transition-[stroke-width,opacity] duration-100 ease-[var(--ease-swift)]",
    /*
     * Dashed, which is the vocabulary the drag preview already established: a broken line is an end
     * that is not a window. Quieter than a real connector too — it reports something absent, and a
     * canvas that shouts about what is missing is worse than one that stays silent about it.
     */
    stub: "fill-none stroke-[var(--accent)] stroke-[1.5] opacity-25 [stroke-dasharray:3_5]",
    svg: "pointer-events-none absolute inset-0 h-full w-full overflow-visible",
  },
  variants: {
    selected: {
      false: { path: "stroke-[1.5] opacity-40" },
      // Selection has to read at a glance on a hairline, so it takes both weight and light.
      true: {
        label: "fill-[var(--ink)]",
        mark: "fill-[var(--ink)]",
        path: "stroke-[2.5] opacity-100",
      },
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
        /*
         * `null` when every part of this connector is behind a window.
         *
         * Neither a mark nor a label is drawn then. Both exist to be aimed at, and one placed where
         * nothing can be seen is a promise the canvas cannot keep — the rail lists that edge and
         * can act on it, which is where it belongs.
         */
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
              /*
               * The mark holds the anchor for an edge that says nothing beyond existing.
               *
               * Sized against the label rather than fixed, so it shrinks with the canvas on the
               * same curve the words do and never becomes the loudest thing at low zoom. Unlike a
               * label it is not dropped when small: a dot at two pixels is still a place to aim,
               * where two-pixel text is only noise.
               */
              <circle
                className={styles.mark()}
                cx={anchor.x}
                cy={anchor.y}
                data-relation-mark={connector.relation.id}
                r={Math.max(labelSize * 0.18, 1.5)}
              />
            ) : null}
            {/* Exclusive with the mark above by construction: one carries a label, the other
                exists precisely because there is none. Two flat conditions rather than one nested
                pair, which this codebase does not allow and which would read worse anyway. */}
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
      {/*
        What this note connects to that the canvas is not showing.

        Drawn after the connectors so a stub never sits under a real edge, and given the count
        rather than a name: naming even one of several would be picking a favourite, and the number
        is what tells you whether opening the rail is worth it.
      */}
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
              /*
               * Past the end of the line, not on it.
               *
               * This was centred on `stub.endpoint`, which is where the line stops — so the dashes
               * ran into the digit and through it. On screen that reads as a line that failed to
               * finish with a stray number beside it, rather than as a count terminating a line,
               * and it is the whole reason the stub looked like debris at 100%.
               *
               * `start` rather than `middle` so a two-digit count grows rightwards into empty canvas
               * instead of creeping back over the dashes, and the gap is in screen pixels because
               * the text is: a world-space offset would close up as the camera pulls back, exactly
               * where the mark is already hardest to read.
               */
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
