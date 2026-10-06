import { perlin2d } from "@typegpu/noise";
import * as sdf from "@typegpu/sdf";
import { d, std, tgpu } from "typegpu";

import type { InfiniteCanvasDropPayload } from "../../types";
import { camera, screenToClip, worldToScreen } from "../backend/camera";
import { instanceCount, instances } from "../backend/instances";
import { PREMULTIPLIED_OVER_BLEND, type InfiniteCanvasScenePass } from "../pass";
import { DEFAULT_PARTICLE_FIELD_OPTIONS, type InfiniteCanvasParticleFieldOptions } from "../policy";

/** The most particles one pass simulates. The policy `count` is clamped to it. */
const PARTICLE_CAPACITY = 4096;
const WORKGROUP_SIZE = 64;

/** Longest step one frame may simulate. A hidden tab returns with a large gap. */
const MAX_STEP_SECONDS = 1 / 20;

const Particle = d.struct({
  /** World units. */
  position: d.vec2f,
  /** World units per second. */
  velocity: d.vec2f,
});

const Particles = d.arrayOf(Particle, PARTICLE_CAPACITY);

const FrameClock = d.struct({
  /** Seconds since the last simulated frame, clamped. */
  dt: d.f32,
  /** Seconds since the pass was built. */
  time: d.f32,
});

/** Tuning, bound per pass from the policy. */
const activeBoost = tgpu.slot<number>(DEFAULT_PARTICLE_FIELD_OPTIONS.activeBoost);
const count = tgpu.slot<number>(DEFAULT_PARTICLE_FIELD_OPTIONS.count);
const damping = tgpu.slot<number>(DEFAULT_PARTICLE_FIELD_OPTIONS.damping);
const drift = tgpu.slot<number>(DEFAULT_PARTICLE_FIELD_OPTIONS.drift);
const flowScale = tgpu.slot<number>(DEFAULT_PARTICLE_FIELD_OPTIONS.flowScale);
const gravity = tgpu.slot<number>(DEFAULT_PARTICLE_FIELD_OPTIONS.gravity);
const maxSpeed = tgpu.slot<number>(DEFAULT_PARTICLE_FIELD_OPTIONS.maxSpeed);
const opacity = tgpu.slot<number>(DEFAULT_PARTICLE_FIELD_OPTIONS.opacity);
const reach = tgpu.slot<number>(DEFAULT_PARTICLE_FIELD_OPTIONS.reach);
const sizePx = tgpu.slot<number>(DEFAULT_PARTICLE_FIELD_OPTIONS.sizePx);
const tint = tgpu.slot<d.v3f>(d.vec3f(...DEFAULT_PARTICLE_FIELD_OPTIONS.tint));

/** The simulation state. The compute stage writes it; the draw reads it. */
const simulation = tgpu.mutableAccessor(Particles);
const field = tgpu.accessor(Particles);
const clock = tgpu.accessor(FrameClock);

/** Keeps a coordinate inside [min, max) by wrapping, so leaving one edge enters the other. */
const wrap = tgpu.fn(
  [d.f32, d.f32, d.f32],
  d.f32,
)((value, min, max) => {
  "use gpu";
  const span = max - min;

  return min + ((((value - min) % span) + span) % span);
});

/**
 * One step per particle: gentle drift, attraction toward every window that
 * weakens with distance, damping, and wrapping inside the visible world rect.
 */
const particleStep = tgpu.computeFn({
  in: { gid: d.builtin.globalInvocationId },
  workgroupSize: [WORKGROUP_SIZE],
})((input) => {
  "use gpu";
  const index = input.gid.x;

  if (index >= d.u32(count.$)) {
    return;
  }

  const particle = simulation.$[index];
  const dt = clock.$.dt;
  const time = clock.$.time;
  const halfExtent = std.div(std.mul(camera.$.viewport, 0.5), camera.$.zoom);
  // A margin outside the viewport, so particles enter and leave rather than pop.
  const margin = std.mul(halfExtent, 0.25);
  const min = std.sub(std.sub(camera.$.center, halfExtent), margin);
  const max = std.add(std.add(camera.$.center, halfExtent), margin);

  // A copy, not the buffer reference: a reference cannot be reassigned.
  let velocity = d.vec2f(particle.velocity);
  // Perlin gradient noise over the world, drifting slowly with time.
  const sampleAt = std.add(
    std.mul(particle.position, flowScale.$),
    d.vec2f(time * 0.06, time * 0.043),
  );
  const noise = perlin2d.sampleWithGradient(sampleAt);
  // The perpendicular of the gradient is a divergence-free flow, so the medium
  // carries particles along without ever gathering them anywhere.
  const flow = d.vec2f(-noise.z, noise.y);

  velocity = std.add(velocity, std.mul(flow, drift.$ * dt));

  for (let other = d.u32(0); other < instanceCount.$; other++) {
    const instance = instances.$[other];
    const rect = instance.rect;
    const half = std.mul(d.vec2f(rect.z, rect.w), 0.5);
    const offset = std.sub(particle.position, std.add(d.vec2f(rect.x, rect.y), half));
    // Negative inside the window, zero on its edge, positive outside.
    const signed = sdf.sdRoundedBox2d(offset, half, 0) / reach.$;
    // Always outward and always weaker with distance, so there is no contour a
    // particle can settle on. A window displaces the medium; it never traps it.
    const push = std.exp(-std.max(signed, 0) * 2);
    // The active window displaces more, so focus shows in the drift.
    const mass = 1 + activeBoost.$ * instance.state.x;
    // Divide by at least one unit, so a particle on the centre gets no NaN.
    const outward = std.div(offset, std.max(std.length(offset), 1));

    velocity = std.add(velocity, std.mul(outward, gravity.$ * mass * push * dt));
  }

  velocity = std.mul(velocity, std.max(1 - damping.$ * dt, 0));

  const speed = std.length(velocity);

  if (speed > maxSpeed.$) {
    velocity = std.mul(velocity, maxSpeed.$ / speed);
  }

  const moved = std.add(particle.position, std.mul(velocity, dt));

  simulation.$[index] = Particle({
    position: d.vec2f(wrap(moved.x, min.x, max.x), wrap(moved.y, min.y, max.y)),
    velocity,
  });
});

