import {
  getInfiniteCanvasConnectionPreviewPath,
  getInfiniteCanvasContentViewport,
  getInfiniteCanvasGroupProjection,
  getInfiniteCanvasLongestUnoccludedRun,
  getInfiniteCanvasRectBundledConnectorPaths,
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

  /*
   * Routed as a set per source rect, not one relation at a time.
   *
   * A hub with five relations meets them at five different boundary points when each is routed
   * alone, so the fan reads as five unrelated lines. Bundling gives the group one anchor and one
   * trunk, which is what makes a hub look like a hub.
   *
   * Grouped by `relation.source` because that is the end the framework fans from. An item that is
   * the target of many relations does not bundle: each of those relations belongs to a different
   * source group. Relations are undirected here, so that is an arbitrary end to favour — it is the
   * simple reading, and the alternative needs a rule for which end wins when both are hubs.
   */
  const bySource = relations.reduce<Map<string, ContentRelation[]>>(
    (groups, relation) =>
      groups.set(relation.source, [...(groups.get(relation.source) ?? []), relation]),
    new Map(),
  );

  return [...bySource].flatMap(([sourceId, group]) =>
    (rectsByItem.get(sourceId) ?? []).flatMap((fromRect) => {
      // One entry per drawn connector, so a target opened twice keeps both of its lines.
      const drawn = group.flatMap((relation) =>
        (rectsByItem.get(relation.target) ?? []).map((toRect) => ({ relation, toRect })),
      );

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
  getDrawnConnectors,
  getHiddenConnectorStubs,
  getSelectedRelations,
};
export type { DrawnConnector };
