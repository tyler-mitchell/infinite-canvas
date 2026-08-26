import { d, std, tgpu } from "typegpu";

/**
 * The canvas reading its own content.
 *
 * Every window's captured pixels live in one texture array, which means a compute pass can look at
 * all of them at once. Nothing else in a UI stack can do this: DOM cannot see its own rasterisation,
 * and a renderer that only draws cannot see what it drew. Here the pixels are just memory.
 *
 * What comes out is a signature per window — the colour of its content, how much ink is on it, the
 * colour of its ground, and a coarse profile of where its rows of content are. The window never
 * knows it was measured.
 *
 * One invocation per window over a fixed grid. No workgroup reduction and no atomics: 576 loads per
 * window means a 256-window canvas costs 147k loads, which is nothing. The simple version is the
 * correct version until a measurement says otherwise.
 */
const GRID = 24;

/** Rows of the profile. Eight is enough to tell a heading from a body from an action row. */
export const BANDS = 8;

const ROWS_PER_BAND = GRID / BANDS;

/**
 * How far a texel sits above the window's own ground, not its absolute brightness.
 *
 * A dark window with bright text has ink; an empty pale window does not. Using luminance directly
 * would have made "light background" mean "full of content", which is exactly backwards.
 */
const GROUND = 0.14;

export const Signature = d.struct({
  /** Ink density per horizontal band, top to bottom. */
  bands: d.arrayOf(d.f32, BANDS),
  /** Flat mean — dominated by the window's background, which is what makes it the ground. */
  ground: d.vec4f,
  /** Colour of the *content* in `xyz`, ink density in `w`. */
  tint: d.vec4f,
});

export const signatureLayout = tgpu.bindGroupLayout({
  signatures: { access: "mutable", storage: d.arrayOf(Signature) },
  windows: { texture: d.texture2dArray() },
});

export const analyzeWindows = tgpu.computeFn({
  in: { id: d.builtin.globalInvocationId },
  workgroupSize: [1],
})((input) => {
  "use gpu";
  const layer = d.i32(input.id.x);
  const size = std.textureDimensions(signatureLayout.$.windows);
  // Stepped per axis: the layer is shaped like the window, which is not square.
  const stepX = d.i32(size.x) / GRID;
  const stepY = d.i32(size.y) / GRID;

  let ink = d.f32(0);
  let tint = d.vec3f(0, 0, 0);
  let hue = d.f32(0);
  let flat = d.vec3f(0, 0, 0);

  /*
   * Banded outer loop rather than a flat sweep with an array of accumulators.
   *
   * Each band's sum stays a scalar local this way, so the shader needs no local array and no
   * dynamic indexing to build the profile — the same 576 samples, arranged so the reduction falls
   * out of the loop structure.
   */
  for (let band = 0; band < BANDS; band++) {
    let rows = d.f32(0);

    for (let row = 0; row < ROWS_PER_BAND; row++) {
      const y = band * ROWS_PER_BAND + row;

      for (let x = 0; x < GRID; x++) {
        const texel = std.textureLoad(
          signatureLayout.$.windows,
          d.vec2i(x * stepX, y * stepY),
          layer,
          0,
        );
        const luminance = std.dot(texel.xyz, d.vec3f(0.2126, 0.7152, 0.0722));
        const presence = std.max(luminance - GROUND, 0);

        ink = ink + presence;
        rows = rows + presence;
        flat = std.add(flat, texel.xyz);

        /*
         * Colour is weighted by chroma as well as presence, and steeply.
         *
         * A linear chroma weight is not enough to beat sheer count: body text is near-grey but
         * there is a great deal of it, so at first pass the accents, the near-grey text and the
         * background each contributed about a third and the result was mud. Cubing collapses the
         * weight for anything close to grey, so what survives is the colour a person would name if
         * asked what colour the window is.
         */
        const peak = std.max(std.max(texel.x, texel.y), std.max(texel.z, 0.0001));
        const floor = std.min(std.min(texel.x, texel.y), texel.z);
        const chroma = (peak - floor) / peak;
        const weight = presence * (chroma * chroma * chroma * 60 + 0.015);

        tint = std.add(tint, std.mul(texel.xyz, weight));
        hue = hue + weight;
      }
    }

    signatureLayout.$.signatures[layer].bands[band] = std.min(
      (rows / d.f32(ROWS_PER_BAND * GRID)) * 26,
      1,
    );
  }

  const samples = d.f32(GRID * GRID);

  signatureLayout.$.signatures[layer].ground = d.vec4f(std.div(flat, samples), 1);
  signatureLayout.$.signatures[layer].tint = d.vec4f(
    std.div(tint, std.max(hue, 0.0001)),
    /*
     * Scaled so a normally-filled note lands near 1 and an empty one near 0.
     *
     * The raw fraction is small — most texels are the window's own ground — and the constant has
     * been wrong in both directions: once seven times too small, producing a glow nobody could see,
     * and once three times too large, pinning every window at the ceiling so they all glowed
     * identically. Both were caught by the `ink` readout, which is why it is in the readout.
     */
    std.min((ink / samples) * 55, 1.5),
  );
});
