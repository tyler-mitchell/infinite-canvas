import { d, std, tgpu } from "typegpu";

const Film = d.struct({ cosine: d.f32, thickness: d.f32, ior: d.f32 });

// Air–film–air reflectance at three wavelengths; thickness is in nanometres.
export const thinFilmReflectance = tgpu.fn([Film], d.vec3f)((film) => {
  "use gpu";
  const cosine = std.clamp(film.cosine, 0, 1);
  const transmitted = std.sqrt(std.max(0, 1 - (1 - cosine * cosine) / (film.ior * film.ior)));
  const path = 2 * film.ior * film.thickness * transmitted;
  const phase = std.div(d.vec3f(2 * Math.PI * path), d.vec3f(650, 510, 475));
  const interference = std.sub(d.vec3f(1), std.cos(phase));
  const s = std.pow((cosine - film.ior * transmitted) / (cosine + film.ior * transmitted), 2);
  const p = std.pow((film.ior * cosine - transmitted) / (film.ior * cosine + transmitted), 2);
  const sNumerator = std.mul(interference, 2 * s);
  const pNumerator = std.mul(interference, 2 * p);
  const sReflectance = std.div(sNumerator, std.max(
    std.add(d.vec3f((1 - s) * (1 - s)), sNumerator), d.vec3f(1e-6),
  ));
  const pReflectance = std.div(pNumerator, std.max(
    std.add(d.vec3f((1 - p) * (1 - p)), pNumerator), d.vec3f(1e-6),
  ));
  return std.mul(std.add(sReflectance, pReflectance), 0.5);
});
