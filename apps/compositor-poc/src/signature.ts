import { d, std, tgpu } from "typegpu";

/**
 * The canvas reading its own content.
 *
 * Every window's captured pixels live in one texture array, which means a compute pass can look at
 * all of them at once. Nothing else in a UI stack can do this: DOM cannot see its own rasterisation,
 * and a renderer that only draws cannot see what it drew. Here the pixels are just memory.
 *
 * What comes out is a signature per window — its dominant colour and how much ink is on it —
 * written to a buffer the render passes read. The window never knows it was measured.
 *
 * One invocation per window, sampling a fixed grid. No workgroup reduction and no atomics: at a
 * grid of 24 that is 576 loads per window, so a canvas of 256 windows costs 147k texture loads,
 * which is nothing. The simple version is the correct version until a measurement says otherwise.
 */
const GRID = 24;

/**
 * How far a texel sits above the window's own ground, not its absolute brightness.
 *
 * A dark window with bright text has ink; an empty pale window does not. Using luminance directly
 * would have made "light background" mean "full of content", which is exactly backwards.
 */
const GROUND = 0.14;

export const signatureLayout = tgpu.bindGroupLayout({
  signatures: { access: "mutable", storage: d.arrayOf(d.vec4f) },
  windows: { texture: d.texture2dArray() },
});

/** Dominant colour in `xyz`, ink density in `w`. */
export const analyzeWindows = tgpu.computeFn({
  in: { id: d.builtin.globalInvocationId },
  workgroupSize: [1],
})((input) => {
  "use gpu";
  const layer = d.i32(input.id.x);
  const size = std.textureDimensions(signatureLayout.$.windows);
  const step = d.i32(size.x) / GRID;

  let ink = d.f32(0);
  let tint = d.vec3f(0, 0, 0);
  let hue = d.f32(0);

  for (let y = 0; y < GRID; y++) {
    for (let x = 0; x < GRID; x++) {
      const texel = std.textureLoad(
        signatureLayout.$.windows,
        d.vec2i(x * step, y * step),
        layer,
        0,
      );
      const luminance = std.dot(texel.xyz, d.vec3f(0.2126, 0.7152, 0.0722));
      const presence = std.max(luminance - GROUND, 0);

      ink = ink + presence;

      /*
       * Colour is weighted by chroma as well as presence.
       *
       * Weighting by presence alone reports whatever the window has most of, and what a window has
       * most of is near-white body text — so every window came back the same warm grey and the
       * light field could only ever be a wash. Weighting by how far a texel is from grey lets the
       * accents, which are what actually distinguish one window from another, carry the hue.
       */
      const peak = std.max(std.max(texel.x, texel.y), std.max(texel.z, 0.0001));
      const floor = std.min(std.min(texel.x, texel.y), texel.z);
      const chroma = (peak - floor) / peak;
      /*
       * Cubed, and steeply.
       *
       * A linear chroma weight is not enough to beat sheer count: body text is near-grey but there
       * is a great deal of it, so at first pass the accents, the near-grey text and the background
       * each contributed about a third and the result was mud. Cubing makes the weight collapse for
       * anything close to grey, so what survives is the colour a person would name if asked what
       * colour the window is.
       */
      const weight = presence * (chroma * chroma * chroma * 60 + 0.015);

      tint = std.add(tint, std.mul(texel.xyz, weight));
      hue = hue + weight;
    }
  }

  const density = ink / d.f32(GRID * GRID);

  signatureLayout.$.signatures[layer] = d.vec4f(
    std.div(tint, std.max(hue, 0.0001)),
    /*
     * Scaled so a normally-filled note lands near 1 and an empty one near 0.
     *
     * The raw fraction is around 0.016 for a full note — most texels are the window's own ground,
     * and a 512² layer holding a 512×200 note is more than half empty besides. The first guess at
     * this constant was seven times too small and produced a glow nobody could see; the second
     * pinned every window at the ceiling, which is the same failure wearing the opposite sign.
     * Both were caught by the `ink` readout, which is why it is in the readout.
     */
    std.min(density * 55, 1.5),
  );
});
