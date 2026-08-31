import { d, std, tgpu } from "typegpu";

import { Camera, Quad } from "./scene.ts";
import { Signature } from "./signature.ts";

export const lightLayout = tgpu.bindGroupLayout({
  camera: { uniform: Camera },
  quads: { access: "readonly", storage: d.arrayOf(Quad) },
  signatures: { access: "readonly", storage: d.arrayOf(Signature) },
});

// REACH scales the light margin from the window size and ink density.
const REACH = 0.95;

// The shader requires a compile-time signature count.
export const createLightField = (signatureCount: number) => ({
  fragment: tgpu.fragmentFn({
    in: { glow: d.vec4f, uv: d.vec2f },
    out: d.vec4f,
  })((input) => {
    "use gpu";
    // These terms set the ambient wash, shape, and core.
    const offset = std.mul(std.sub(input.uv, d.vec2f(0.5, 0.5)), 2);
    const reach = std.max(1 - std.length(offset), 0);
    const falloff =
      std.pow(reach, 1.15) * 0.26 + std.pow(reach, 3.5) * 0.55 + std.pow(reach, 10) * 0.4;

    // This mix increases the distance from gray.
    const grey = std.dot(input.glow.xyz, d.vec3f(0.3333, 0.3333, 0.3333));
    const colour = std.max(std.mix(d.vec3f(grey, grey, grey), input.glow.xyz, 2.55), d.vec3f(0));

    return d.vec4f(std.mul(colour, falloff * input.glow.w * 0.88), 1);
  }),

  vertex: tgpu.vertexFn({
    in: { instanceIndex: d.builtin.instanceIndex, vertexIndex: d.builtin.vertexIndex },
    out: { glow: d.vec4f, pos: d.builtin.position, uv: d.vec2f },
  })((input) => {
    "use gpu";
    const corners = [
      d.vec2f(0, 0),
      d.vec2f(1, 0),
      d.vec2f(0, 1),
      d.vec2f(0, 1),
      d.vec2f(1, 0),
      d.vec2f(1, 1),
    ];
    const corner = corners[input.vertexIndex];
    const quad = lightLayout.$.quads[input.instanceIndex];
    const camera = lightLayout.$.camera;
    const signature = lightLayout.$.signatures[input.instanceIndex % signatureCount].tint;

    // Ink density controls the light range.
    const spread = d.vec2f(quad.rect.z, quad.rect.w);
    const margin = std.mul(spread, REACH * signature.w);
    const origin = std.sub(d.vec2f(quad.rect.x, quad.rect.y), margin);
    const extent = std.add(spread, std.mul(margin, 2));

    const world = std.add(origin, std.mul(corner, extent));
    const screen = std.add(
      std.mul(std.sub(world, camera.center), camera.zoom),
      std.mul(camera.viewport, 0.5),
    );
    const clip = std.sub(std.mul(std.div(screen, camera.viewport), 2), d.vec2f(1, 1));

    return {
      glow: signature,
      pos: d.vec4f(clip.x, -clip.y, 0, 1),
      uv: corner,
    };
  }),
});