const particleVertex = tgpu.vertexFn({
  in: { instanceIndex: d.builtin.instanceIndex, vertexIndex: d.builtin.vertexIndex },
  out: { pos: d.builtin.position, speed: d.f32, uv: d.vec2f },
})((input) => {
  "use gpu";
  const corners = [
    d.vec2f(-1, -1),
    d.vec2f(1, -1),
    d.vec2f(-1, 1),
    d.vec2f(-1, 1),
    d.vec2f(1, -1),
    d.vec2f(1, 1),
  ];
  const corner = corners[input.vertexIndex];
  const particle = field.$[input.instanceIndex];
  const centre = worldToScreen(particle.position, camera.$);
  const screen = std.add(centre, std.mul(corner, sizePx.$ * 0.5));

  return {
    pos: screenToClip(screen, camera.$),
    speed: std.length(particle.velocity) / maxSpeed.$,
    uv: corner,
  };
});

const particleFragment = tgpu.fragmentFn({
  in: { speed: d.f32, uv: d.vec2f },
  out: d.vec4f,
})((input) => {
  "use gpu";
  const radial = std.length(input.uv);
  const disc = 1 - std.smoothstep(0.6, 1, radial);
  // Moving particles read slightly brighter, so pull toward a window is visible.
  const amount = disc * opacity.$ * (0.55 + 0.45 * std.min(input.speed, 1));

  // Premultiplied; the over blend lays the dot on the medium.
  return d.vec4f(std.mul(tint.$, amount), amount);
});

function getInitialParticles(): d.Infer<typeof Particle>[] {
  return Array.from({ length: PARTICLE_CAPACITY }, () => ({
    // A square around the world origin; the first step wraps it into the visible rect.
    position: d.vec2f(Math.random() * 2000 - 1000, Math.random() * 2000 - 1000),
    velocity: d.vec2f(0, 0),
  }));
}

/**
 * A field of small particles in the medium that drift and fall gently toward
 * the windows. One compute dispatch and one instanced draw per frame.
 */
function createInfiniteCanvasParticleFieldPass<
  Kind extends string = string,
  Payload = InfiniteCanvasDropPayload,
>(
  options: InfiniteCanvasParticleFieldOptions = DEFAULT_PARTICLE_FIELD_OPTIONS,
): InfiniteCanvasScenePass<Kind, Payload> {
  // Read once at creation: the pass is rebuilt with the policy, not on a media change.
  const still =
    options.respectReducedMotion &&
    typeof matchMedia === "function" &&
    matchMedia("(prefers-reduced-motion: reduce)").matches;

  return {
    build: ({ configured, format, root }) => {
      const total = Math.min(Math.max(Math.floor(options.count), 0), PARTICLE_CAPACITY);
      const state = root.createMutable(Particles, getInitialParticles());
      const frameClock = root.createUniform(FrameClock, { dt: 0, time: 0 });
      // Slot values must be applied after any `pipe`, which starts a fresh
      // configuration and drops what was bound before it.
      const tune = (cfg: typeof configured) =>
        cfg
          .with(clock, frameClock)
          .with(activeBoost, options.activeBoost)
          .with(count, total)
          .with(damping, options.damping)
          .with(drift, options.drift)
          .with(flowScale, options.flowScale)
          .with(gravity, options.gravity)
          .with(maxSpeed, options.maxSpeed)
          .with(opacity, options.opacity)
          .with(reach, options.reach)
          .with(sizePx, options.sizePx)
          .with(tint, d.vec3f(...options.tint));
      // The flow field samples Perlin noise, which needs its gradient cache on
      // the pipeline. The domain wraps at the cache size, so the field repeats
      // over a wide stretch of world rather than tiling visibly.
      const noiseCache = perlin2d.staticCache({ root, size: d.vec2u(24, 24) });
      const step = tune(configured.pipe(noiseCache.inject()))
        .with(simulation, state)
        .createComputePipeline({ compute: particleStep });
      const draw = tune(configured)
        .with(field, state.buffer.as("readonly"))
        .createRenderPipeline({
          fragment: particleFragment,
          targets: { blend: PREMULTIPLIED_OVER_BLEND, format },
          vertex: particleVertex,
        });
      const stepped = { done: false };

      return {
        compute: ({ deltaSeconds, elapsedSeconds }) => {
          // With reduced motion the particles stay where the first step placed them.
          if (total === 0 || (still && stepped.done)) {
            return;
          }

          stepped.done = true;

          // Cap the step so a hidden tab does not fling particles on return.
          frameClock.write({
            dt: Math.min(deltaSeconds, MAX_STEP_SECONDS),
            time: elapsedSeconds,
          });
          step.dispatchWorkgroups(Math.ceil(total / WORKGROUP_SIZE));
        },
        record: ({ target }) => {
          if (total === 0) {
            return;
          }

          draw.withColorAttachment(target()).draw(6, total);
        },
      };
    },
    placement: "underlay",
    space: "world",
  };
}

export { PARTICLE_CAPACITY, Particle, Particles, createInfiniteCanvasParticleFieldPass };
