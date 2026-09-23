import { d, std, tgpu } from "typegpu";
import { Insets, Rect } from "./rect";
import type { Size } from "./size";
import { invert23, type Mat, mulM23, mulV23, scale23, translation23 } from "./matrix";
import type { Point } from "./vector";
import { eqDelta } from "@thi.ng/math";

// A camera plus the surface it projects onto, bundled so a shader binds one uniform.
export const View = d.struct({ center: d.vec2f, viewport: d.vec2f, zoom: d.f32 });
export type View = d.Infer<typeof View>;

// The CPU has no uniform to bundle for, and the consumer holds these separately, so it says so.
export type Camera = { center: Point; zoom: number };
export function cameraEquals({ camera, target, tolerance }: {
  camera: Camera;
  target: Camera;
  tolerance?: number;
}): boolean {
  return eqDelta(camera.zoom, target.zoom, tolerance) &&
    eqDelta(camera.center.x, target.center.x, tolerance) &&
    eqDelta(camera.center.y, target.center.y, tolerance);
}
export type Projection = { point: Point; camera: Camera; viewport: Size };

// NOT GROUNDED. The same projection as viewMatrix below, written in vector ops because a kernel has
// no matrix to build. The composition is this package's own.
export const worldToScreenKernel = tgpu.fn(
  [d.vec2f, View],
  d.vec2f,
)((world, camera) => {
  "use gpu";
  return std.add(
    std.mul(std.sub(world, camera.center), camera.zoom),
    std.mul(camera.viewport, 0.5),
  );
});

// NOT GROUNDED. The inverse of worldToScreenKernel above; see its refusal.
export const screenToWorldKernel = tgpu.fn(
  [d.vec2f, View],
  d.vec2f,
)((screen, camera) => {
  "use gpu";
  return std.add(
    std.div(std.sub(screen, std.mul(camera.viewport, 0.5)), camera.zoom),
    camera.center,
  );
});

// The half of the view transform that does not depend on the centre: scale by zoom, then move to
// the middle of the viewport. Every camera operation here is this matrix, composed or inverted.
const anchorMatrix = ({ zoom, viewport }: { zoom: number; viewport: Size }): Mat =>
  mulM23(
    null,
    translation23(null, [viewport.width * 0.5, viewport.height * 0.5]),
    scale23(null, zoom),
  );

// The world-to-screen transform. Its six numbers are also a CSS matrix(), in that order, so a
// renderer applies the same transform the projection uses rather than rebuilding it.
export const cameraMatrix = ({ camera, viewport }: { camera: Camera; viewport: Size }): Mat =>
  mulM23(
    null,
    anchorMatrix({ zoom: camera.zoom, viewport }),
    translation23(null, [-camera.center.x, -camera.center.y]),
  );

const viewMatrix = cameraMatrix;

// NOT GROUNDED. Applies viewMatrix above; see its refusal.
export const worldToScreen = ({ point, camera, viewport }: Projection): Point => {
  const [x, y] = mulV23(null, viewMatrix({ camera, viewport }), [point.x, point.y]);
  return { x: x!, y: y! };
};

// NOT GROUNDED. Applies the inverse of viewMatrix above; see its refusal. A zoom of zero collapses
// the transform, upstream invert returns null, and there is no world position to report, so the
// screen point passes through unchanged. That fallback is this package's decision.
export const screenToWorld = ({ point, camera, viewport }: Projection): Point => {
  const inverse = invert23(null, viewMatrix({ camera, viewport }));
  if (inverse === undefined) return { x: point.x, y: point.y };
  const [x, y] = mulV23(null, inverse, [point.x, point.y]);
  return { x: x!, y: y! };
};

// NOT GROUNDED. Pixel coordinates to WebGPU clip space: scale to 0..2, shift to -1..1, flip y
// because framebuffer y runs down and clip y runs up. The convention is WebGPU's; this expression
// of it is ours.
// Solves the view transform for the centre that puts worldPoint at screenPoint: the screen point
// carried through the inverse of the anchor half of cameraMatrix, subtracted from the world point.
export const cameraShowing = ({
  worldPoint,
  screenPoint,
  zoom,
  viewport,
}: {
  worldPoint: Point;
  screenPoint: Point;
  zoom: number;
  viewport: Size;
}): Camera => {
  const anchor = invert23(null, anchorMatrix({ zoom, viewport }));
  if (anchor === undefined) return { zoom, center: worldPoint };
  const [offsetX, offsetY] = mulV23(null, anchor, [screenPoint.x, screenPoint.y]);
  return { zoom, center: { x: worldPoint.x - offsetX!, y: worldPoint.y - offsetY! } };
};

export const zoomCameraAbout = ({
  camera,
  viewport,
  screenPoint,
  zoom,
}: {
  camera: Camera;
  viewport: Size;
  screenPoint: Point;
  zoom: number;
}): Camera =>
  cameraShowing({
    worldPoint: screenToWorld({ point: screenPoint, camera, viewport }),
    screenPoint,
    zoom,
    viewport,
  });

