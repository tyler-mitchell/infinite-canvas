# Spikes

A spike is a question answered by running something, not by reading about it. Each entry records
what was asked, what was actually executed, what came back, and the call that followed — including
the spikes that ended in "no". A spike with no recorded run is an opinion.

`BACKLOG.md` holds the spikes not yet run.

---

## TypeGPU for the field — **run, and recommended**

**The question.** The living field is a fragment shader written as a GLSL string. Should it be
written in TypeScript with [TypeGPU](https://docs.swmansion.com/TypeGPU/) instead?

**Why it came up.** Building the field cost two round trips to defects that only a browser could
report, and both were consequences of the shader being an untyped string:

- `float half = ...` — `half` is a reserved word in GLSL ES. The whole program silently failed to
  compile and the canvas rendered nothing, with the reason visible only in the console.
- A backtick inside a comment inside the shader's template literal terminated the string, and
  TypeScript reported the failure eighty lines away in a place with nothing wrong with it.

Neither is possible when the shader is TypeScript. There are no GLSL reserved words to collide
with, and there is no string to terminate.

**What was run.** The field's actual gravity math — the per-rect pull, the summed and capped
field, and the warped-lattice fragment — rewritten in TGSL and validated through the TypeGPU
runtime inspector MCP against a real WebGPU device.

The generated WGSL was correct and the pipeline was created with **zero compilation messages**:

```wgsl
@group(0) @binding(0) var<uniform> masses: array<RectMass, 8>;
@group(0) @binding(1) var<uniform> uniforms: FieldUniforms;

fn rectPull(point: vec2f, rect: vec4f, strength: f32) -> vec2f { … }
fn fieldPull(point: vec2f) -> vec2f { … }
@fragment fn item(@builtin(position) _arg_position: vec4f) -> @location(0) vec4f { … }
```

**What it cost to get there.** One error, and it is the finding that matters most for the port:

> Ternary operator is only supported for comptime-known checks. For runtime checks, please use
> `std.select` or if/else statements.

The current shader uses runtime ternaries in several places. They are all mechanically
convertible, but it is real work rather than a copy.

**What TypeGPU buys, concretely.**

- The two defects above become impossible by construction.
- `FieldConfig` stops being maintained twice. Today the TypeScript object and the uniform writes
  are separate — `gl.uniform3f(locations.gravity, reach, mass, ceiling)` is three positional floats
  whose order nothing checks, and getting them wrong is silent. A schema is one declaration that
  both sides are derived from.
- Uniform locations stop being string lookups. `uniform("uGravity")` returning `null` for a typo,
  or for a uniform the compiler stripped as unused, currently fails quietly.
- Bind group layout is inferred rather than hand-written.

**What it costs.**

- **WebGPU only.** TypeGPU does not target WebGL, deliberately — "Leaving WebGL behind" is a
  heading in their own docs. The field currently runs anywhere WebGL2 does. This is the one real
  decision in the spike, and it is already decided: Chrome-first is a standing constraint for this
  project, not a new risk introduced here.
- A runtime dependency plus `unplugin-typegpu` in the Vite config, which is required for
  TypeScript-authored shaders to work at all.
- The ternary restriction, and presumably other TGSL limits not reached by a probe this size.

**The call: port the field to TypeGPU.** The shader is the only one in the codebase and is already
isolated behind `renderBackdrop` in a single file, so the blast radius is one module. The port
replaces the GLSL rather than sitting beside it — a WebGL fallback kept "just in case" would mean
two implementations of the same field drifting apart, which is the coexistence failure this repo
bans elsewhere.

**Not yet measured.** The inspector's headless device is swiftshader, so this spike proves the
shader _compiles and links_, not that it is fast. Frame cost has to be compared on real hardware
before the port is called done.
