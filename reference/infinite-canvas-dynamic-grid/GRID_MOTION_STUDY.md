# Dynamic Grid Motion Study

This experiment isolates the Robot Components nodegrid background behavior: a
40px lattice, low-contrast dot/line rendering, pointer-local blue hover
highlighting, and animated rectangular node influence fields.

## Source Anchors

- The only recovered GLSL pair is the grain overlay shader in
  `apps/web/reference/infinite-canvas/node-editor-inspiration/app-nodegrid-deobfuscated/canvas/canvas-background-grain.jsx`.
- The grid itself is JavaScript-driven 2D canvas logic in
  `apps/web/reference/infinite-canvas/node-editor-inspiration/app-nodegrid-deobfuscated/canvas/canvas-field-and-connections.jsx`.
- Panel rectangles are passed into the grid renderer as live rect data. New
  panels do not inject a dedicated pulse; their visible warp comes from the
  rectangle entering the grid force field.

## Motion Constants Mapped Into The Route

- Lattice seed spacing: `40px`.
- Dynamic sampling rhythm: `20px` intermediate sampling.
- Rectangle force radius: `400px`.
- Rectangle force magnitude: `(1 - min(distance / 400, 1))^2 * 25`.
- Grid/field integration gain: `0.08`.
- Grid/field damping: `0.75`.
- Node influence strength easing: `strength += (target - strength) * 0.15`.
- Pointer hover radius: `120px`.
- Pointer hover falloff: `(1 - distance / 120)^2 * 0.6`.
- Pulse lifetime: `2000ms`.
- Pulse radius: `(ageMs / 1000) * ((0.5 + intensity * 0.5) * 400)`.
- Pulse half-width: `(0.5 + intensity * 0.5) * 80`.
- Grain hash: `fract(sin(dot(st, vec2(12.9898, 78.233))) * 43758.5453123)`.

## Implementation Notes

The original grid stores every lattice point as mutable canvas state. This R3F
route translates the visual field into a fullscreen shader, then preserves the
non-instantaneous node warp by smoothing node rectangles on the CPU before they
reach the shader uniforms. The result is intentionally screen-space: lattice
spacing and force radii remain in CSS pixels so hover and node deformation match
the sampled page behavior instead of drifting with camera scale.

The live route currently uses lower force and lower line energy than the source
canvas constants because the shader evaluates continuously per pixel instead of
moving persistent lattice particles. Current tuned values are a `300px` node
force radius, `6.0` maximum force magnitude, smoothed rectangle targets with
`0.08` gain and `0.75` damping, and strength easing at `0.15` per frame.

Pointer hover is represented as a separate smoothed grid anchor uniform
(`uHoverGrid`) so the blue highlight eases between 40px intersections instead
of jumping with raw pointer coordinates. The highlight is intentionally local:
thin center lines, faint adjacent-cell traces, and a small lifted intersection
dot are composed separately from the global grid brightness.

Node movement now publishes live position changes into React state during drag
and momentum, so SVG connections, shader deformation rectangles, and DOM panels
move together. Earlier iterations only updated connection paths on commit, which
made the node feel disconnected from the grid while dragging.
