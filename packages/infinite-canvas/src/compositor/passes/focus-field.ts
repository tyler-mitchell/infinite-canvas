import * as sdf from "@typegpu/sdf";
import { common, d, std, tgpu } from "typegpu";

import type { InfiniteCanvasDropPayload } from "../../types";
import { camera, worldToScreen } from "../backend/camera";
import { instanceCount, instances } from "../backend/instances";
import { PREMULTIPLIED_OVER_BLEND, type InfiniteCanvasScenePass } from "../pass";
import { DEFAULT_FOCUS_FIELD_OPTIONS, type InfiniteCanvasFocusFieldOptions } from "../policy";

/** CSS pixels the medium stays lit around the active window. Bound per pass from the policy. */
const reachPx = tgpu.slot<number>(DEFAULT_FOCUS_FIELD_OPTIONS.reachPx);
/** How dark the medium becomes at full distance. Bound per pass from the policy. */
const dimStrength = tgpu.slot<number>(DEFAULT_FOCUS_FIELD_OPTIONS.dimStrength);

/**
 * Darkens the medium with distance from the active window. Reads the active
 * flag from the instances; when nothing is active the field stays clear.
 */
const focusFragment = tgpu.fragmentFn({ in: { uv: d.vec2f }, out: d.vec4f })((input) => {
  "use gpu";
  const screen = std.mul(input.uv, camera.$.viewport);
  let nearest = d.f32(1e9);
  let hasActive = d.f32(0);

  for (let index = d.u32(0); index < instanceCount.$; index++) {
    const instance = instances.$[index];

    if (instance.state.x > 0.5) {
      hasActive = 1;
      const topLeft = worldToScreen(d.vec2f(instance.rect.x, instance.rect.y), camera.$);
      const half = std.mul(d.vec2f(instance.rect.z, instance.rect.w), camera.$.zoom * 0.5);
      const centre = std.add(topLeft, half);

      // Signed, so a point inside the window reads negative. `smoothstep`
      // clamps that to zero, which is what the old clamped distance returned.
      nearest = std.min(nearest, sdf.sdBox2d(std.sub(screen, centre), half));
    }
  }

  const dim = std.smoothstep(0, reachPx.$, nearest) * dimStrength.$ * hasActive;

  // Premultiplied black at `dim` alpha; the over blend darkens what is beneath.
  return d.vec4f(0, 0, 0, dim);
});

/**
 * The focus field: the medium is bright around the active window and dims
 * with distance from it, so attention has a place on the canvas.
 */
function createInfiniteCanvasFocusFieldPass<
  Kind extends string = string,
  Payload = InfiniteCanvasDropPayload,
>(
  options: InfiniteCanvasFocusFieldOptions = DEFAULT_FOCUS_FIELD_OPTIONS,
): InfiniteCanvasScenePass<Kind, Payload> {
  return {
    build: ({ configured, format }) => {
      const pipeline = configured
        .with(reachPx, options.reachPx)
        .with(dimStrength, options.dimStrength)
        .createRenderPipeline({
          fragment: focusFragment,
          targets: { blend: PREMULTIPLIED_OVER_BLEND, format },
          vertex: common.fullScreenTriangle,
        });

      return {
        record: ({ target }) => {
          pipeline.withColorAttachment(target()).draw(3);
        },
      };
    },
    placement: "underlay",
    // World space, so `camera.$` is the world camera the rect projection needs.
    space: "world",
  };
}

export { createInfiniteCanvasFocusFieldPass, focusFragment };
