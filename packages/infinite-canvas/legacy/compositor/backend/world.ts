import { d, std, tgpu } from "typegpu";

import { WindowInstance, WindowInstances, instanceCount } from "./instances";

const WORKGROUP_SIZE = 64;

/**
 * How fast the world reaches the document, per second. Higher settles sooner.
 * At 14 a window covers about half the distance in 50ms.
 */
const SETTLE_RATE = 14;

/** Seconds since the last simulated frame. */
const WorldClock = d.struct({ dt: d.f32 });

const clock = tgpu.accessor(WorldClock);

/** What the document asks for this frame. The surface writes it. */
const targets = tgpu.accessor(WindowInstances);

/** What the world is. This step writes it; passes read it through `instances`. */
const bodies = tgpu.mutableAccessor(WindowInstances);

/**
 * One step of the world. Every window moves toward what the document asks
 * for, so nothing a pass draws can jump. The rate is per second, so a slow
 * frame covers the same ground as several fast ones.
 */
const settleWorld = tgpu.computeFn({
  in: { gid: d.builtin.globalInvocationId },
  workgroupSize: [WORKGROUP_SIZE],
})((input) => {
  "use gpu";
  const index = input.gid.x;

  if (index >= instanceCount.$) {
    return;
  }

  const target = targets.$[index];
  const body = bodies.$[index];
  const amount = 1 - std.exp(-SETTLE_RATE * clock.$.dt);
  // A body with no width was never simulated, so a new window starts settled
  // instead of flying in from whatever last held its slot.
  const blend = std.select(amount, 1, body.rect.z <= 0);

  bodies.$[index] = WindowInstance({
    rect: std.mix(body.rect, target.rect, blend),
    state: std.mix(body.state, target.state, blend),
    tint: std.mix(body.tint, target.tint, blend),
  });
});

/** Workgroups needed for this many windows. */
function getWorldWorkgroups(windowCount: number) {
  return Math.ceil(windowCount / WORKGROUP_SIZE);
}

export { WorldClock, bodies, clock, getWorldWorkgroups, settleWorld, targets };
