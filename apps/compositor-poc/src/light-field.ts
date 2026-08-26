import { d, std, tgpu } from "typegpu";

import { Camera, Quad } from "./scene.ts";
import { Signature } from "./signature.ts";

/**
 * The canvas lit by what is inside its windows.
 *
 * This is the visible half of the claim that the canvas can see its own content. The signature pass
 * measures each window's ink and colour; here each window emits light in proportion, so a dense
 * window glows and an empty one barely registers, in the window's own palette rather than a
 * decorator's.
 *
 * It is not decoration. At any zoom — including one where no text is legible — the lit regions are
 * where the substance is, so a canvas of hundreds of windows still reads as a map instead of a field
 * of grey rectangles. And because the signature is recomputed from the captured pixels every frame,
 * typing into a window makes its light grow while you type.
 *
 * Drawn as additive instanced quads rather than a loop in a fullscreen shader: one quad per window
 * is O(1) per window, where accumulating every window per pixel would be O(n) per fragment and lose
 * the property the rest of this PoC exists to establish.
 */
export const lightLayout = tgpu.bindGroupLayout({
  camera: { uniform: Camera },
  quads: { access: "readonly", storage: d.arrayOf(Quad) },
  signatures: { access: "readonly", storage: d.arrayOf(Signature) },
});

/** How far past a window's own bounds its light reaches, as a multiple of the window's size. */
const REACH = 0.95;

/**
 * Built per canvas rather than exported flat, because the shader needs the signature count as a
 * compile-time constant: signatures exist per distinct window texture while quads may repeat those
 * textures at scale, so the instance index has to wrap the same way the texture layer does.
 */
export const createLightField = (signatureCount: number) => ({
  fragment: tgpu.fragmentFn({
    in: { glow: d.vec4f, uv: d.vec2f },
    out: d.vec4f,
  })((input) => {
    "use gpu";
    // Radial, with a soft shoulder and a brighter core: one exponent alone reads either as a hard
    // disc or as a flat wash, and light is neither.
    const offset = std.mul(std.sub(input.uv, d.vec2f(0.5, 0.5)), 2);
    const reach = std.max(1 - std.length(offset), 0);
    /*
     * Three terms, because real light has three scales and one exponent can only ever have one.
     *
     * A wide ambient wash says a window is somewhere nearby, a mid falloff gives it a shape, and a
     * tight core gives it a source. With a single exponent the glow read either as a hard disc or
     * as fog.
     */
    const falloff =
      std.pow(reach, 1.15) * 0.26 + std.pow(reach, 3.5) * 0.55 + std.pow(reach, 10) * 0.4;

    /*
     * Nudged away from its own grey, not shoved.
     *
     * The measured colour is honest but muted — even a chroma-weighted average of a mostly
     * monochrome window lands near neutral, and near-neutral light reads as fog rather than as
     * coming from somewhere. But the first correction went far past that and turned six accent
     * colours into raw red, green and blue: unmistakable, and cheap-looking. The value below keeps
     * each window's hue identifiable while leaving it a colour rather than a channel.
     */
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

    // The quad grows with the window's ink, so a busy window's light reaches further than a quiet
    // one's — the spread carries information, not just the brightness.
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
