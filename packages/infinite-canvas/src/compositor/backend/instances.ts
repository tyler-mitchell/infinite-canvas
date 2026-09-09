import { d, tgpu } from "typegpu";

import type { InfiniteCanvasWindowProxy } from "../../types";

/**
 * Per-window instance data. The surface writes one instance for every
 * window each frame from the window proxies. Passes draw instanced from it.
 */
const WindowInstance = d.struct({
  /**
   * World x, y, width, height. The only geometry the world carries: a pass
   * projects it with `worldToScreen`, so a screen rect stored beside this
   * would be a second copy of a derived value, free to disagree with it while
   * the world settles.
   */
  rect: d.vec4f,
  /** active, selected, pinned, normalized z (0 at the back, 1 at the front). */
  state: d.vec4f,
  /** sRGB and an emission weight. */
  tint: d.vec4f,
});

/** Windows beyond this count are not drawn. The buffer is fixed for the root's life. */
const WINDOW_INSTANCE_CAPACITY = 1024;

const WindowInstances = d.arrayOf(WindowInstance, WINDOW_INSTANCE_CAPACITY);

/** Every window instance. The surface binds it; a shader reads `instances.$[index]`. */
const instances = tgpu.accessor(WindowInstances);

/** How many leading entries of `instances` are live this frame. Written by the surface. */
const instanceCount = tgpu.accessor(d.u32);

/** sRGB every window carries. Per-window colour belongs in the policy, not here. */
const WINDOW_INSTANCE_TINT = [0.36, 0.72, 0.98] as const;

/** Struct-of-arrays form for `common.writeSoA`, one entry per instance. */
type WindowInstanceColumns = Readonly<{
  count: number;
  rect: Float32Array;
  state: Float32Array;
  tint: Float32Array;
}>;

function getWindowInstanceColumns(
  proxies: readonly InfiniteCanvasWindowProxy[],
): WindowInstanceColumns {
  const included = proxies.slice(0, WINDOW_INSTANCE_CAPACITY);
  const zRange = included.reduce(
    (range, proxy) => ({
      max: Math.max(range.max, proxy.zIndex),
      min: Math.min(range.min, proxy.zIndex),
    }),
    { max: Number.NEGATIVE_INFINITY, min: Number.POSITIVE_INFINITY },
  );
  const zSpan = Math.max(zRange.max - zRange.min, 1);
  const columns = {
    count: included.length,
    rect: new Float32Array(included.length * 4),
    state: new Float32Array(included.length * 4),
    tint: new Float32Array(included.length * 4),
  };

  included.forEach((proxy, index) => {
    const offset = index * 4;
    // Emission weight. The focused window carries the light; the rest sit back,
    // so focus reads. A flat range washes the whole canvas out.
    const restingEmission = proxy.isSelected ? 0.4 : 0.12;
    const emission = proxy.isActive ? 1 : restingEmission;

    columns.rect.set([proxy.rect.x, proxy.rect.y, proxy.rect.width, proxy.rect.height], offset);
    columns.state.set(
      [
        proxy.isActive ? 1 : 0,
        proxy.isSelected ? 1 : 0,
        proxy.isPinned ? 1 : 0,
        (proxy.zIndex - zRange.min) / zSpan,
      ],
      offset,
    );
    columns.tint.set([...WINDOW_INSTANCE_TINT, emission], offset);
  });

  return columns;
}

export {
  WINDOW_INSTANCE_CAPACITY,
  WindowInstance,
  WindowInstances,
  getWindowInstanceColumns,
  instanceCount,
  instances,
};
export type { WindowInstanceColumns };
