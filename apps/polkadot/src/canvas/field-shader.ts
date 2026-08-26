import { d, std, tgpu } from "typegpu";

/**
 * The field's shader, in TypeScript.
 *
 * Separated from the React component so the TypeGPU runtime inspector can validate the *shipped*
 * shader rather than a copy of it: `list_typegpu_exports` finds these, and a symbol target
 * compiles them against a real device. A shader that is only checked by a probe is a shader whose
 * probe is checked.
 *
 * Every constant a consumer would turn lives in `FieldUniforms` rather than in this source, so
 * changing the feel never recompiles anything.
 */

/** reach, mass, ceiling — see `FieldConfig.gravity`. */
const GRAVITY = "gravity";

const FieldUniforms = d.struct({
  dotLift: d.vec3f,
  dotRest: d.vec3f,
  gravity: d.vec3f,
  ground: d.vec3f,
  hoverAnchor: d.vec2f,
  hoverRadius: d.f32,
  /** line, dot, grain, vignette */
  intensity: d.vec4f,
  latticeOffset: d.vec2f,
  latticeStep: d.f32,
  pointer: d.vec2f,
  pointerActive: d.f32,
  resolution: d.vec2f,
  time: d.f32,
});

/** One window's footprint on screen, and how far its influence has faded in. */
const RectMass = d.struct({ rect: d.vec4f, strength: d.f32 });

/** Only eight fit a uniform array, and a ninth window contributes almost nothing anyway. */
const MAX_RECTS = 8;

const layout = tgpu.bindGroupLayout({
  masses: { uniform: d.arrayOf(RectMass, MAX_RECTS) },
  uniforms: { uniform: FieldUniforms },
});

/*
 * `layout.$` is reached inside each shader that uses it, never captured out here.
 *
 * `layout.bound` was removed in 0.12 and `layout.$` replaced it, but the two are not
 * interchangeable at module scope: `layout.$.uniforms` is a proxy whose getter throws
 * "Direct access to buffer values is possible only as part of a compute dispatch or draw call"
 * unless it is read from inside a shader body. Two module-level aliases stood here, so importing
 * this file threw before a single line of it ran — and because nothing mounts the field yet, that
 * had never once been executed. A binding read inside a `'use gpu'` body resolves to a WGSL
 * pointer (`let uniforms = (&uniforms_1);`), which is exactly what the aliases were meant to be.
 */

const random = tgpu.fn(
  [d.vec2f],
  d.f32,
)((st) => {
  "use gpu";

  return std.fract(std.sin(std.dot(st, d.vec2f(12.9898, 78.233))) * 43758.5453123);
});

/**
 * A window's pull on the lattice.
 *
 * Toward the window, not away from it: a window is a mass resting on the surface and the field
 * falls into it. The reference this is modelled on pushed the lattice aside instead, which reads
 * as a box shoving wallpaper rather than as something with weight.
 *
 * Mass grows with the window's footprint, referenced to a default note so a note pulls about one.
 * The falloff is a softened inverse square — a real well, finite at the centre, reaching much
 * further than a linear ramp so distant windows still bend the field a little.
 */
const rectPull = tgpu.fn(
  [d.vec2f, d.vec4f, d.f32],
  d.vec2f,
)((point, rect, strength) => {
  "use gpu";
  const uniforms = layout.$.uniforms;

  if (strength <= 0.001 || rect.z <= 0) {
    return d.vec2f();
  }

  const delta = std.sub(std.clamp(point, rect.xy, std.add(rect.xy, rect.zw)), point);
  const distanceToRect = std.length(delta);

  if (distanceToRect <= 0) {
    return d.vec2f();
  }

  const mass = std.sqrt(rect.z * rect.w) / 265;
  const pull =
    (uniforms[GRAVITY].y * mass) / (1 + std.pow(distanceToRect / uniforms[GRAVITY].x, 2));

  return std.mul(std.normalize(delta), pull * strength);
});

/** Every window's pull at once, capped so overlapping wells cannot tear the lattice open. */
const fieldPull = tgpu.fn(
  [d.vec2f],
  d.vec2f,
)((point) => {
  "use gpu";
  const uniforms = layout.$.uniforms;
  const masses = layout.$.masses;
  let total = d.vec2f();

  for (let index = 0; index < MAX_RECTS; index++) {
    total = std.add(total, rectPull(point, masses[index].rect, masses[index].strength));
  }

  const ceiling = uniforms[GRAVITY].z;

  return std.select(total, std.mul(std.normalize(total), ceiling), std.length(total) > ceiling);
});

const lineMask = tgpu.fn(
  [d.f32, d.f32],
  d.f32,
)((distanceToLine, width) => {
  "use gpu";

  return 1 - std.smoothstep(width, width + 1.1, distanceToLine);
});

