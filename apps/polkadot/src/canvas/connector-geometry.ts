import {
  getInfiniteCanvasConnectionPreviewPath,
  getInfiniteCanvasContentViewport,
  getInfiniteCanvasGroupProjection,
  getInfiniteCanvasLongestUnoccludedRun,
  getInfiniteCanvasRectConnectorPath,
  getInfiniteCanvasSegmentsWithinRect,
  getInfiniteCanvasWorldPathPointAtProgress,
  screenPointToWorldPoint,
  getSelectionTargets,
  isInfiniteCanvasWindowInActiveWorkspace,
  type InfiniteCanvasPoint,
  type InfiniteCanvasRect,
  type InfiniteCanvasSelection,
  type InfiniteCanvasState,
  type InfiniteCanvasWorldSegment,
} from "@hyphened/infinite-canvas";

import type { ContentRelation } from "../database/database.client";
import { getContentWindowItemId, type WindowKind } from "./window-registry";

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
   * Meant to be the middle of the longest stretch of this connector that no window covers — not the
   * midpoint of the routed path, which is the obvious choice and lands inside a window whenever the
   * two notes nearly touch, the exact arrangement in which an edge most needs something to aim at.
   *
   * `null` means every stretch is covered. The connector then draws no marker rather than one
   * nobody can see, and the library rail is where that edge is reachable.
   *
   * **It is not actually the middle of the stretch, and the gap is the framework's.**
   * `getInfiniteCanvasLongestUnoccludedSegment` promises "the longest run of a path that nothing
   * covers" and returns the longest *segment*, never merging contiguous ones. An elbow splits a
   * fully visible path into three, so the marker lands on the midpoint of one leg — a quarter of
   * the way along the run rather than half.
   *
   * Measured in the browser on 2026-08-27, two notes stacked with a 34px gap: the connector ran
   * y296–330 and the label centred at y321.5 instead of 313, ending 2px from the lower window with
   * 19px of clearance above it. Off by a quarter of the path, every time, and worst exactly where
   * this anchor exists to help — a short run between near-touching windows.
   *
   * Not worked around here. Merging runs is path geometry the canvas owns, and the two docstrings
   * on that function already say "run"; a copy in this file would be the re-derivation they warn
   * against and would be deleted the day the framework agrees with itself. Recorded in `ROADMAP.md`
   * as a framework gap instead.
   */
  anchor: InfiniteCanvasPoint | null;
  points: readonly InfiniteCanvasPoint[];
  relation: ContentRelation;
  segments: readonly InfiniteCanvasWorldSegment[];
}>;

/** The kind every connector target carries, so a selected edge can be told apart from a shape. */
const CONNECTOR_TARGET_KIND = "relation";

/** Halfway along the longest visible stretch. `null` when the whole connector is covered. */
function getRunAnchor(
  segments: readonly InfiniteCanvasWorldSegment[],
  occluders: readonly InfiniteCanvasRect[],
): InfiniteCanvasPoint | null {
  const run = getInfiniteCanvasLongestUnoccludedRun(segments, occluders);

  return run === null ? null : getInfiniteCanvasWorldPathPointAtProgress(run, 0.5);
}

/**
 * Every content item on this desktop and the windows showing it — of any kind.
 *
 * This resolved note windows and only note windows, which made the connector layer the last part of
 * the app that believed a canvas held one sort of thing. `relates_to` joins any content item to any
 * other and has since the first migration, so an image was connectable in the database and not on
 * the canvas. Reading the shared `itemId` is the whole fix: a window says what it is bound to
 * without having to say what kind it is.
 */
