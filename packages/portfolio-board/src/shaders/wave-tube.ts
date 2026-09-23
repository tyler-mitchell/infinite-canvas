import { hexToOklab, oklabToRgb } from "@typegpu/color";
import { curvatureWave, perspectiveMatrix } from "@hyphened/math/cpu";
import { thinFilmReflectance } from "@hyphened/math/gpu";
import { d, std, tgpu } from "typegpu";
import { frame, type SurfaceShader } from "./surface.ts";

export interface WaveTubeOptions {
  colors?: readonly [string, string, ...string[]];
  radius?: number;
  bendAngle?: number;
  range?: readonly [number, number];
  wavelength?: number;
  speed?: number;
  phase?: number;
  scale?: number;
  cameraDistance?: number;
  anchor?: number | null;
  rotation?: number;
  tilt?: number;
  elevation?: number;
  offset?: readonly [number, number];
  align?: "left" | "center" | "right";
  lightDirection?: readonly [number, number, number];
  ambient?: number;
  diffuse?: number;
  specular?: number;
  shininess?: number;
  gradientRange?: readonly [number, number];
  gradientSpeed?: number;
  iridescence?: {
    strength: number;
    thickness: readonly [number, number];
    ior: number;
  };
  segments?: number;
  radialSegments?: number;
  renderScale?: number;
}

