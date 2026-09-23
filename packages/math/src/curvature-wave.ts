import { d, std, tgpu } from "typegpu";

export const CurveSample = d.struct({ position: d.vec3f, tangent: d.vec3f });

export function curvatureWave({
  wavelength,
  bendAngle,
  harmonics = 12,
  anchor,
}: {
  wavelength: number;
  bendAngle: number;
  harmonics?: number;
  anchor?: number;
}) {
  const count = Math.max(2, Math.round(harmonics));
  const samples = Math.max(128, count * 16);
  const frequency = 2 * Math.PI / wavelength;
  const origin = anchor ?? 0;
  const coefficients = Array.from({ length: count + 1 }, (_, harmonic) =>
    Array.from({ length: samples }, (_, index) => {
      const phase = (index + 0.5) * 2 * Math.PI / samples;
      const angle = bendAngle * Math.sin(phase);
      return [
        Math.cos(angle) * Math.cos(harmonic * phase),
        Math.sin(angle) * Math.sin(harmonic * phase),
      ] as const;
    }).reduce(
      (sum, value) => [sum[0] + value[0] * 2 / samples, sum[1] + value[1] * 2 / samples],
      [0, 0],
    ),
  );
  const spectrum = tgpu.const(
    d.arrayOf(d.vec2f, count + 1),
    coefficients.map(([x, y]) => d.vec2f(x, y)),
  );

  return tgpu.fn([d.vec2f], CurveSample)((input) => {
    "use gpu";
    const phase = input.x * frequency - input.y;
    const anchorPhase = origin * frequency - input.y;
    let position = d.vec2f(spectrum.$[0].x * (input.x - origin) / 2, 0);
    let tangent = d.vec2f(spectrum.$[0].x / 2, 0);
    for (let harmonic = 1; harmonic <= count; harmonic++) {
      const coefficient = spectrum.$[harmonic];
      const angle = d.f32(harmonic) * phase;
      let sine = std.sin(angle);
      let cosine = std.cos(angle);
      if (anchor !== undefined) {
        sine -= std.sin(d.f32(harmonic) * anchorPhase);
        cosine -= std.cos(d.f32(harmonic) * anchorPhase);
      }
      position = std.add(position, std.div(d.vec2f(
        coefficient.x * sine,
        -coefficient.y * cosine,
      ), d.f32(harmonic) * frequency));
      tangent = std.add(tangent, d.vec2f(
        coefficient.x * std.cos(angle),
        coefficient.y * std.sin(angle),
      ));
    }
    return CurveSample({
      position: d.vec3f(position, 0),
      tangent: std.normalize(d.vec3f(tangent, 0)),
    });
  });
}
