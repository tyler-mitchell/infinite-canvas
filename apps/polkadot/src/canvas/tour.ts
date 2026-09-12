import {
  getInfiniteCanvasWorldPath,
  getInfiniteCanvasWorldPathPointAtProgress,
  type InfiniteCanvasPoint,
  type InfiniteCanvasRect,
  type InfiniteCanvasState,
  type InfiniteCanvasWorldPath,
} from "@hyphened/infinite-canvas";

import type { ContentRelation } from "../database/database.client";
import { getConnectorRectsByItem } from "./connector-geometry";
import type { WindowKind } from "./window-registry";

/**
 * A walk of the canvas that follows the connections the author drew.
 *
 * The order is not invented. A spatial canvas holds a thought laid out in space, and the links are
 * the reading order its author already recorded, so a tour reads that structure back rather than
 * asking for a second one through a waypoint editor.
 */
type CanvasTour = Readonly<{
  /** World rect of each stop, in visit order. The camera frames these, not bare points. */
  stops: readonly InfiniteCanvasRect[];
  /** The path through the stop centres, for sampling a camera position at a progress. */
  path: InfiniteCanvasWorldPath;
}>;

const getRectCentre = (rect: InfiniteCanvasRect): InfiniteCanvasPoint => ({
  x: rect.x + rect.width / 2,
  y: rect.y + rect.height / 2,
});

/** Neighbours of each item, both directions, because a relation records no meaningful direction. */
function getAdjacency(
  relations: readonly ContentRelation[],
  present: ReadonlySet<string>,
): ReadonlyMap<string, readonly string[]> {
  return relations.reduce<Map<string, string[]>>((adjacency, relation) => {
    if (!present.has(relation.source) || !present.has(relation.target)) {
      return adjacency;
    }

    return adjacency
      .set(relation.source, [...(adjacency.get(relation.source) ?? []), relation.target])
      .set(relation.target, [...(adjacency.get(relation.target) ?? []), relation.source]);
  }, new Map());
}

/*
 * Depth-first from the busiest item.
 *
 * Breadth-first would order a hub's neighbours by degree rather than by how they hang together, so
 * a chain hanging off the hub would be visited a stop at a time between unrelated branches. Depth
 * first walks a branch to its end before returning, which is how somebody explaining the canvas
 * would talk through it.
 *
 * A tie breaks on the item id so the same canvas always tours in the same order.
 */
function getVisitOrder(
  adjacency: ReadonlyMap<string, readonly string[]>,
  roots: readonly string[],
): readonly string[] {
  const seen = new Set<string>();
  const order: string[] = [];
  const walk = (itemId: string) => {
    if (seen.has(itemId)) {
      return;
    }

    seen.add(itemId);
    order.push(itemId);

    for (const neighbour of [...(adjacency.get(itemId) ?? [])].sort()) {
      walk(neighbour);
    }
  };

  for (const root of roots) {
    walk(root);
  }

  return order;
}

/**
 * The tour of one canvas, or null when nothing is connected.
 *
 * Two connected items are the smallest thing worth touring; a single note is already on screen and
 * an unconnected canvas has no order to read back.
 */
function getCanvasTour(
  state: InfiniteCanvasState<WindowKind>,
  relations: readonly ContentRelation[],
): CanvasTour | null {
  const rectsByItem = getConnectorRectsByItem(state);
  const adjacency = getAdjacency(relations, new Set(rectsByItem.keys()));

  if (adjacency.size < 2) {
    return null;
  }

  // The busiest item first: a hub is where an explanation starts.
  const roots = [...adjacency.keys()].sort((left, right) => {
    const degree = (adjacency.get(right)?.length ?? 0) - (adjacency.get(left)?.length ?? 0);

    return degree === 0 ? left.localeCompare(right) : degree;
  });
  // An item can own several windows; the first is its stop, matching the adjacency it was built on.
  const stops = getVisitOrder(adjacency, roots).flatMap((itemId) => {
    const rect = rectsByItem.get(itemId)?.[0];

    return rect === undefined ? [] : [rect];
  });

  return stops.length < 2
    ? null
    : { path: getInfiniteCanvasWorldPath(stops.map(getRectCentre)), stops };
}

/** The camera target at a progress along the tour, for a caller polling once per frame. */
function getCanvasTourPoint(tour: CanvasTour, progress: number): InfiniteCanvasPoint {
  return getInfiniteCanvasWorldPathPointAtProgress(tour.path, progress);
}

export { getCanvasTour, getCanvasTourPoint };
export type { CanvasTour };
