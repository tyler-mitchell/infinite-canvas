import * as sdf from "@typegpu/sdf";
import { common, d, std, tgpu } from "typegpu";

import type { InfiniteCanvasDropPayload } from "../../types";
import { camera, worldToScreen } from "../backend/camera";
import { instanceCount, instances } from "../backend/instances";
import { PREMULTIPLIED_OVER_BLEND, type InfiniteCanvasScenePass } from "../pass";
import { DEFAULT_CONTACT_SHADOW_OPTIONS, type InfiniteCanvasContactShadowOptions } from "../policy";

/** Shadow tuning in world units, bound per pass from the policy. */
const cornerRadius = tgpu.slot<number>(DEFAULT_CONTACT_SHADOW_OPTIONS.cornerRadius);
const offset = tgpu.slot<number>(DEFAULT_CONTACT_SHADOW_OPTIONS.offset);
const opacity = tgpu.slot<number>(DEFAULT_CONTACT_SHADOW_OPTIONS.opacity);
const softness = tgpu.slot<number>(DEFAULT_CONTACT_SHADOW_OPTIONS.softness);

/**
 * Darkens the medium below every window. The shadow is the union of each
 * window's rounded-box distance field, shifted down by `offsetPx` and blurred
 * over `softnessPx`. Points inside a window keep no shadow: the DOM covers them.
 */
const shadowFragment = tgpu.fragmentFn({ in: { uv: d.vec2f }, out: d.vec4f })((input) => {
  "use gpu";
  const screen = std.mul(input.uv, camera.$.viewport);
  let shade = d.f32(0);
  let coverDistance = d.f32(1e9);

  for (let index = d.u32(0); index < instanceCount.$; index++) {
    const instance = instances.$[index];
    const topLeft = worldToScreen(d.vec2f(instance.rect.x, instance.rect.y), camera.$);
    const half = std.mul(d.vec2f(instance.rect.z, instance.rect.w), camera.$.zoom * 0.5);
    const centre = std.add(topLeft, half);
    // Height above the floor: 0 at the back of the stack, 1 at the front.
    const height = instance.state.w;
    // World units, so the shadow keeps its place in the world through a zoom.
    const lift = offset.$ * (0.4 + height * 1.6) * camera.$.zoom;
    const spread = softness.$ * (0.45 + height * 1.75) * camera.$.zoom;
    const distance = sdf.sdRoundedBox2d(
      std.sub(screen, std.add(centre, d.vec2f(0, lift))),
      half,
      cornerRadius.$ * camera.$.zoom,
    );
    // Each window carries its own shadow, so the nearest one wins here.
    const cast = (1 - std.smoothstep(0, spread, distance)) * opacity.$ * (1 - height * 0.45);

    shade = std.max(shade, cast);
    coverDistance = sdf.opUnion(
      coverDistance,
      sdf.sdRoundedBox2d(std.sub(screen, centre), half, cornerRadius.$ * camera.$.zoom),
    );
  }

  const uncovered = std.step(0, coverDistance);

  // Premultiplied black; the over blend darkens what is beneath.
  return d.vec4f(0, 0, 0, shade * uncovered);
});

/** A soft shadow below each window so the plane reads as lifted from the medium. */
function createInfiniteCanvasContactShadowPass<
  Kind extends string = string,
  Payload = InfiniteCanvasDropPayload,
>(
  options: InfiniteCanvasContactShadowOptions = DEFAULT_CONTACT_SHADOW_OPTIONS,
): InfiniteCanvasScenePass<Kind, Payload> {
  return {
    build: ({ configured, format }) => {
      const pipeline = configured
        .with(cornerRadius, options.cornerRadius)
        .with(offset, options.offset)
        .with(opacity, options.opacity)
        .with(softness, options.softness)
        .createRenderPipeline({
          fragment: shadowFragment,
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
    space: "world",
  };
}

export { createInfiniteCanvasContactShadowPass, shadowFragment };
