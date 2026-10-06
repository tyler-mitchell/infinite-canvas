import { d, std, tgpu } from "typegpu";

import type { InfiniteCanvasDropPayload, InfiniteCanvasWindowProximity } from "../../types";
import { WINDOW_INSTANCE_CAPACITY, instanceCount, instances } from "../backend/instances";
import type { InfiniteCanvasScenePass } from "../pass";
import { DEFAULT_PROXIMITY_OPTIONS, type InfiniteCanvasProximityOptions } from "../policy";

/** What the GPU knows about each window's surroundings after a frame. */
const WindowProximity = d.struct({
  /** World distance from this window's edge to the nearest other window's edge. */
  nearest: d.f32,
  /** Windows whose rect lies within `reach` world units. */
  neighbors: d.u32,
  /** Sum over neighbours of (1 - distance / reach), so crowding reads high. */
  pressure: d.f32,
  /** Index of the nearest window, or 0xffffffff when none is within reach. */
  nearestIndex: d.u32,
});

const WindowProximities = d.arrayOf(WindowProximity, WINDOW_INSTANCE_CAPACITY);

const NO_NEIGHBOR = 0xffffffff;
const WORKGROUP_SIZE = 64;

/** The reach of the proximity query in world units. Bound per pass from the policy. */
const reach = tgpu.slot<number>(DEFAULT_PROXIMITY_OPTIONS.reach);

/** The output of the query. Bound per pass to its own mutable buffer. */
const proximities = tgpu.mutableAccessor(WindowProximities);

/** Distance between two axis-aligned world rects. Zero when they overlap. */
const rectGap = tgpu.fn(
  [d.vec4f, d.vec4f],
  d.f32,
)((a, b) => {
  "use gpu";
  const dx = std.max(std.max(b.x - (a.x + a.z), a.x - (b.x + b.z)), 0);
  const dy = std.max(std.max(b.y - (a.y + a.w), a.y - (b.y + b.w)), 0);

  return std.length(d.vec2f(dx, dy));
});

const proximityCompute = tgpu.computeFn({
  in: { gid: d.builtin.globalInvocationId },
  workgroupSize: [WORKGROUP_SIZE],
})((input) => {
  "use gpu";
  const index = input.gid.x;

  if (index >= instanceCount.$) {
    return;
  }

  const own = instances.$[index].rect;
  let nearest = d.f32(reach.$);
  let nearestIndex = d.u32(NO_NEIGHBOR);
  let neighbors = d.u32(0);
  let pressure = d.f32(0);

  for (let other = d.u32(0); other < instanceCount.$; other++) {
    if (other === index) {
      continue;
    }

    const gap = rectGap(own, instances.$[other].rect);

    if (gap < reach.$) {
      neighbors += 1;
      pressure += 1 - gap / reach.$;

      if (gap < nearest) {
        nearest = gap;
        nearestIndex = other;
      }
    }
  }

  proximities.$[index] = WindowProximity({ nearest, nearestIndex, neighbors, pressure });
});

/**
 * Measures the space between windows on the GPU and publishes it to
 * `store.signals$.proximity`, read with `useInfiniteCanvasWindowProximity`.
 * Draws nothing.
 */
function createInfiniteCanvasProximityPass<
  Kind extends string = string,
  Payload = InfiniteCanvasDropPayload,
>(
  options: InfiniteCanvasProximityOptions = DEFAULT_PROXIMITY_OPTIONS,
): InfiniteCanvasScenePass<Kind, Payload> {
  return {
    build: ({ configured, root, signals$ }) => {
      const output = root.createMutable(WindowProximities);
      const pipeline = configured
        .with(reach, options.reach)
        .with(proximities, output)
        .createComputePipeline({ compute: proximityCompute });
      // One readback in flight at a time; a frame that lands mid-read is skipped, not queued.
      const readback = { pending: false };

      return {
        compute: ({ instanceCount: live }) => {
          if (live === 0) {
            return;
          }

          pipeline.dispatchWorkgroups(Math.ceil(live / WORKGROUP_SIZE));
        },
        readback: ({ context, instanceCount: live }) => {
          if (live === 0 || readback.pending) {
            return;
          }

          readback.pending = true;

          const windowIds = context.windows.slice(0, live).map((proxy) => proxy.id);

          void output
            .read()
            .then((values) => {
              const next: Record<string, InfiniteCanvasWindowProximity> = {};

              windowIds.forEach((windowId, index) => {
                const value = values[index];

                if (value === undefined) {
                  return;
                }

                next[windowId] = {
                  nearest: value.nearest,
                  nearestWindowId:
                    value.nearestIndex === NO_NEIGHBOR
                      ? null
                      : (windowIds[value.nearestIndex] ?? null),
                  neighbors: value.neighbors,
                  pressure: value.pressure,
                };
              });

              // Legend-State compares deeply, so an unchanged reading notifies nobody.
              signals$.proximity.set(next);
            })
            .finally(() => {
              readback.pending = false;
            });
        },
      };
    },
    placement: "underlay",
    space: "world",
  };
}

export { WindowProximities, WindowProximity, createInfiniteCanvasProximityPass };
