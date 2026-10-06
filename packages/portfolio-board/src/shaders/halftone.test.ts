import { d, tgpu } from "typegpu";
import { expect, test } from "vite-plus/test";
import { halftone } from "./halftone.ts";

test("halftone resolves into one fragment entry", () => {
  const effect = halftone();
  const fragment = tgpu.fragmentFn({
    in: { uv: d.vec2f },
    out: d.vec4f,
  })(({ uv }) => {
    "use gpu";
    return effect(uv);
  });
  const wgsl = tgpu.resolve([fragment]);
  expect(wgsl.match(/@fragment/g)).toHaveLength(1);
  expect(wgsl).toContain("textureSample(");
  expect(wgsl).toContain("smoothstep(");
});

test("zero strength preserves the sampled color and alpha", () => {
  const color = d.vec4f(0.1, 0.2, 0.3, 0.5);
  const effect = halftone({
    strength: 0,
    sample: () => {
      "use gpu";
      return d.vec4f(color);
    },
  });
  expect(effect(d.vec2f(0.5))).toEqual(color);
});