export function waveTube({
  colors = ["#064e3b", "#00d99b", "#b9ffe7"],
  radius = 0.24,
  bendAngle = 1.1,
  range = [-4, 4],
  wavelength = 3,
  speed = 0.28,
  phase = 0,
  scale = 1,
  cameraDistance,
  anchor = 1,
  rotation = -0.3,
  tilt = 1.05,
  elevation = 0.95,
  offset = [0, 0],
  align = "center",
  lightDirection = [-0.4, -0.6, 1],
  ambient = 0.7,
  diffuse = 0.3,
  specular = 0.06,
  shininess = 24,
  gradientRange = range,
  gradientSpeed = 0,
  iridescence,
  segments = 192,
  radialSegments = 24,
  renderScale = 1,
}: WaveTubeOptions = {}): SurfaceShader {
  const palette = tgpu.const(d.arrayOf(d.vec3f, colors.length), colors.map(hexToOklab));
  const [start, end] = range;
  const length = end - start;
  const [gradientStart, gradientEnd] = gradientRange;
  const longitudinal = Math.max(8, Math.round(segments));
  const radial = Math.max(4, Math.round(radialSegments));
  const light = d.vec3f(...lightDirection);
  const origin = d.vec2f(...offset);
  const alignment = { left: -1, center: 0, right: 1 }[align];
  const projection =
    cameraDistance === undefined
      ? undefined
      : perspectiveMatrix({
          fieldOfView: 2 * Math.atan(0.5 / (scale * cameraDistance)),
          near: 0.01,
          far: cameraDistance + length + radius * 2,
        });
  const curve = curvatureWave({
    wavelength,
    bendAngle,
    anchor: anchor === null ? undefined : start + anchor * length,
  });
  const capLength = (Math.PI * radius) / 2;
  const extent = length + 2 * capLength;
  const corners = tgpu.const(d.arrayOf(d.vec2f, 6), [
    d.vec2f(0, 0),
    d.vec2f(1, 0),
    d.vec2f(0, 1),
    d.vec2f(0, 1),
    d.vec2f(1, 0),
    d.vec2f(1, 1),
  ]);

  const rotate = tgpu.fn(
    [d.vec3f],
    d.vec3f,
  )((surface) => {
    "use gpu";
    const depth = surface.y * std.sin(elevation) + surface.z * std.cos(elevation);
    const x = surface.x * std.cos(tilt) + depth * std.sin(tilt);
    const y = surface.y * std.cos(elevation) - surface.z * std.sin(elevation);
    return d.vec3f(
      x * std.cos(rotation) - y * std.sin(rotation),
      x * std.sin(rotation) + y * std.cos(rotation),
      -surface.x * std.sin(tilt) + depth * std.cos(tilt),
    );
  });

  const normal = tgpu.fn(
    [d.vec2f],
    d.vec3f,
  )((uv) => {
    "use gpu";
    const distance = uv.x * extent;
    const arc = std.clamp(distance - capLength, 0, length) + start;
    const angle =
      bendAngle *
      std.sin((arc * Math.PI * 2) / wavelength + (frame.$.time * speed + phase) * Math.PI * 2);
    const cap = (distance - std.clamp(distance, capLength, extent - capLength)) / radius;
    const around = uv.y * Math.PI * 2;
    const radial = std.cos(cap) * std.cos(around);
    return d.vec3f(
      -std.sin(angle) * radial + std.cos(angle) * std.sin(cap),
      std.cos(angle) * radial + std.sin(angle) * std.sin(cap),
      std.cos(cap) * std.sin(around),
    );
  });

  const vertex = tgpu.vertexFn({
    in: { vertexIndex: d.builtin.vertexIndex },
    out: { position: d.builtin.position, uv: d.vec2f },
  })(({ vertexIndex }) => {
    "use gpu";
    const cell = d.u32(vertexIndex / 6);
    const corner = corners.$[vertexIndex % 6];
    const uv = std.div(
      std.add(d.vec2f(d.u32(cell / radial), cell % radial), corner),
      d.vec2f(longitudinal, radial),
    );
    const arc = std.clamp(uv.x * extent - capLength, 0, length) + start;
    const sample = curve(d.vec2f(arc, -(frame.$.time * speed + phase) * Math.PI * 2));
    const p = rotate(std.add(sample.position, std.mul(normal(uv), radius)));
    const aspect = frame.$.resolution.x / frame.$.resolution.y;
    if (projection !== undefined && cameraDistance !== undefined) {
      const clip = std.mul(projection, d.vec4f(p.x, -p.y, p.z - cameraDistance, 1));
      return {
        position: d.vec4f(
          (clip.x + origin.x * 2 * clip.w) / aspect + alignment * (1 - 1 / aspect) * clip.w,
          clip.y - origin.y * 2 * clip.w,
          clip.zw,
        ),
        uv,
      };
    }
    return {
      position: d.vec4f(
        ((p.x * scale + origin.x) * 2) / aspect + alignment * (1 - 1 / aspect),
        -(p.y * scale + origin.y) * 2,
        0.5 - p.z / (length + radius * 4),
        1,
      ),
      uv,
    };
  });

  const source = tgpu.fragmentFn({ in: { uv: d.vec2f }, out: d.vec4f })(({ uv }) => {
    "use gpu";
    const facing = std.normalize(rotate(normal(uv)));
    const illumination = ambient + diffuse * std.max(0, std.dot(facing, std.normalize(light)));
    const highlight =
      specular *
      std.pow(
        std.max(0, std.dot(facing, std.normalize(std.add(std.normalize(light), d.vec3f(0, 0, 1))))),
        shininess,
      );
    const arc = uv.x * extent - capLength + start;
    const position = (arc - gradientStart) / (gradientEnd - gradientStart);
    const ratio =
      gradientSpeed === 0
        ? std.clamp(position, 0, 1) * (colors.length - 1)
        : std.fract(position + frame.$.time * gradientSpeed) * colors.length;
    const index = std.min(d.u32(ratio), d.u32(colors.length - 1));
    const color = oklabToRgb(
      std.mix(palette.$[index], palette.$[(index + 1) % colors.length], ratio - d.f32(index)),
    );
    if (iridescence !== undefined) {
      const cosine = std.clamp(facing.z, 0, 1);
      const thickness = std.mix(
        iridescence.thickness[0],
        iridescence.thickness[1],
        0.5 + 0.5 * std.sin((arc * Math.PI * 2) / wavelength),
      );
      const reflectance = thinFilmReflectance({ cosine, thickness, ior: iridescence.ior });
      const reflected = std.clamp(
        std.add(std.mul(reflectance, iridescence.strength), highlight),
        d.vec3f(0),
        d.vec3f(1),
      );
      return d.vec4f(reflected, std.max(reflected.x, std.max(reflected.y, reflected.z)));
    }
    return d.vec4f(std.add(std.mul(color, illumination), highlight), 1);
  });

  return { source, geometry: { vertex, vertexCount: longitudinal * radial * 6 }, renderScale };
}
