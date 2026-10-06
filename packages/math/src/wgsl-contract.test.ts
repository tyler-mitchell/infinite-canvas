import { tgpu } from "typegpu";
import { expect, test } from "vite-plus/test";
import * as cpu from "./cpu";
import * as gpu from "./gpu";

test.each(Object.entries(gpu).filter(([, value]) => typeof value !== "number"))(
  "%s emits WGSL",
  (_name, value) => {
    const wgsl = tgpu.resolve([value as never]);
    expect(wgsl).toMatch(/\b(?:fn|struct) \w+/);
  },
);

test.each([
  "containsPoint",
  "intersectsRect",
  "unionRect",
  "screenToWorld",
  "worldToScreen",
] as const)("%s has separate CPU and GPU implementations", (name) => {
  expect(cpu[name]).not.toBe(gpu[name]);
});
