import {
  getInfiniteCanvasRectConnectorPath,
  getInfiniteCanvasWindowData,
  useInfiniteCanvasSelector,
  worldPointToScreenPoint,
  type InfiniteCanvasPoint,
  type InfiniteCanvasRect,
  type InfiniteCanvasWindow,
} from "@hyphened/infinite-canvas";
import { useValue } from "@legendapp/state/react";
import { tv } from "ui/tv";

import { relations$ } from "../notes/relations";
import { NoteWindowData, type WindowKind } from "./window-registry";

/**
 * Typed relations, drawn between the windows that show them.
 *
 * Geometry is the framework's: `getInfiniteCanvasRectConnectorPath` anchors each end on the rect
 * edge facing the other window rather than at its centre, and `worldPointToScreenPoint` projects.
 * Nothing here computes an intersection or a transform.
 *
 * Rendered through `renderUnderlay`, so a connector passes beneath the windows it joins instead of
 * drawing a line across the note you are reading.
 */

const connectors = tv({
  slots: {
    path: "fill-none stroke-[var(--accent)] stroke-[1.5] opacity-40",
    svg: "pointer-events-none absolute inset-0 h-full w-full overflow-visible",
  },
});

const toPoints = (points: readonly InfiniteCanvasPoint[]) =>
  points.map((point) => `${point.x},${point.y}`).join(" ");

export function ConnectorLayer() {
  const camera = useInfiniteCanvasSelector((state) => state.camera);
  const viewport = useInfiniteCanvasSelector((state) => state.viewport);
  const windows = useInfiniteCanvasSelector<
    WindowKind,
    readonly InfiniteCanvasWindow<WindowKind>[]
  >((state) => state.windows);
  const relations = useValue(relations$);
  const styles = connectors();

  // A note can be open in more than one window, so an edge joins every pair showing it.
  const rectsByNote = new Map<string, InfiniteCanvasRect[]>();

  for (const window of windows) {
    const data = getInfiniteCanvasWindowData(window, NoteWindowData.allows);

    if (data == null || window.mode === "minimized") {
      continue;
    }

    rectsByNote.set(data.noteId, [...(rectsByNote.get(data.noteId) ?? []), window.rect]);
  }

  const drawn = relations.flatMap((relation) => {
    const sources = rectsByNote.get(relation.source) ?? [];
    const targets = rectsByNote.get(relation.target) ?? [];

    return sources.flatMap((fromRect, fromIndex) =>
      targets.map((toRect, toIndex) => ({
        key: `${relation.id}:${String(fromIndex)}:${String(toIndex)}`,
        points: getInfiniteCanvasRectConnectorPath(fromRect, toRect, {
          route: "orthogonal",
        }).points.map((point) => worldPointToScreenPoint(camera, viewport, point)),
      })),
    );
  });

  return drawn.length === 0 ? null : (
    <svg className={styles.svg()} data-slot="connector-layer">
      {drawn.map((connector) => (
        <polyline
          className={styles.path()}
          key={connector.key}
          points={toPoints(connector.points)}
        />
      ))}
    </svg>
  );
}
