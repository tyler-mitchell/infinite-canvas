import {
  getInfiniteCanvasConnectionPreviewPath,
  getInfiniteCanvasContentWorldRect,
  getInfiniteCanvasGroupProjection,
  getInfiniteCanvasLongestUnoccludedRun,
  getInfiniteCanvasRectBundledConnectorPaths,
  getInfiniteCanvasSegmentsWithinRect,
  getInfiniteCanvasWorldPathPointAtProgress,
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

type DrawnConnector = Readonly<{
  /** This is the marker position, or null when all visible segments are covered. */
  anchor: InfiniteCanvasPoint | null;
  points: readonly InfiniteCanvasPoint[];
  relation: ContentRelation;
  segments: readonly InfiniteCanvasWorldSegment[];
}>;

const CONNECTOR_TARGET_KIND = "relation";

function getRunAnchor(
  segments: readonly InfiniteCanvasWorldSegment[],
  occluders: readonly InfiniteCanvasRect[],
): InfiniteCanvasPoint | null {
  const run = getInfiniteCanvasLongestUnoccludedRun(segments, occluders);

  return run === null ? null : getInfiniteCanvasWorldPathPointAtProgress(run, 0.5);
}

function getConnectorRectsByItem(state: InfiniteCanvasState<WindowKind>) {
  // This excludes windows hidden by the active group projection.
  const { hiddenWindowIds } = getInfiniteCanvasGroupProjection(state.groups, state.groupMetrics);

  return state.windows.reduce<Map<string, InfiniteCanvasRect[]>>((rects, window) => {
    const itemId = getContentWindowItemId(window);

    // This excludes windows outside the active desktop.
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
  const occluders = [...rectsByItem.values()].flat();
  // Connector markers stay inside the content viewport.
  const anchorBounds = getInfiniteCanvasContentWorldRect(
    state.camera,
    state.viewport,
    state.viewportInsets,
  );

  /*
   * Routed as a set per hub, not one relation at a time.
   *
   * A hub with five relations meets them at five different boundary points when each is routed
   * alone, so the fan reads as five unrelated lines. Bundling gives the group one anchor and one
   * trunk, which is what makes a hub look like a hub.
   *
   * The hub is the busier end, not `relation.source`. Relations are undirected, so the stored
   * direction records who was dragged first and nothing a reader can see; fanning from it left an
   * item that everything points *at* — the shape most worth bundling — drawing five unrelated
   * lines. Counting decides it instead, and the source breaks a tie so the result stays stable.
   *
   * Only relations with both ends on the canvas are counted. An item with many off-canvas
   * relations is not the hub of anything drawn, and letting those votes count would hand the fan
   * to a rect that has one visible line.
   */
  const visible = relations.filter(
    (relation) => rectsByItem.has(relation.source) && rectsByItem.has(relation.target),
  );
  const degree = visible.reduce<Map<string, number>>(
    (counts, relation) =>
      counts
        .set(relation.source, (counts.get(relation.source) ?? 0) + 1)
        .set(relation.target, (counts.get(relation.target) ?? 0) + 1),
    new Map(),
  );
  const byHub = visible.reduce<Map<string, ContentRelation[]>>((groups, relation) => {
    const hub =
      (degree.get(relation.target) ?? 0) > (degree.get(relation.source) ?? 0)
        ? relation.target
        : relation.source;

    return groups.set(hub, [...(groups.get(hub) ?? []), relation]);
  }, new Map());

  return [...byHub].flatMap(([hubId, group]) =>
    (rectsByItem.get(hubId) ?? []).flatMap((fromRect) => {
      // One entry per drawn connector, so a leaf opened twice keeps both of its lines.
      const drawn = group.flatMap((relation) => {
        const leafId = relation.source === hubId ? relation.target : relation.source;

        return (rectsByItem.get(leafId) ?? []).map((toRect) => ({ relation, toRect }));
      });

      const paths = getInfiniteCanvasRectBundledConnectorPaths(
        fromRect,
        drawn.map((entry) => entry.toRect),
      );

      return drawn.flatMap((entry, index) => {
        const path = paths[index];

        return path === undefined
          ? []
          : [
              {
                anchor: getRunAnchor(
                  getInfiniteCanvasSegmentsWithinRect(path.segments, anchorBounds),
                  occluders,
                ),
                points: path.points,
                relation: entry.relation,
                segments: path.segments,
              },
            ];
      });
    }),
  );
}

const HIDDEN_STUB_LENGTH = 56;

/**
 * A stub per item whose connections lead somewhere the canvas is not showing.
 *
 * `openableItemIds` is what the project still holds. Archiving an item keeps its relations so a
 * restore brings them back, which means an archived neighbour is still a relation with no rect —
 * indistinguishable here from one that is merely closed. Counting it promised a connection that
 * nothing on the canvas could reach: archive one of three neighbours and the remaining pair kept a
 * stub reading "1", pointing at an item no longer in the library.
 */
function getHiddenConnectorStubs(
  state: InfiniteCanvasState<WindowKind>,
  relations: readonly ContentRelation[],
  openableItemIds: ReadonlySet<string>,
) {
  const rectsByItem = getConnectorRectsByItem(state);

  return [...rectsByItem].flatMap(([itemId, rects]) => {
    const neighbourIds = new Set(
      relations
        .filter((relation) => relation.source === itemId || relation.target === itemId)
        .map((relation) => (relation.source === itemId ? relation.target : relation.source)),
    );
    const hiddenCount = [...neighbourIds].filter(
      (id) => !rectsByItem.has(id) && openableItemIds.has(id),
    ).length;

    return hiddenCount === 0
      ? []
      : rects.map((rect) => {
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

// All segments share one relation ID.
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
  getConnectorRectsByItem,
  getDrawnConnectors,
  getHiddenConnectorStubs,
  getSelectedRelations,
};
export type { DrawnConnector };
