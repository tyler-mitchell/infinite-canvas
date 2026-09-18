/// <reference lib="dom" />
import { d, tgpu, type TgpuRoot } from "typegpu";

const STEPS = 10;

const addPinned = tgpu.fn(
  [d.f32, d.f32],
  d.f32,
)((total, step) => {
  "use gpu";
  return total + step;
});

const addLoose = (total: number, step: number) => {
  "use gpu";
  return total + step;
};

const chainPinned = tgpu.fn(
  [d.f32, d.f32],
  d.f32,
)((start, step) => {
  "use gpu";
  let total = start;
  for (let index = 0; index < STEPS; index++) {
    total = addPinned(total, step);
  }
  return total;
});

const chainLoose = tgpu.fn(
  [d.f32, d.f32],
  d.f32,
)((start, step) => {
  "use gpu";
  let total = start;
  for (let index = 0; index < STEPS; index++) {
    total = addLoose(total, step);
  }
  return total;
});

// 'from' is a WGSL reserved keyword and cannot be a struct field name.
const Input = d.struct({ start: d.f32, step: d.f32 });
const Output = d.struct({ pinned: d.f32, loose: d.f32 });

export async function inspect({ root }: { root: TgpuRoot }) {
  const input = root.createUniform(Input);
  input.write({ start: 1e7, step: 0.1 });
  const output = root.createMutable(Output);

  const kernel = root.createGuardedComputePipeline(() => {
    "use gpu";
    output.$.pinned = chainPinned(input.$.start, input.$.step);
    output.$.loose = chainLoose(input.$.start, input.$.step);
  });

  kernel.dispatchThreads();
  const gpu = await output.buffer.read();

  const cpuPinned = chainPinned(1e7, 0.1);
  const cpuLoose = chainLoose(1e7, 0.1);

  console.log(`gpu    pinned=${gpu.pinned} loose=${gpu.loose}`);
  console.log(`cpu    pinned=${cpuPinned} loose=${cpuLoose}`);
  console.log(`error  pinned=${Math.abs(cpuPinned - gpu.pinned)}`);
  console.log(`error  loose=${Math.abs(cpuLoose - gpu.loose)}`);

  if (gpu.pinned !== gpu.loose) {
    throw new Error(
      `The two GPU results differ (${gpu.pinned} vs ${gpu.loose}), so this measures the shader and not the CPU boundary form.`,
    );
  }

  const verdict =
    Math.abs(cpuPinned - gpu.pinned) < Math.abs(cpuLoose - gpu.loose)
      ? "tgpu.fn is closer to the GPU"
      : Math.abs(cpuPinned - gpu.pinned) > Math.abs(cpuLoose - gpu.loose)
        ? "the plain callback is closer to the GPU"
        : "the two boundary forms are indistinguishable here";
  console.log(`verdict  ${verdict}`);

  return { label: "boundary-form", kind: "compute-pipeline" as const, value: kernel };
}