// Moves the centre by a screen-space delta. The screen delta becomes a world delta through the
// inverse of the zoom, which is the scale half of cameraMatrix above.
export const panCamera = ({
  camera,
  screenDelta,
}: {
  camera: Camera;
  screenDelta: Point;
}): Camera => ({
  zoom: camera.zoom,
  center: {
    x: camera.center.x + screenDelta.x / camera.zoom,
    y: camera.center.y + screenDelta.y / camera.zoom,
  },
});

export const screenToClip = tgpu.fn(
  [d.vec2f, View],
  d.vec4f,
)((screen, camera) => {
  "use gpu";
  const clip = std.sub(std.mul(std.div(screen, camera.viewport), 2), d.vec2f(1, 1));
  return d.vec4f(clip.x, -clip.y, 0, 1);
});

// NOT GROUNDED. Solves worldToScreenKernel for the centre that puts worldPoint at screenPoint. This
// package's own, and the anchor every zoom-about-a-point here is built on.
export const cameraShowingKernel = tgpu.fn(
  [d.vec2f, d.vec2f, d.f32, d.vec2f],
  View,
)((worldPoint, screenPoint, zoom, viewport) => {
  "use gpu";
  return View({
    zoom,
    viewport,
    center: std.sub(worldPoint, std.div(std.sub(screenPoint, std.mul(viewport, 0.5)), zoom)),
  });
});

// NOT GROUNDED. Keeps the world point under the cursor fixed while zoom changes, by reading that
// point then re-centring on it through cameraShowing above. Composition is ours.
export const zoomCameraAboutKernel = tgpu.fn(
  [View, d.vec2f, d.f32],
  View,
)((camera, screenPoint, zoom) => {
  "use gpu";
  return cameraShowingKernel(
    screenToWorldKernel(screenPoint, camera),
    screenPoint,
    zoom,
    camera.viewport,
  );
});

// NOT GROUNDED. A screen-space drag moves the centre the other way, divided by zoom to land in
// world units. This package's own.
export const panCameraKernel = tgpu.fn(
  [View, d.vec2f],
  View,
)((camera, screenDelta) => {
  "use gpu";
  return View({
    zoom: camera.zoom,
    viewport: camera.viewport,
    center: std.add(camera.center, std.div(screenDelta, camera.zoom)),
  });
});

// NOT GROUNDED. Carries the inset screen rectangle into world space through screenToWorld above,
// which is itself ours. The extent is taken with the box2 size expression cited at the return.
export const visibleWorldRect = ({
  camera,
  viewport,
  insets,
}: {
  camera: Camera;
  viewport: Size;
  insets: Insets;
}): Rect => {
  // The visible region is the inset screen rectangle carried into world space. Both corners go
  // through the grounded screenToWorld, so no coordinate is computed here.
  const topLeft = screenToWorld({ point: { x: insets.left, y: insets.top }, camera, viewport });
  const bottomRight = screenToWorld({
    point: { x: viewport.width - insets.right, y: viewport.height - insets.bottom },
    camera,
    viewport,
  });
  // Source: @thi.ng/geom@8.3.38 area.js:29 (rect), the extent factors
  //   out[0] = box[2] - box[0];
  //   out[1] = box[3] - box[1];
  // ADAPTED: upstream has no clamp and represents an empty box as +Infinity/-Infinity (:100-106).
  // Insets larger than the viewport would give a negative extent here, so this reports zero, which
  // is what a caller culling against the region needs. Pinned by parity.test.ts.
  return {
    x: topLeft.x,
    y: topLeft.y,
    width: Math.max(0, bottomRight.x - topLeft.x),
    height: Math.max(0, bottomRight.y - topLeft.y),
  };
};

// NOT GROUNDED. The kernel form of visibleWorldRect above. It divides the inset viewport extent by
// zoom instead of projecting the second corner, which is the same result without a second
// screenToWorld. That substitution is ours and is pinned by parity.test.ts.
export const visibleWorldRectKernel = tgpu.fn(
  [View, Insets],
  Rect,
)((camera, insets) => {
  "use gpu";
  const origin = screenToWorldKernel(d.vec2f(insets.left, insets.top), camera);
  return Rect({
    x: origin.x,
    y: origin.y,
    width: std.max(0, camera.viewport.x - insets.left - insets.right) / camera.zoom,
    height: std.max(0, camera.viewport.y - insets.top - insets.bottom) / camera.zoom,
  });
});

// NOT GROUNDED. The viewport inset by its safe-area margins, in screen coordinates.
export const viewportRect = tgpu.fn(
  [View, Insets],
  Rect,
)((camera, insets) => {
  "use gpu";
  return Rect({
    x: insets.left,
    y: insets.top,
    width: std.max(0, camera.viewport.x - insets.left - insets.right),
    height: std.max(0, camera.viewport.y - insets.top - insets.bottom),
  });
});
