import { common, d, std, tgpu } from "typegpu";

import type { InfiniteCanvasDropPayload } from "../../types";
import { camera, screenToWorld } from "../backend/camera";
import { instanceCount, instances } from "../backend/instances";
import { ADDITIVE_BLEND, type InfiniteCanvasScenePass } from "../pass";
import { DEFAULT_AREA_LIGHT_OPTIONS, type InfiniteCanvasAreaLightOptions } from "../policy";

/** Tuning, bound per pass from the policy. */
const heightStep = tgpu.slot<number>(DEFAULT_AREA_LIGHT_OPTIONS.heightStep);
const intensity = tgpu.slot<number>(DEFAULT_AREA_LIGHT_OPTIONS.intensity);

/**
 * Irradiance from one edge of the emitter, as TypeGPU's `rendering--area-light`
 * example computes it (`ltc.ts`, `edgeVectorFormFactor`). The rational term
 * approximates theta/sin(theta) without a transcendental call.
 */
const edgeFormFactor = tgpu.fn(
  [d.vec3f, d.vec3f],
  d.vec3f,
)((from, to) => {
  "use gpu";
  const cosAngle = std.dot(from, to);
  const absCos = std.abs(cosAngle);
  const numer = 0.8543985 + (0.4965155 + 0.0145206 * absCos) * absCos;
  const denom = 3.417594 + (4.1616724 + absCos) * absCos;
  const approx = numer / denom;
  const exact = 0.5 / std.sqrt(std.max(1 - cosAngle * cosAngle, 1e-7)) - approx;
  const thetaSinTheta = std.select(exact, approx, cosAngle > 0);

  return std.mul(std.cross(from, to), thetaSinTheta);
});

/** The clipped sphere approximation of the same example. */
const clippedSphereFormFactor = tgpu.fn(
  [d.vec3f],
  d.f32,
)((vectorIrradiance) => {
  "use gpu";
  const len = std.length(vectorIrradiance);

  return std.max((len * len + vectorIrradiance.z) / (len + 1), 0);
});

/**
 * How much of the receiver's hemisphere the emitter quad covers. This is the
 * example's `quadFormFactor` with the identity transform, which is its
 * diffuse term. Only its specular term needs the LTC lookup tables, so the
 * light below is exact without vendoring 315KB of baked data.
 *
 * The corners arrive already in the receiver's tangent basis. Our receiver is
 * the floor plane facing the viewer, so that basis is the identity and no
 * per-pixel basis has to be built.
 */
const quadFormFactor = tgpu.fn(
  [d.vec3f, d.vec3f, d.vec3f, d.vec3f],
  d.f32,
)((c0, c1, c2, c3) => {
  "use gpu";
  const l0 = std.normalize(c0);
  const l1 = std.normalize(c1);
  const l2 = std.normalize(c2);
  const l3 = std.normalize(c3);
  const vectorIrradiance = std.add(
    std.add(edgeFormFactor(l0, l1), edgeFormFactor(l1, l2)),
    std.add(edgeFormFactor(l2, l3), edgeFormFactor(l3, l0)),
  );

  return clippedSphereFormFactor(vectorIrradiance);
});

/**
 * Every window is a rectangular panel above the medium, facing down. The
 * medium is the floor it lights. Falloff, shape and softness all come out of
 * the geometry rather than from a blur radius, so a window that sits higher
 * spreads a wider, weaker pool of light.
 */
const areaLightFragment = tgpu.fragmentFn({ in: { uv: d.vec2f }, out: d.vec4f })((input) => {
  "use gpu";
  const screen = std.mul(input.uv, camera.$.viewport);
  const floor = screenToWorld(screen, camera.$);
  let light = d.vec3f(0, 0, 0);

  for (let index = d.u32(0); index < instanceCount.$; index++) {
    const instance = instances.$[index];
    const half = std.mul(d.vec2f(instance.rect.z, instance.rect.w), 0.5);
    const centre = std.add(d.vec2f(instance.rect.x, instance.rect.y), half);
    // The stack order says how far above the floor the panel sits.
    const height = std.max(instance.state.w * heightStep.$, 1);
    // From the shaded point on the floor up to the panel's centre.
    const toCentre = d.vec3f(centre.x - floor.x, centre.y - floor.y, height);
    const edgeU = d.vec3f(half.x, 0, 0);
    const edgeV = d.vec3f(0, half.y, 0);
    const form = quadFormFactor(
      std.sub(std.sub(toCentre, edgeU), edgeV),
      std.sub(std.add(toCentre, edgeU), edgeV),
      std.add(std.add(toCentre, edgeU), edgeV),
      std.add(std.sub(toCentre, edgeU), edgeV),
    );

    light = std.add(light, std.mul(instance.tint.xyz, form * instance.tint.w));
  }

  const colour = std.mul(light, intensity.$);
  const amount = std.min(std.max(std.max(colour.x, colour.y), colour.z), 1);

  // Premultiplied; the additive blend lets neighbouring windows add their light.
  return d.vec4f(colour, amount);
});

/**
 * The medium lit by the windows above it. Each window is a rectangular area
 * light and the floor takes its diffuse irradiance, so the light has a shape
 * and a distance rather than a radius.
 */
function createInfiniteCanvasAreaLightPass<
  Kind extends string = string,
  Payload = InfiniteCanvasDropPayload,
>(
  options: InfiniteCanvasAreaLightOptions = DEFAULT_AREA_LIGHT_OPTIONS,
): InfiniteCanvasScenePass<Kind, Payload> {
  return {
    build: ({ configured, format }) => {
      const pipeline = configured
        .with(heightStep, options.heightStep)
        .with(intensity, options.intensity)
        .createRenderPipeline({
          fragment: areaLightFragment,
          targets: { blend: ADDITIVE_BLEND, format },
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

export { areaLightFragment, createInfiniteCanvasAreaLightPass };
