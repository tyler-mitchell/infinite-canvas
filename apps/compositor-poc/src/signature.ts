import { d, std, tgpu } from "typegpu";

const GRID = 24;

export const BANDS = 8;

const ROWS_PER_BAND = GRID / BANDS;

// The shader measures ink relative to the window ground.
const GROUND = 0.14;

export const Signature = d.struct({
  /** Each value is the ink density of one horizontal band. */
  bands: d.arrayOf(d.f32, BANDS),
  /** This vector stores the mean color of all sampled pixels. */
  ground: d.vec4f,
  /** xyz stores the content color. w stores the ink density. */
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
  // Separate axis steps support nonsquare texture layers.
  const stepX = d.i32(size.x) / GRID;
  const stepY = d.i32(size.y) / GRID;

  let ink = d.f32(0);
  let tint = d.vec3f(0, 0, 0);
  let hue = d.f32(0);
  let flat = d.vec3f(0, 0, 0);

  // One scalar per band prevents a local array and dynamic indexing.
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

        // Cubic chroma weighting prevents neutral text from dominating the accent color.
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
    // The scale puts typical note density near 1 and keeps values more than 1.
    std.min((ink / samples) * 55, 1.5),
  );
});
