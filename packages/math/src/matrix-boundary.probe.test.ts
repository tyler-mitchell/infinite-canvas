import { d, tgpu } from "typegpu";
import { describe, expect, test } from "vite-plus/test";

const identity2 = d.mat2x2f(1, 0, 0, 1);
const identity3 = d.mat3x3f(1, 0, 0, 0, 1, 0, 0, 0, 1);
const identity4 = d.mat4x4f(1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1);

const passThrough2 = tgpu.fn(
  [d.mat2x2f],
  d.mat2x2f,
)((value) => {
  "use gpu";
  return value;
});

const passThrough3 = tgpu.fn(
  [d.mat3x3f],
  d.mat3x3f,
)((value) => {
  "use gpu";
  return value;
});

const passThrough4 = tgpu.fn(
  [d.mat4x4f],
  d.mat4x4f,
)((value) => {
  "use gpu";
  return value;
});

const Holder3 = d.struct({ transform: d.mat3x3f });
const Holder4 = d.struct({ transform: d.mat4x4f });

const invalidArity = /constructor called with invalid number of arguments/;

describe("a padded matrix cannot cross the CPU boundary in typegpu 0.12.3", () => {
  test("only mat3x3f pads, so its storage length disagrees with its arity", () => {
    expect(identity2.length).toBe(2 * 2);
    expect(identity4.length).toBe(4 * 4);
    expect(identity3.length).toBe(12);
    expect(identity3.length).not.toBe(3 * 3);
  });

  test("mat3x3f cannot be a tgpu.fn parameter, because the call coerces through the schema", () => {
    expect(passThrough2(identity2)).toEqual(identity2);
    expect(passThrough4(identity4)).toEqual(identity4);
    expect(() => passThrough3(identity3)).toThrow(invalidArity);
  });

  test("and a mat3x3f struct field rejects the only value its type accepts", () => {
    expect(Holder4({ transform: identity4 }).transform).toEqual(identity4);
    expect(() => Holder3({ transform: identity3 })).toThrow(invalidArity);
  });
});
