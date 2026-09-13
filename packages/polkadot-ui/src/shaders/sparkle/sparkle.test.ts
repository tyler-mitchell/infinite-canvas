import { tgpu } from "typegpu";
import { expect, test } from "vite-plus/test";

import { DEFAULT_FIELD_OPTIONS, createFieldFragment, settleFieldOptions } from "./field.ts";
import { DEFAULT_GLINT_OPTIONS, createGlintFragment } from "./glints.ts";

/*
 * Resolution is the whole of what a node process can ask of a shader: that TypeScript marked
 * "use gpu" becomes WGSL at all, and that a constant given as an option lands in it as a literal.
 * Whether it draws is asked in a browser.
 */

test("the field resolves to one fragment entry with its layer count inlined", () => {
  const wgsl = tgpu.resolve([createFieldFragment(DEFAULT_FIELD_OPTIONS)]);

  expect(wgsl).toContain("@fragment");
  expect(wgsl).toContain("<= 78");
});

test("an echo of zero leaves no second glow in the shader, and any echo puts one in", () => {
  const silent = tgpu.resolve([createFieldFragment({ ...DEFAULT_FIELD_OPTIONS, echo: 0 })]);
  const echoed = tgpu.resolve([createFieldFragment({ ...DEFAULT_FIELD_OPTIONS, echo: 0.5 })]);

  expect(silent).not.toContain(String(DEFAULT_FIELD_OPTIONS.echoShift));
  expect(echoed).toContain(String(DEFAULT_FIELD_OPTIONS.echoShift));
});

test("the glints resolve against the scene texture they read", () => {
  const wgsl = tgpu.resolve([createGlintFragment(DEFAULT_GLINT_OPTIONS)]);

  expect(wgsl).toContain("@fragment");
  expect(wgsl).toContain("texture_2d<f32>");
  expect(wgsl).toContain("textureSample(");
});

test("a layer count or render scale the shader cannot run is held inside what it can", () => {
  const spoiled = settleFieldOptions({
    ...DEFAULT_FIELD_OPTIONS,
    layers: Number.NaN,
    renderScale: 0,
  });
  const high = settleFieldOptions({ ...DEFAULT_FIELD_OPTIONS, layers: 400, renderScale: 3 });

  expect(spoiled.layers).toBe(1);
  expect(spoiled.renderScale).toBe(0.1);
  expect(high.layers).toBe(96);
  expect(high.renderScale).toBe(1);
  expect(settleFieldOptions(DEFAULT_FIELD_OPTIONS)).toEqual(DEFAULT_FIELD_OPTIONS);
});
