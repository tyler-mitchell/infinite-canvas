import { cameraShowing, type Camera } from "./camera";
import { centroidOfRect, unionRects, type Insets, type Rect } from "./rect";
import { fitScales, type Size } from "./size";
import { clamp, clamp0, fit } from "@thi.ng/math";
import { max } from "@thi.ng/transducers";
import { axes, pointOnAxis, type Axis } from "./axis";
import type { Point } from "./vector";

export function insetsOfOccluder({
  rect,
  viewport,
  tolerance = 1,
}: {
  rect: Rect;
  viewport: Size;
  tolerance?: number;
}): Partial<Insets> {
  const spansWidth = rect.x <= tolerance && rect.x + rect.width >= viewport.width - tolerance;
  const spansHeight = rect.y <= tolerance && rect.y + rect.height >= viewport.height - tolerance;
  if (spansWidth === spansHeight) return {};
  if (spansWidth)
    return rect.y <= tolerance
      ? { top: rect.y + rect.height }
      : { bottom: Math.max(0, viewport.height - rect.y) };
  return rect.x <= tolerance
    ? { left: rect.x + rect.width }
    : { right: Math.max(0, viewport.width - rect.x) };
}

export function combineInsets({
  parts,
  base,
}: {
  parts: readonly Partial<Insets>[];
  base: Insets;
}): Insets {
  const edge = (name: keyof Insets) =>
    Math.max(base[name], ...parts.map((part) => part[name] ?? 0));
  return { top: edge("top"), right: edge("right"), bottom: edge("bottom"), left: edge("left") };
}

export type CameraBehavior =
  | { type: "center" }
  | { type: "centerAtZoom"; zoom: number }
  | {
      type: "fit";
      padding?: number;
      framingMode?: "both" | "horizontal" | "vertical";
      framingSize?: number;
      maxZoom?: number;
    };

export type CameraFraming = {
  behavior?: CameraBehavior;
  composition?: { targetOffset?: Point; screenPosition?: Point };
};

export type PlacedSection = { id: string; offset: number };

export type CameraTrack = {
  zoom: number;
  length: number;
  sections: PlacedSection[];
  sectionIdsAt(input: { offset: number; tolerance?: number }): string[];
  at(offset: number): Camera;
  offsetAt(camera: Camera): number;
};

export function getCameraTrack({
  sections,
  viewport,
  insets,
  limits,
  maxZoom,
  axis = "vertical",
}: {
  sections: readonly { id: string; rect: Rect }[];
  viewport: Size;
  insets: Insets;
  limits: { minZoom: number; maxZoom: number; padding: number };
  maxZoom?: number;
  axis?: Axis;
}): CameraTrack | null {
  const bounds = unionRects(sections.map((section) => section.rect));
  if (bounds === null || viewport.width <= 0 || viewport.height <= 0) return null;
  const { main, mainPosition, crossPosition, crossAxis } = axes[axis];
  const { start, end, crossStart, crossEnd } =
    axis === "vertical"
      ? { start: insets.top, end: insets.bottom, crossStart: insets.left, crossEnd: insets.right }
      : { start: insets.left, end: insets.right, crossStart: insets.top, crossEnd: insets.bottom };
  const { zoom } = getCameraDestination({
    rect: bounds,
    camera: { center: { x: 0, y: 0 }, zoom: 1 },
    viewport,
    insets,
    limits,
    navigation: {
      behavior: {
        type: "fit",
        framingMode: crossAxis,
        ...(maxZoom === undefined ? {} : { maxZoom }),
      },
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
  const length = Math.max(
    clamp0(bounds[main] * zoom + padding * 2 - extent),
    max(placed.map((section) => section.offset)),
  );
  return {
    zoom,
    length,
    sections: placed,
    sectionIdsAt: ({ offset, tolerance = 1 }) => {
      const active = (
        placed.findLast((section) => section.offset <= offset + tolerance) ?? placed[0]
      )?.offset;
      return active === undefined
        ? []
        : placed.filter((section) => section.offset === active).map((section) => section.id);
    },
    at: (offset) => ({
      zoom,
      center: pointOnAxis({ axis, main: centreAt(clamp(offset, 0, length)), cross }),
    }),
    offsetAt: (camera) =>
      clamp(fit(camera.center[mainPosition], centreAt(0), centreAt(length), 0, length), 0, length),
  };
}

export function getCameraDestination({
  rect,
  camera,
  viewport,
  insets,
  navigation,
  limits,
}: {
  rect: Rect;
  camera: Camera;
  viewport: Size;
  insets: Insets;
  navigation: CameraFraming;
  limits: { minZoom: number; maxZoom: number; padding: number };
}): Camera {
  const width = Math.max(viewport.width - insets.left - insets.right, 1);
  const height = Math.max(viewport.height - insets.top - insets.bottom, 1);
  const behavior = navigation.behavior ?? { type: "center" };
  const requestedZoom = (() => {
    switch (behavior.type) {
      case "center":
        return camera.zoom;
      case "centerAtZoom":
        return behavior.zoom;
      case "fit": {
        const padding = behavior.padding ?? limits.padding;
        const fit = fitScales(
          { width: Math.max(rect.width, 1), height: Math.max(rect.height, 1) },
          { width: Math.max(width - padding * 2, 1), height: Math.max(height - padding * 2, 1) },
        );
        return Math.min(
          fit[behavior.framingMode ?? "both"] * (behavior.framingSize ?? 1),
          behavior.maxZoom ?? limits.maxZoom,
        );
      }
    }
  })();
  const zoom = clamp(requestedZoom, limits.minZoom, limits.maxZoom);
  const offset = navigation.composition?.targetOffset ?? { x: 0, y: 0 };
  const position = navigation.composition?.screenPosition ?? { x: 0.5, y: 0.5 };
  const target = centroidOfRect(rect);
  return cameraShowing({
    worldPoint: { x: target.x + offset.x, y: target.y + offset.y },
    screenPoint: { x: insets.left + width * position.x, y: insets.top + height * position.y },
    viewport,
    zoom,
  });
}
