import { d, std, tgpu } from "typegpu";
import { clamp, clamp0, eqDelta, minMax } from "@thi.ng/math";

// An unbounded maximum is Infinity, which is why these are f64 and not d.vec2f. Types erase, so
// they carry no execution contract and sit beside the dual-target functions without mixing them.
// The layout engine's richer SizeLimits (min, max, ideal, measured) satisfies this structurally.
export type Size = { width: number; height: number };
export function pixelSize({
  width,
  height,
  scale = 1,
  pixelRatio = 1,
}: Size & {
  scale?: number;
  pixelRatio?: number;
}): Size & { pixelRatio: number } {
  return {
    width: Math.max(1, Math.round(width * scale)),
    height: Math.max(1, Math.round(height * scale)),
    pixelRatio: pixelRatio * scale,
  };
}
export type SizeLimits = { min: Size; max: Size };
export type SizeConstraints = SizeLimits & {
  ideal: Size;
  measured?: Size;
  aspect?: number;
};

export function resolveSize({
  constraints: { min, max, ideal, measured, aspect },
  proposal,
}: {
  constraints: SizeConstraints;
  proposal: Partial<Size>;
}): Size {
  if (aspect !== undefined) return fitAspectSize({ aspect, proposal, ideal, limits: { min, max } });
  const width = clamp(proposal.width ?? ideal.width, ...minMax(min.width, max.width));
  const height =
    measured !== undefined && eqDelta(measured.width, width, 0.5) ? measured.height : ideal.height;
  return {
    width,
    height: clamp(proposal.height ?? height, ...minMax(min.height, max.height)),
  };
}

export function intrinsicSize({
  frame,
  viewport,
  content,
}: {
  frame: Size;
  viewport: Pick<Size, "height">;
  content: Pick<Size, "height">;
}): Size {
  return { width: frame.width, height: content.height + clamp0(frame.height - viewport.height) };
}

// Source: @thi.ng/geom@8.3.38 fit-into-bounds.js:30-33 (fitIntoBounds2), the two per-axis ratios
// before the minimum is taken. The f64 form, which also hands back each axis so a caller can fit on
// one of them instead of both.
export const fitScales = (
  size: Size,
  within: Size,
): { horizontal: number; vertical: number; both: number } => {
  const horizontal = size.width <= 0 ? 1 : within.width / size.width;
  const vertical = size.height <= 0 ? 1 : within.height / size.height;
  return { horizontal, vertical, both: Math.min(horizontal, vertical) };
};

export function fitAspectSize({
  aspect,
  proposal,
  ideal,
  limits,
}: {
  aspect: number;
  proposal: Partial<Size>;
  ideal: Size;
  limits: SizeLimits;
}): Size {
  const scale = fitScales(
    { width: aspect, height: 1 },
    { width: proposal.width ?? ideal.width, height: proposal.height ?? Infinity },
  ).both;
  const minimum = Math.max(limits.min.width, limits.min.height * aspect);
  const maximum = Math.min(limits.max.width, limits.max.height * aspect);
  const width = clamp(scale * aspect, minimum, Math.max(minimum, maximum));
  return { width, height: width / aspect };
}

// Source: @thi.ng/geom@8.3.38 fit-into-bounds.js:30-33 (fitIntoBounds2), the scale factor:
//   minNonZero2(
//     safeDiv(dest.size[0], src.size[0]),
//     safeDiv(dest.size[1], src.size[1])
//   )
// The minimum of the two per-axis ratios is the contain factor. ADAPTED: upstream's safeDiv yields
// 0 for a zero denominator and minNonZero2 then skips it, so a collapsed axis silently falls back
// to the other one's ratio. That produces a scale from a dimension the caller never had; this
// returns 1 instead, leaving the size untouched, which is what a layout wants for unmeasured
// content. Pinned by size.test.ts.
export const containScale = tgpu.fn(
  [d.vec2f, d.vec2f],
  d.f32,
)((size, within) => {
  "use gpu";
  if (size.x <= 0 || size.y <= 0) {
    return 1;
  }
  return std.min(within.x / size.x, within.y / size.y);
});

// Source: @thi.ng/geom@8.3.38 fit-into-bounds.js:30-33 (fitIntoBounds2), the same two
// per-axis ratios with the maximum taken instead of the minimum. Upstream publishes only the
// contain case; cover is its dual and the substitution of max for min is the whole difference,
// which is why this sits beside containScale rather than deriving from it.
export const coverScale = tgpu.fn(
  [d.vec2f, d.vec2f],
  d.f32,
)((size, within) => {
  "use gpu";
  if (size.x <= 0 || size.y <= 0) {
    return 1;
  }
  return std.max(within.x / size.x, within.y / size.y);
});
