import { d, std, tgpu } from "typegpu";
import { insetIntervalLength, insetIntervalStart } from "./interval";
import { Insets, Rect } from "./rect";

export const Camera = d.struct({ center: d.vec2f, viewport: d.vec2f, zoom: d.f32 });
export type Camera = d.Infer<typeof Camera>;

export const worldToScreen = tgpu.fn(
  [d.vec2f, Camera],
  d.vec2f,
)((world, camera) => {
  "use gpu";
  return std.add(
    std.mul(std.sub(world, camera.center), camera.zoom),
    std.mul(camera.viewport, 0.5),
  );
});

export const screenToWorld = tgpu.fn(
  [d.vec2f, Camera],
  d.vec2f,
)((screen, camera) => {
  "use gpu";
  return std.add(
    std.div(std.sub(screen, std.mul(camera.viewport, 0.5)), camera.zoom),
    camera.center,
  );
});

export const screenToClip = tgpu.fn(
  [d.vec2f, Camera],
  d.vec4f,
)((screen, camera) => {
  "use gpu";
  const clip = std.sub(std.mul(std.div(screen, camera.viewport), 2), d.vec2f(1, 1));
  return d.vec4f(clip.x, -clip.y, 0, 1);
});

export const cameraShowing = tgpu.fn(
  [d.vec2f, d.vec2f, d.f32, d.vec2f],
  Camera,
)((worldPoint, screenPoint, zoom, viewport) => {
  "use gpu";
  return Camera({
    zoom,
    viewport,
    center: std.sub(worldPoint, std.div(std.sub(screenPoint, std.mul(viewport, 0.5)), zoom)),
  });
});

export const zoomCameraAbout = tgpu.fn(
  [Camera, d.vec2f, d.f32],
  Camera,
)((camera, screenPoint, zoom) => {
  "use gpu";
  return cameraShowing(screenToWorld(screenPoint, camera), screenPoint, zoom, camera.viewport);
});

export const panCamera = tgpu.fn(
  [Camera, d.vec2f],
  Camera,
)((camera, screenDelta) => {
  "use gpu";
  return Camera({
    zoom: camera.zoom,
    viewport: camera.viewport,
    center: std.sub(camera.center, std.div(screenDelta, camera.zoom)),
  });
});

export const visibleWorldRect = tgpu.fn(
  [Camera, Insets],
  Rect,
)((camera, insets) => {
  "use gpu";
  const origin = screenToWorld(d.vec2f(insets.left, insets.top), camera);
  return Rect({
    x: origin.x,
    y: origin.y,
    width: insetIntervalLength(camera.viewport.x, insets.left, insets.right) / camera.zoom,
    height: insetIntervalLength(camera.viewport.y, insets.top, insets.bottom) / camera.zoom,
  });
});

export const viewportRect = tgpu.fn(
  [Camera, Insets],
  Rect,
)((camera, insets) => {
  "use gpu";
  return Rect({
    x: insetIntervalStart(0, insets.left),
    y: insetIntervalStart(0, insets.top),
    width: insetIntervalLength(camera.viewport.x, insets.left, insets.right),
    height: insetIntervalLength(camera.viewport.y, insets.top, insets.bottom),
  });
});
