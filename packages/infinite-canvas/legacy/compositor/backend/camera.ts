import { d, std, tgpu } from "typegpu";

/**
 * The per-space camera uniform. Units match the DOM plane: `viewport` and
 * `zoom` are CSS pixels, as in `worldRectToScreenRect`. `devicePixelRatio` is
 * the viewport's uncapped ratio for geometry that must land on device pixels.
 */
const CompositorCamera = d.struct({
  /** World units at the viewport centre. Zero for screen space. */
  center: d.vec2f,
  /** CSS pixels. */
  viewport: d.vec2f,
  /** CSS pixels per world unit. One for screen space. */
  zoom: d.f32,
  devicePixelRatio: d.f32,
});

/** The camera of the pass's space. The surface binds it; a shader reads `camera.$`. */
const camera = tgpu.accessor(CompositorCamera);

/** World to CSS-pixel screen, identical to worldPointToScreenPoint. */
const worldToScreen = tgpu.fn(
  [d.vec2f, CompositorCamera],
  d.vec2f,
)((world, camera) => {
  "use gpu";

  return std.add(
    std.mul(std.sub(world, camera.center), camera.zoom),
    std.mul(camera.viewport, 0.5),
  );
});

/** CSS-pixel screen back to world. The inverse of `worldToScreen`. */
const screenToWorld = tgpu.fn(
  [d.vec2f, CompositorCamera],
  d.vec2f,
)((screen, camera) => {
  "use gpu";

  return std.add(
    std.div(std.sub(screen, std.mul(camera.viewport, 0.5)), camera.zoom),
    camera.center,
  );
});

/** CSS-pixel screen to clip. */
const screenToClip = tgpu.fn(
  [d.vec2f, CompositorCamera],
  d.vec4f,
)((screen, camera) => {
  "use gpu";
  const clip = std.sub(std.mul(std.div(screen, camera.viewport), 2), d.vec2f(1, 1));

  return d.vec4f(clip.x, -clip.y, 0, 1);
});

export { CompositorCamera, camera, screenToClip, screenToWorld, worldToScreen };