function getConnectorRectsByItem(state: InfiniteCanvasState<WindowKind>) {
  /*
   * The third way a window can be on the canvas without being on screen.
   *
   * Minimized was handled and desktop membership was handled; a window behind another tab was not.
   * Its `mode` is `"normal"`, it is admitted by the workspace, and its `rect` is the shell's whole
   * content rect — the rect it would occupy if revealed — so it looked like an ordinary visible
   * window to everything here. Both members of a tab pair therefore report the *same* rect, and a
   * connector routed between one of them and anything else collapsed: watched, a polyline with a
   * single point at 987.18, 383.07. The edge simply vanished, and no stub was drawn either,
   * because the item counted as shown.
   *
   * `hiddenWindowIds` is the framework's answer and the minimap, the offscreen ring and focus
   * traversal already read it. This is the fourth surface to learn the same rule: a derived view
   * has to ask the question the verb asks.
   */
  const { hiddenWindowIds } = getInfiniteCanvasGroupProjection(state.groups, state.groupMetrics);

  // An item can be open in more than one window, so an edge joins every pair showing it.
  return state.windows.reduce<Map<string, InfiniteCanvasRect[]>>((rects, window) => {
    // Through the shared reader, which is the only thing that knows where the id lives — the field
    // has moved once already and every surface spelling it out kept compiling and stopped working.
    const itemId = getContentWindowItemId(window);

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
    return itemId === null ||
      window.mode === "minimized" ||
      hiddenWindowIds.has(window.id) ||
      !isInfiniteCanvasWindowInActiveWorkspace(state, window.id)
      ? rects
      : rects.set(itemId, [...(rects.get(itemId) ?? []), window.rect]);
  }, new Map());
}

function getDrawnConnectors(
  state: InfiniteCanvasState<WindowKind>,
  relations: readonly ContentRelation[],
): readonly DrawnConnector[] {
  const rectsByItem = getConnectorRectsByItem(state);
  /*
   * Everything that can hide a connector, which is every window on this desktop — not only the two
   * the edge joins. A third note parked across the line hides a label just as completely as an
   * endpoint does.
   */
  const occluders = [...rectsByItem.values()].flat();
  /*
   * The part of the world this app's own chrome is not sitting on.
   *
   * A marker is just as hidden behind the library rail as behind a window, and the rail is not an
   * occluder — it is screen-space furniture, and what it leaves is the *complement* of a band. This
   * app already declares every such band through `viewportInsets`, `getInfiniteCanvasContentViewport`
   * turns those into the screen region that remains, and two corners projected back give the world
   * rect an anchor has to fall inside.
   *
   * Found by watching a connector's mark render at x=174 — behind the rail, on a canvas where the
   * connector itself was perfectly visible further along.
   */
  const contentViewport = getInfiniteCanvasContentViewport(state.viewport, state.viewportInsets);
  const topLeft = screenPointToWorldPoint(state.camera, state.viewport, {
    x: contentViewport.x,
    y: contentViewport.y,
  });
  const bottomRight = screenPointToWorldPoint(state.camera, state.viewport, {
    x: contentViewport.x + contentViewport.width,
    y: contentViewport.y + contentViewport.height,
  });
  const anchorBounds: InfiniteCanvasRect = {
    height: bottomRight.y - topLeft.y,
    width: bottomRight.x - topLeft.x,
    x: topLeft.x,
    y: topLeft.y,
  };

  return relations.flatMap((relation) =>
    (rectsByItem.get(relation.source) ?? []).flatMap((fromRect) =>
      (rectsByItem.get(relation.target) ?? []).map((toRect) => {
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
        return {
          anchor: getRunAnchor(
            getInfiniteCanvasSegmentsWithinRect(path.segments, anchorBounds),
            occluders,
          ),
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
  relations: readonly ContentRelation[],
) {
  const rectsByItem = getConnectorRectsByItem(state);

  return [...rectsByItem].flatMap(([itemId, rects]) => {
    const neighbourIds = new Set(
      relations
        .filter((relation) => relation.source === itemId || relation.target === itemId)
        .map((relation) => (relation.source === itemId ? relation.target : relation.source)),
    );
    const hiddenCount = [...neighbourIds].filter((id) => !rectsByItem.has(id)).length;

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
            itemId,
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
  relations: readonly ContentRelation[],
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
  relations: readonly ContentRelation[],
): readonly ContentRelation[] {
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
