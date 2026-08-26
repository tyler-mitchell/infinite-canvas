import {
  getInfiniteCanvasRectConnectorPath,
  getInfiniteCanvasWindowData,
  type InfiniteCanvasPoint,
  type InfiniteCanvasRect,
  type InfiniteCanvasState,
  type InfiniteCanvasWorldSegment,
} from "@hyphened/infinite-canvas";

import type { NoteRelation } from "../database/database.client";
import { NoteWindowData, type WindowKind } from "./window-registry";

/**
 * Where every connector actually is, in world space.
 *
 * One derivation, because two things need the answer and they must not disagree: the layer that
 * draws a connector, and the spatial resolver that decides whether a click landed on one. Deriving
 * the line twice is how you get an edge you can see but cannot hit, or hit somewhere it is not
 * drawn — and nothing about that failure is visible in a typecheck.
 *
 * `segments` rather than only `points` because `createInfiniteCanvasEdgeTargetResolver` hit-tests
 * one straight segment at a time, and an orthogonal connector is three of them. Registering the
 * path's endpoints as a single segment would make the diagonal between them clickable and the
 * elbow that is actually drawn dead.
 */

type DrawnConnector = Readonly<{
  points: readonly InfiniteCanvasPoint[];
  relation: NoteRelation;
  segments: readonly InfiniteCanvasWorldSegment[];
}>;

/** The kind every connector target carries, so a selected edge can be told apart from a shape. */
const CONNECTOR_TARGET_KIND = "relation";

function getConnectorRectsByNote(state: InfiniteCanvasState<WindowKind>) {
  // A note can be open in more than one window, so an edge joins every pair showing it.
  return state.windows.reduce<Map<string, InfiniteCanvasRect[]>>((rects, window) => {
    const data = getInfiniteCanvasWindowData(window, NoteWindowData.allows);

    return data == null || window.mode === "minimized"
      ? rects
      : rects.set(data.noteId, [...(rects.get(data.noteId) ?? []), window.rect]);
  }, new Map());
}

function getDrawnConnectors(
  state: InfiniteCanvasState<WindowKind>,
  relations: readonly NoteRelation[],
): readonly DrawnConnector[] {
  const rectsByNote = getConnectorRectsByNote(state);

  return relations.flatMap((relation) =>
    (rectsByNote.get(relation.source) ?? []).flatMap((fromRect) =>
      (rectsByNote.get(relation.target) ?? []).map((toRect) => {
        const path = getInfiniteCanvasRectConnectorPath(fromRect, toRect, { route: "orthogonal" });

        return { points: path.points, relation, segments: path.segments };
      }),
    ),
  );
}

/**
 * Every segment of every connector, as something the pointer can land on.
 *
 * All segments of one relation share the relation's id, so clicking any part of an elbow selects
 * the whole edge rather than the limb you happened to hit. The resolver returns only the nearest
 * match, so repeating the id across segments costs nothing.
 */
function getConnectorEdgeTargets(
  state: InfiniteCanvasState<WindowKind>,
  relations: readonly NoteRelation[],
) {
  return getDrawnConnectors(state, relations).flatMap((connector) =>
    connector.segments.map((segment) => ({
      data: connector.relation,
      end: segment.end,
      id: connector.relation.id,
      kind: CONNECTOR_TARGET_KIND,
      start: segment.start,
    })),
  );
}

export { CONNECTOR_TARGET_KIND, getConnectorEdgeTargets, getDrawnConnectors };
export type { DrawnConnector };
