import { common, d, std, tgpu } from "typegpu";

import { getAdaptiveGridSpacing } from "../../geometry";
import type { InfiniteCanvasDropPayload } from "../../types";
import { camera, screenToWorld } from "../backend/camera";
import { PREMULTIPLIED_OVER_BLEND, type InfiniteCanvasScenePass } from "../pass";
import { DEFAULT_GRID_OPTIONS, type InfiniteCanvasGridOptions } from "../policy";

/** The spacing the camera's zoom chose this frame, in world units. */
const GridSpacing = d.struct({ minor: d.f32 });

const spacing = tgpu.accessor(GridSpacing);

/** Tuning, bound per pass from the policy. */
const falloff = tgpu.slot<number>(DEFAULT_GRID_OPTIONS.falloff);
const lineWidthPx = tgpu.slot<number>(DEFAULT_GRID_OPTIONS.lineWidthPx);
const majorEvery = tgpu.slot<number>(DEFAULT_GRID_OPTIONS.majorEvery);
const majorOpacity = tgpu.slot<number>(DEFAULT_GRID_OPTIONS.majorOpacity);
const minorOpacity = tgpu.slot<number>(DEFAULT_GRID_OPTIONS.minorOpacity);
const tint = tgpu.slot<d.v3f>(d.vec3f(...DEFAULT_GRID_OPTIONS.tint));

/**
 * How much of this pixel one axis of a grid line covers. The distance to the
 * nearest line is measured in world units and converted to pixels, so the line
 * keeps one width on screen at every zoom without a separate screen-space pass.
 */
const axisCoverage = tgpu.fn(
  [d.f32, d.f32],
  d.f32,
)((worldValue, step) => {
  "use gpu";
  const nearest = std.round(worldValue / step) * step;
  const pixels = std.abs(worldValue - nearest) * camera.$.zoom;

  return 1 - std.smoothstep(0, lineWidthPx.$, pixels);
});

/**
 * The grid on the medium. It is drawn in world space and fades toward the
 * edges of the view, so the plane recedes instead of tiling flat to the
 * corners the way a repeating background image does.
 */
const gridFragment = tgpu.fragmentFn({ in: { uv: d.vec2f }, out: d.vec4f })((input) => {
  "use gpu";
  const screen = std.mul(input.uv, camera.$.viewport);
  const world = screenToWorld(screen, camera.$);
  const minor = spacing.$.minor;
  const major = minor * majorEvery.$;
  const minorLine = std.max(axisCoverage(world.x, minor), axisCoverage(world.y, minor));
  const majorLine = std.max(axisCoverage(world.x, major), axisCoverage(world.y, major));
  // Distance from the middle of the view, 0 at the centre and 1 at a corner.
  const fromCentre = std.length(std.sub(input.uv, d.vec2f(0.5, 0.5))) * 1.4142;
  const depth = 1 - std.smoothstep(0, 1, fromCentre) * falloff.$;
  // A major line replaces the minor one under it rather than adding to it.
  const amount = std.max(minorLine * minorOpacity.$, majorLine * majorOpacity.$) * depth;

  // Premultiplied; the over blend lays the line on the background.
  return d.vec4f(std.mul(tint.$, amount), amount);
});

/**
 * The dot grid of the medium, drawn by the compositor rather than by a
 * repeating CSS background, so it lives in the same world as everything else
 * and can recede with distance.
 */
function createInfiniteCanvasGridPass<
  Kind extends string = string,
  Payload = InfiniteCanvasDropPayload,
>(
  options: InfiniteCanvasGridOptions = DEFAULT_GRID_OPTIONS,
): InfiniteCanvasScenePass<Kind, Payload> {
  return {
    build: ({ configured, format, root }) => {
      const spacingUniform = root.createUniform(GridSpacing, { minor: 100 });
      const pipeline = configured
        .with(spacing, spacingUniform)
        .with(falloff, options.falloff)
        .with(lineWidthPx, options.lineWidthPx)
        .with(majorEvery, options.majorEvery)
        .with(majorOpacity, options.majorOpacity)
        .with(minorOpacity, options.minorOpacity)
        .with(tint, d.vec3f(...options.tint))
        .createRenderPipeline({
          fragment: gridFragment,
          targets: { blend: PREMULTIPLIED_OVER_BLEND, format },
          vertex: common.fullScreenTriangle,
        });

      return {
        record: ({ context, target }) => {
          // The same spacing rule the DOM plane used, so nothing diverges.
          spacingUniform.write({ minor: getAdaptiveGridSpacing(context.camera.zoom) });
          pipeline.withColorAttachment(target()).draw(3);
        },
      };
    },
    placement: "underlay",
    space: "world",
  };
}

export { createInfiniteCanvasGridPass, gridFragment };
