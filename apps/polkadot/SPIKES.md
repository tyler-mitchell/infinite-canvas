# Spikes

A spike answers a question through an executed test instead of source reading alone.
Each entry records the question, the executed test, the result, and the resulting decision.
The record includes tests whose result is "no".
A spike without an executed test is an opinion.

`BACKLOG.md` contains spikes that still require an executed test.

---

## TypeGPU for the field: **run and recommended**

The living field uses a fragment shader in a GLSL string.
Can [TypeGPU](https://docs.swmansion.com/TypeGPU/) express that shader in TypeScript?

Two browser-only defects came from the untyped shader string:

- `float half = ...` did not compile because `half` is a reserved word in GLSL ES.
  The canvas showed no output, and only the console showed the cause.
- A backtick in a comment ended the shader template string.
  TypeScript reported the error eighty lines later in valid code.

A TypeScript shader has no GLSL string or GLSL name collision.
These two defects cannot occur in that form.

The probe rewrote the actual field calculations in TGSL.
It included the pull from each rectangle, the limited total field, and the warped-lattice fragment.
The TypeGPU runtime inspector validated the probe on a real WebGPU device.

CAUTION: Read the current documentation before you select a TypeGPU version.
The probe used TypeGPU 0.11 from the bundled inspector copy.
The test did not examine the current release before it selected this version.

TypeGPU is at 0.12.3.
Version 0.12 removed `layout.bound`, the `withVertex(...).withFragment(...)` builder, and string-based texture layouts.
The corrected code uses the current API.
The runtime test still uses version 0.11 and has no later run on version 0.12.

The generated WGSL was correct.
The runtime created the pipeline with zero compilation messages:

```wgsl
@group(0) @binding(0) var<uniform> masses: array<RectMass, 8>;
@group(0) @binding(1) var<uniform> uniforms: FieldUniforms;

fn rectPull(point: vec2f, rect: vec4f, strength: f32) -> vec2f { … }
fn fieldPull(point: vec2f) -> vec2f { … }
@fragment fn item(@builtin(position) _arg_position: vec4f) -> @location(0) vec4f { … }
```

The probe produced one important error:

> Ternary operator is only supported for comptime-known checks. For runtime checks, please use
> `std.select` or if/else statements.

The current shader contains several runtime ternaries.
Each ternary has a direct conversion, but the port requires this work.

TypeGPU provides these benefits:

- The TypeScript representation prevents the two string defects.
- One schema can replace the two current `FieldConfig` representations.
- The current uniform write is `gl.uniform3f(locations.gravity, reach, mass, ceiling)`.
  It uses three positional values whose order has no type test.
  A schema derives both representations and gives each value a name.
- Typed access replaces uniform-location string lookups.
  A typo in `uniform("uGravity")` currently returns `null` without an error.
  A compiler-removed uniform causes the same result.
- TypeGPU infers the bind group layout.

TypeGPU also adds these costs and limits:

- TypeGPU targets WebGPU, while the current field works where WebGL2 works.
  Chrome-first is already a project constraint.
- The TypeGPU documentation contains the heading "Leaving WebGL behind".
  `@typegpu/gl` provides an experimental WebGL 2 fallback through `initWithGLFallback()`.
  The fallback supports vertex pipelines, fragment pipelines, constants, uniforms, and 2D textures.
  It does not support storage buffers, bind groups, or compute pipelines.
  The full-screen field fits the supported set.
- The application gains a runtime dependency.
  The Vite configuration also requires `unplugin-typegpu` for TypeScript shader compilation.
- TGSL has the ternary limit and can have more limits that this probe did not encounter.

Port the field to TypeGPU.
The codebase has one shader, and `renderBackdrop` isolates it in one file.
The port replaces the GLSL implementation.
A WebGL fallback kept "just in case" creates two field implementations that can drift.

The headless inspector uses SwiftShader.
The test proves shader compilation and pipeline creation.
It does not prove adequate speed.

Compare frame cost on real hardware before the port is completed.
Use `pipeline.withPerformanceCallback((start, end) => …)` to get GPU nanoseconds.
Initialize the device with the `timestamp-query` feature.

Run the runtime test again with TypeGPU 0.12.3.

`tsover` restores operator syntax in `'use gpu'` functions.
For example, GPU calculations can use `a + b` instead of `std.add(a, b)`.
The field contains many of these calculations, so this tool can reduce its code.

`eslint-plugin-typegpu` finds common `'use gpu'` errors.
These errors include integer division, `Math.*`, and unsupported syntax.

The official TypeGPU agent skill is also available through `npx skills add software-mansion-labs/skills -s
typegpu`.
