import { d } from "typegpu";

/** One window proxy: its world rect, and a tint standing in for its captured texture. */
export const Quad = d.struct({
  rect: d.vec4f,
  tint: d.vec4f,
});

export const Camera = d.struct({
  center: d.vec2f,
  viewport: d.vec2f,
  zoom: d.f32,
});
