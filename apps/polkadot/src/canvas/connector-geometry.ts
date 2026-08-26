import {
  getInfiniteCanvasConnectionPreviewPath,
  getInfiniteCanvasLongestUnoccludedSegment,
  getInfiniteCanvasRectConnectorPath,
  getInfiniteCanvasWindowData,
  getSelectionTargets,
  isInfiniteCanvasWindowInActiveWorkspace,
  type InfiniteCanvasPoint,
  type InfiniteCanvasRect,
  type InfiniteCanvasSelection,
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
  /**
   * Where a marker sits, or `null` when there is nowhere it could be seen.
   *
   * The middle of the longest stretch of this connector that no window covers. Not the midpoint of
   * the routed path, which is the obvious choice and lands inside a window whenever the two notes
   * nearly touch — the exact arrangement in which an edge most needs something to aim at.
   *
   * `null` means every stretch is covered. The connector then draws no marker rather than one
   * nobody can see, and the library rail is where that edge is reachable.
   */
  anchor: InfiniteCanvasPoint | null;
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

    /*
     * Desktop membership, which this used to ignore.
     *
     * `state.windows` is every window on the canvas, not every window on the desktop you are
     * looking at — a workspace is a membership filter over that same list. Skipping only minimized
     * windows meant a connector was drawn between two notes that live on another desktop, so
     * switching to an empty one showed a line hanging in blank space joining nothing you could see.
     * Found by opening the app rather than by reading this, and only visible once desktops had more
     * than one member.
     *
     * `isInfiniteCanvasWindowInActiveWorkspace` is the framework's answer and already handles the
     * case that matters most: with no workspace active it admits everything, so a canvas that never
     * creates a desktop behaves exactly as it did before.
     */
    return data == null ||
      window.mode === "minimized" ||
      !isInfiniteCanvasWindowInActiveWorkspace(state, window.id)
      ? rects
      : rects.set(data.noteId, [...(rects.get(data.noteId) ?? []), window.rect]);
  }, new Map());
}

function getDrawnConnectors(
  state: InfiniteCanvasState<WindowKind>,
  relations: readonly NoteRelation[],
): readonly DrawnConnector[] {
  const rectsByNote = getConnectorRectsByNote(state);
  /*
   * Everything that can hide a connector, which is every window on this desktop — not only the two
   * the edge joins. A third note parked across the line hides a label just as completely as an
   * endpoint does.
   */
  const occluders = [...rectsByNote.values()].flat();

  return relations.flatMap((relation) =>
    (rectsByNote.get(relation.source) ?? []).flatMap((fromRect) =>
      (rectsByNote.get(relation.target) ?? []).map((toRect) => {
        const path = getInfiniteCanvasRectConnectorPath(fromRect, toRect, { route: "orthogonal" });
        /*
         * Where a marker goes: the middle of the longest stretch nothing covers, or nowhere.
         *
         * It used to be the midpoint of the routed path, which is the obvious anchor and the wrong
         * one — connectors are drawn beneath the windows they join, so between two notes that
         * nearly touch the midpoint is *inside* a window and the label is simply not there. Nothing
         * about that failure shows in the code: the label renders, it has the right text, and a
         * window is painted over it.
         *
         * `null` when every stretch is covered, and the connector draws no marker at all. That
         * replaces a fallback to the path midpoint which I wrote and then watched fail: on a canvas
         * where two windows overlap heavily, the fallback put the mark inside a window every time.
         * The reason given for it — that a fixed position stops the anchor jumping as windows move
         * — is worth nothing when the anchor is invisible in every one of those positions.
         *
         * A connector nothing can see has no place to put a marker, and saying so is honest: the
         * canvas shows what is visible, and the library rail lists every connection whether or not
         * it is. That is the surface for an edge you cannot find, and it already exists.
         */
        const clear = getInfiniteCanvasLongestUnoccludedSegment(path.segments, occluders);

        return {
          anchor: clear?.midpoint ?? null,
          points: path.points,
          relation,
          segments: path.segments,
        };
      }),
    ),
  );
}

/**
 * How far a stub reaches past the window, in world units.
 *
 * Long enough to read as a line going somewhere and short enough that it cannot be mistaken for a
 * connector to an offscreen note. It scales with the camera like everything else in world space.
 */
const HIDDEN_STUB_LENGTH = 56;

/**
 * The connections a window has that this canvas is not showing.
 *
 * An edge is drawn only when both ends have a rect, so closing one note silently removes the line —
 * the note keeps its connections and the canvas stops mentioning them, which is indistinguishable
 * from having none. This is the stub that says otherwise.
 *
 * Routed by `getInfiniteCanvasConnectionPreviewPath`, the same function the drag preview uses,
 * because the far end is a bare point in both cases: there is no rect to aim at, and inventing one
 * would be inventing a position for a note that has none.
 */
function getHiddenConnectorStubs(
  state: InfiniteCanvasState<WindowKind>,
  relations: readonly NoteRelation[],
) {
  const rectsByNote = getConnectorRectsByNote(state);

  return [...rectsByNote].flatMap(([noteId, rects]) => {
    const neighbourIds = new Set(
      relations
        .filter((relation) => relation.source === noteId || relation.target === noteId)
        .map((relation) => (relation.source === noteId ? relation.target : relation.source)),
    );
    const hiddenCount = [...neighbourIds].filter((id) => !rectsByNote.has(id)).length;

    return hiddenCount === 0
      ? []
      : rects.map((rect) => {
          // Off the right edge, at the vertical centre. Any edge is arbitrary without a target to
          // aim at; one consistent side keeps a canvas of stubs from reading as noise.
          const endpoint = {
            x: rect.x + rect.width + HIDDEN_STUB_LENGTH,
            y: rect.y + rect.height / 2,
          };

          return {
            count: hiddenCount,
            endpoint,
            noteId,
            points: getInfiniteCanvasConnectionPreviewPath(rect, endpoint, { route: "orthogonal" })
              .points,
          };
        });
  });
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

/**
 * The relations the pointer has selected — a different question from which windows are selected.
 *
 * `selection.targets` is the framework's model for selected things that are not windows, and it
 * fills with these because the viewport registers an edge resolver for connectors: clicking a line
 * goes through the same selection machinery, modifiers included, that selects a note.
 *
 * Here rather than at either call site because two of them ask — the palette's cut row and the
 * keyboard's cut action — and a selection the keyboard reads differently from the one the palette
 * reads is a bug nobody would find until they cut the wrong edge.
 */
function getSelectedRelations(
  selection: InfiniteCanvasSelection,
  relations: readonly NoteRelation[],
): readonly NoteRelation[] {
  return getSelectionTargets(selection)
    .filter((target) => target.type === "edge" && target.kind === CONNECTOR_TARGET_KIND)
    .flatMap((target) => relations.filter((relation) => relation.id === target.id));
}

export {
  CONNECTOR_TARGET_KIND,
  getConnectorEdgeTargets,
  getDrawnConnectors,
  getHiddenConnectorStubs,
  getSelectedRelations,
};
export type { DrawnConnector };