/**
 * The field.
 *
 * `uv` arrives top-left from `fullScreenTriangle`, matching the pointer, the window rects, and the
 * camera. Written by hand against raw WebGL this needed a deliberate clip-space flip, and getting
 * it wrong mirrored the highlight about the horizontal centre.
 *
 * The highlight is composed rather than one glow — thin centre lines, faint half-step traces, a
 * lifted intersection dot, and a soft radial spotlight, each drawn separately. Its structure is
 * anchored to `hoverAnchor`, the pointer eased *between lattice intersections*, while only the
 * spotlight follows the cursor. That split is what makes it read as deliberate.
 */
const fieldFragment = tgpu["~unstable"].fragmentFn({
  in: { uv: d.vec2f },
  out: d.vec4f,
})((input) => {
  "use gpu";
  const uniforms = layout.$.uniforms;
  const frag = std.mul(input.uv, uniforms.resolution);
  const gravity = uniforms[GRAVITY];
  const intensity = uniforms.intensity;
  const pointerActive = uniforms.pointerActive;
  const hoverRadius = uniforms.hoverRadius;

  // Sampling from further out than this pixel sits is what drags the lattice inward: the line
  // that belongs further away is drawn here, so the whole field leans into the mass.
  const pull = fieldPull(frag);
  const warped = std.sub(std.add(frag, uniforms.latticeOffset), pull);
  // How deep in a well this pixel is, 0 at rest and 1 at the cap. Compression is the visible
  // signature of gravity, so this drives brightness rather than mere proximity.
  const depth = std.clamp(std.length(pull) / gravity.z, 0, 1);

  const step = uniforms.latticeStep;
  const halfStep = step * 0.5;
  const nearestLattice = std.mul(std.round(std.div(warped, step)), step);
  const dotDistance = std.length(std.sub(warped, nearestLattice));
  const lineDistance = std.min(
    std.abs(warped.x - nearestLattice.x),
    std.abs(warped.y - nearestLattice.y),
  );
  const nearestHalf = std.mul(std.round(std.div(warped, halfStep)), halfStep);
  const halfLineDistance = std.min(
    std.abs(warped.x - nearestHalf.x),
    std.abs(warped.y - nearestHalf.y),
  );

  // Brightness reads the field's own strength rather than asking a second time how far the
  // nearest window is. That query walked all eight rects again, doubling the per-pixel cost for
  // a number `pull` already contains — the pull *is* distance and mass, which is the physical
  // quantity brightness should follow anyway. Two curves off the one depth: the steep one lights
  // the rim a window sits in, the flatter one carries the long tail out across the canvas.
  const wellCore = depth * depth;
  const wellTail = depth;

  // The lit region is measured in screen space, against the anchor brought back out of lattice
  // space. Measuring it in warped space instead let a nearby window drag the highlight off the
  // cursor — the warp is for the lattice, not for where the light is.
  const anchorScreen = std.sub(uniforms.hoverAnchor, uniforms.latticeOffset);
  const anchorDistance = std.length(std.div(std.sub(frag, anchorScreen), d.vec2f(1.08, 0.9)));
  const pointerDistance = std.length(std.sub(frag, uniforms.pointer));
  const beam =
    std.pow(1 - std.smoothstep(hoverRadius * 0.136, hoverRadius, anchorDistance), 1.62) *
    pointerActive;
  const core =
    std.pow(1 - std.smoothstep(hoverRadius * 0.076, hoverRadius * 0.409, pointerDistance), 1.4) *
    pointerActive;
  const anchorCatch = (1 - std.smoothstep(0.8, 3, dotDistance)) * beam;
  const hoverLine = std.clamp(beam * 0.78 + core * 0.12 + anchorCatch * 0.1, 0, 1);
  const hoverDot =
    (1 - std.smoothstep(0.58, 1.5, dotDistance)) *
    std.pow(1 - std.smoothstep(hoverRadius * 0.152, hoverRadius * 0.955, anchorDistance), 1.45) *
    pointerActive;

  // The spotlight is the soft radial lift of the whole region, separate from the line and dot
  // structure. Without it the highlight is a few brighter pixels rather than a lit patch of
  // ground, which is what the field is for.
  const radial = std.pow(
    1 -
      std.smoothstep(
        hoverRadius * 0.152,
        hoverRadius * 1.121,
        std.length(std.div(std.sub(frag, uniforms.pointer), d.vec2f(1.1, 0.9))),
      ),
    1.74,
  );
  const glow = 1 - std.smoothstep(hoverRadius * 0.091, hoverRadius * 0.439, pointerDistance);
  const spotlightLine = radial * (0.7 + glow * 0.3) * pointerActive;
  const spotlightDot = std.pow(radial, 1.26) * (0.82 + glow * 0.2) * pointerActive;
  const spotlightGlint = (std.pow(glow, 1.8) * 0.62 + std.pow(radial, 2.4) * 0.22) * pointerActive;

  const hoverLineSignal = std.max(hoverLine * 0.88, spotlightLine * 0.18);
  const hoverDotSignal = std.max(hoverDot * 0.86, spotlightDot);
  const dynamic = std.max(hoverLine * 0.38, hoverDot * 0.28);

  // Cell noise, so the field is not a printed grid. Two scales: broad patches and a finer grain.
  const largeCell = random(std.floor(std.div(std.add(frag, d.vec2f(31, 79)), 180)));
  const mediumCell = random(std.floor(std.div(std.add(frag, d.vec2f(97, 17)), 80)));
  const cellTexture = 0.72 + largeCell * 0.18 + mediumCell * 0.1;
  const vignette = std.mix(
    1,
    std.smoothstep(1.05, 0.3, std.length(std.sub(input.uv, d.vec2f(0.5, 0.5)))),
    intensity.w,
  );
  const visibility = std.clamp(cellTexture * (0.55 + vignette * 0.55) + dynamic * 0.46, 0, 1);

  const sparseSeed = random(std.add(std.mul(nearestLattice, 0.037), d.vec2f(3.7, 8.1)));
  const sparseDot = (0.58 + std.pow(sparseSeed, 0.72) * 0.42) * (0.86 + mediumCell * 0.22);
  const shimmer =
    0.9 + std.sin(uniforms.time * (0.74 + sparseSeed * 1.2) + sparseSeed * 6.2831853) * 0.1;
  // Matter falling into a well gets denser, not fatter: dots tighten and brighten as they are
  // drawn in, and swell across the rim — the band where the field is stretched most, which is
  // mid-depth rather than at either end, hence the sine.
  const rim = std.sin(depth * 3.14159265);
  const dotRadius = std.max(
    0.34,
    std.mix(0.52, 0.42 + rim * 0.62, std.clamp(wellTail + dynamic, 0, 1)) - depth * 0.22,
  );
  const dotMask = 1 - std.smoothstep(dotRadius, dotRadius + 1, dotDistance);

  const litLines = std.clamp(visibility + hoverLineSignal * 0.33, 0, 1);
  const litDots = std.clamp(visibility + hoverDotSignal * 0.62, 0, 1);
  const halfLineCore = lineMask(halfLineDistance, 0.08);
  const majorLineCore = lineMask(lineDistance, 0.32 + dynamic * 0.5);
  const baseLineAlpha = (0.0045 + wellTail * 0.028) * (0.82 + largeCell * 0.24);

  const lineAlpha =
    majorLineCore *
    std.max(baseLineAlpha + hoverLineSignal * 0.041 + spotlightGlint * 0.011, dynamic * 0.18) *
    litLines *
    intensity.x;
  const halfLineAlpha =
    halfLineCore *
    (0.005 + hoverLineSignal * 0.0034) *
    (1 - dotMask * 0.78) *
    litLines *
    intensity.x;
  const dotAlpha =
    dotMask *
    sparseDot *
    (0.5 + wellCore * 0.5 + dynamic * 0.24 + hoverDotSignal * 0.64 + spotlightGlint * 0.2) *
    shimmer *
    litDots *
    intensity.y;

  const fine =
    random(
      std.add(
        std.mul(std.div(frag, std.max(uniforms.resolution, d.vec2f(1, 1))), 1000),
        d.vec2f(uniforms.time * 0.1, uniforms.time * 0.1),
      ),
    ) - 0.5;
  const coarse =
    random(std.floor(std.div(std.add(frag, d.vec2f(uniforms.time * 5, uniforms.time * 5)), 3))) -
    0.5;
  const grain = (fine * 0.019 + coarse * 0.006) * intensity.z;

  const ground = std.mul(uniforms.ground, 0.86 + vignette * 0.18);
  const lineColor = std.mix(
    uniforms.dotRest,
    uniforms.dotLift,
    std.clamp(dynamic * 1.35 + hoverLineSignal * 1.44, 0, 1),
  );
  const dotColor = std.mix(
    std.mix(uniforms.dotRest, d.vec3f(1, 1, 1), wellCore * 0.42),
    uniforms.dotLift,
    std.clamp(dynamic * 0.42 + hoverDotSignal * 0.7, 0, 1),
  );

  // Constructed rather than aliased: TGSL rejects binding a reference to `let`, because a later
  // reassignment would be writing through to whatever the reference points at.
  let color = d.vec3f(ground);

  color = std.mix(color, uniforms.dotRest, std.clamp(halfLineAlpha, 0, 1));
  color = std.mix(color, lineColor, std.clamp(lineAlpha, 0, 1));
  color = std.mix(color, dotColor, std.clamp(dotAlpha, 0, 1));
  // Added rather than mixed: the lit region has to gain light, not merely swap the colour of the
  // few pixels a line already covered.
  //
  // Deliberately *not* scaled by the ink intensities. These terms are already gated by the line
  // and dot masks, so multiplying by them again compounded — at a line weight of 2.4 the hover
  // stopped being a lift and became a hot amber tile sitting on the canvas.
  color = std.add(
    color,
    std.mul(uniforms.dotLift, hoverLineSignal * std.max(majorLineCore, halfLineCore) * 0.09),
  );
  color = std.add(color, std.mul(uniforms.dotLift, hoverDot * 0.1));
  color = std.add(color, d.vec3f(grain, grain, grain));

  return d.vec4f(color.x, color.y, color.z, 1);
});

export { fieldFragment, FieldUniforms, layout, MAX_RECTS, RectMass };
