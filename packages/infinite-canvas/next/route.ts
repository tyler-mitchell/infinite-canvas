import { getCameraDestination, type ViewportInsets } from "./camera";
import {
  axes,
  centroidOfRect,
  clamp,
  clamp0,
  fit,
  max,
  minMax,
  pointOnAxis,
  type Axis,
  unionRects,
  type Camera,
  type Rect,
  type Size,
} from "@hyphened/math/cpu";
import type { Tree } from "./layout/tree";

export type Section = { id: string; rect: Rect };

const byReadingOrder = (axis: Axis) => (left: Rect, right: Rect) => {
  const { mainPosition, crossPosition } = axes[axis];
  return left[mainPosition] - right[mainPosition] || left[crossPosition] - right[crossPosition];
};

export function getRoute({
  windows,
  rects,
  roots,
  sections = {},
  axis = "vertical",
}: {
  windows: Tree;
  rects: Readonly<Record<string, Rect | undefined>>;
  roots: readonly string[];
  sections?: Readonly<Record<string, boolean>>;
  axis?: Axis;
}): Section[] {
  const ordered = (ids: readonly string[]) =>
    ids
      .flatMap((id) => {
        const rect = rects[id];
        return rect === undefined || sections[id] === false ? [] : [{ id, rect }];
      })
      .toSorted((left, right) => byReadingOrder(axis)(left.rect, right.rect));
  const route = (ids: readonly string[]): Section[] =>
    ordered(ids).flatMap((section) => {
      const children = windows[section.id]?.children;
      return children === undefined || children.length === 0 ? [section] : route(children);
    });
  return route(roots);
}

export type PlacedSection = { id: string; offset: number };

export type CameraTrack = {
  zoom: number;
  length: number;
  sections: PlacedSection[];
  stops: number[];
  at(offset: number): Camera;
  offsetAt(camera: Camera): number;
};

const insetsOnAxis = (insets: ViewportInsets, axis: Axis) =>
  axis === "vertical"
    ? { start: insets.top, end: insets.bottom, crossStart: insets.left, crossEnd: insets.right }
    : { start: insets.left, end: insets.right, crossStart: insets.top, crossEnd: insets.bottom };

export function getCameraTrack({
  sections,
  viewport,
  insets,
  limits,
  maxZoom,
  axis = "vertical",
}: {
  sections: readonly Section[];
  viewport: Size;
  insets: ViewportInsets;
  limits: { minZoom: number; maxZoom: number; padding: number };
  maxZoom?: number;
  axis?: Axis;
}): CameraTrack | null {
  const bounds = unionRects(sections.map((section) => section.rect));
  if (bounds === null || viewport.width <= 0 || viewport.height <= 0) return null;
  const { main, mainPosition, crossPosition, crossAxis } = axes[axis];
  const { start, end, crossStart, crossEnd } = insetsOnAxis(insets, axis);
  const { zoom } = getCameraDestination({
    rect: bounds,
    camera: { center: { x: 0, y: 0 }, zoom: 1 },
    viewport,
    insets,
    limits,
    navigation: {
      target: { type: "rect", rect: bounds },
      behavior: { type: "fit", framingMode: crossAxis, maxZoom },
    },
  });
  const { padding } = limits;
  const extent = Math.max(viewport[main] - start - end, 1);
  const centreAt = (offset: number) =>
    bounds[mainPosition] + (offset + viewport[main] / 2 - start - padding) / zoom;
  const cross = centroidOfRect(bounds)[crossPosition] - (crossStart - crossEnd) / 2 / zoom;
  const placed = sections.map((section) => ({
    id: section.id,
    offset: clamp0((section.rect[mainPosition] - bounds[mainPosition]) * zoom),
  }));
  const stops = [...new Set(placed.map((section) => section.offset))];
  const length = Math.max(clamp0(bounds[main] * zoom + padding * 2 - extent), max(stops));
  return {
    zoom,
    length,
    sections: placed,
    stops,
    at: (offset) => ({
      zoom,
      center: pointOnAxis({ axis, main: centreAt(clamp(offset, ...minMax(0, length))), cross }),
    }),
    offsetAt: (camera) =>
      clamp(
        fit(camera.center[mainPosition], centreAt(0), centreAt(length), 0, length),
        ...minMax(0, length),
      ),
  };
}
