import {
  useInfiniteCanvasSelector,
  worldPointToScreenPoint,
  type InfiniteCanvasCamera,
  type InfiniteCanvasViewportSize,
  type InfiniteCanvasWindow,
} from "@hyphened/infinite-canvas";
import { useEffect, useRef } from "react";
import { tv } from "ui/tv";

import type { WindowKind } from "./window-registry";

/**
 * The ground.
 *
 * A canvas whose background is wallpaper is a canvas you do not believe in, so this one is a
 * field: it thickens under the pointer, and windows push it out of their way and let it back as
 * they settle. Constants come from `reference/infinite-canvas-dynamic-grid/GRID_MOTION_STUDY.md`,
 * recovered from the implementation this is modelled on.
 *
 * **What is simulated is the rectangles, not the lattice.** An earlier note in `ROADMAP.md` had
 * this backwards. The field itself is a formula evaluated per pixel in *warped* space — each pixel
 * displaces its own sample position by the force of the nearby window rects and then asks how far
 * it is from a lattice line — so there are no persistent lattice particles to carry momentum. The
 * momentum lives in the rects: their positions and sizes chase the real ones with gain `0.08` and
 * damping `0.75`, and their influence eases in at `0.15`. That is why a window that stops moving
 * leaves the field still settling behind it.
 *
 * WebGL rather than Canvas 2D because the work is per pixel: a 2D port would have to be the older
 * particle version, which is what the study says this replaced. Raw WebGL2 rather than `three` —
 * a fullscreen triangle and one program need no scene graph, and the framework's 3D peer is for
 * the window layer, not the ground.
 */

const field = tv({
  slots: {
    canvas: "absolute inset-0 h-full w-full",
  },
});

/**
 * The field's tuning, and the whole of it.
 *
 * The recovered shader carried five near-duplicate hover radii and three influence radii, each a
 * fixed ratio of one real number. They are collapsed here: one hover radius and one force radius
 * move their whole family together, which is the only way tuning the feel is possible without
 * unpicking which of five smoothsteps was the one that mattered.
 *
 * Everything a consumer would actually reach for while tuning is here. What is not: the ratios
 * themselves, and the eight-rect uniform array — the first is the field's identity rather than a
 * setting, and the second is a GPU cost decision no product should be making.
 */
type FieldConfig = Readonly<{
  /** How strongly the pointer's dots and lines lift, and how far that reaches in screen pixels. */
  hover: Readonly<{ anchorEase: number; ease: number; radius: number; snapReset: number }>;
  /** Ink weights. Raise `line` for a drafting surface, `dot` for a field of points. */
  intensity: Readonly<{ dot: number; grain: number; line: number; vignette: number }>;
  /** Screen pixels between lattice lines. Faint traces sit on the half-step. */
  latticeStep: number;
  /**
   * What a window does to the field it sits on.
   *
   * `mass` is the pull of a default-sized note; bigger windows pull harder in proportion to the
   * square root of their footprint. `reach` is the distance at which that pull has fallen to half,
   * and because the falloff is inverse-square the tail runs well past it. `ceiling` caps the total
   * displacement so overlapping wells cannot tear the lattice open.
   */
  gravity: Readonly<{ ceiling: number; mass: number; reach: number }>;
  /** How the rects chase the real windows. Low gain and high damping is a heavy, settling field. */
  settle: Readonly<{ damping: number; gain: number; strengthEase: number }>;
}>;

const DEFAULT_FIELD_CONFIG: FieldConfig = {
  hover: { anchorEase: 0.2, ease: 0.18, radius: 132, snapReset: 96 },
  // Loud enough that the wells read, quiet enough to stay ground. At the reference's 1 the
  // gravity was geometrically present and completely invisible; past about 4 it becomes a
  // wireframe, which is the look the bar explicitly bans.
  intensity: { dot: 1.9, grain: 1, line: 2.4, vignette: 1 },
  latticeStep: 40,
  // Reach and ceiling are raised well past the reference's shove: an inverse-square well is
  // supposed to be felt across the canvas, and a timid one just looks like a smudge.
  gravity: { ceiling: 26, mass: 22, reach: 260 },
  settle: { damping: 0.75, gain: 0.08, strengthEase: 0.15 },
};

/** Only eight rects fit the uniform array; a ninth window would contribute almost nothing anyway. */
const MAX_RECTS = 8;
const TARGET_FRAME_RATE = 60;

/** Easing constants are per-frame at 60Hz, so every one is re-based on the frame actually taken. */
const frameRatio = (deltaMs: number) =>
  Math.min(Math.max(deltaMs / (1000 / TARGET_FRAME_RATE), 0), 2.5);
const frameAlpha = (alpha: number, ratio: number) => 1 - (1 - alpha) ** ratio;
const frameDamping = (damping: number, ratio: number) => damping ** ratio;

/**
 * One oversized triangle covering the viewport — no buffers, no scene graph.
 *
 * Clip space puts `y = -1` at the bottom while every coordinate this field works in (the pointer,
 * the window rects, the camera) measures down from the top, so the triangle is emitted flipped.
 * Without that the highlight appears mirrored about the horizontal centre and travels upwards as
 * the cursor moves down.
 */
const VERTEX_SHADER = `#version 300 es
out vec2 vUv;

void main() {
  vec2 corner = vec2(float((gl_VertexID << 1) & 2), float(gl_VertexID & 2));
  vUv = corner;
  gl_Position = vec4(corner.x * 2.0 - 1.0, 1.0 - corner.y * 2.0, 0.0, 1.0);
}
`;

/**
 * Composed rather than one glow, which is most of why the highlight reads as intentional: thin
 * centre lines, faint half-step traces, and a lifted intersection dot are each drawn separately
 * and mixed, with a soft radial spotlight underneath them all.
 *
 * The structure is anchored to `uHoverAnchor` — the pointer eased *between lattice intersections* —
 * while the spotlight follows the cursor itself. The study names that split as the reason it feels
 * deliberate, and the recovered shader had drifted to snapping per pixel from the pointer instead.
 */
const FRAGMENT_SHADER = `#version 300 es
precision highp float;

#define MAX_RECTS ${String(MAX_RECTS)}

uniform vec2 uResolution;
uniform float uTime;
uniform vec2 uPointer;
uniform vec2 uHoverAnchor;
uniform float uPointerActive;
uniform vec2 uLatticeOffset;
uniform vec4 uRects[MAX_RECTS];
uniform float uRectStrengths[MAX_RECTS];
uniform vec3 uGround;
uniform vec3 uDotRest;
uniform vec3 uDotLift;
uniform float uLatticeStep;
uniform float uHoverRadius;
uniform vec3 uGravity;
uniform vec4 uIntensity;

in vec2 vUv;
out vec4 fragColor;

float sat(float value) {
  return clamp(value, 0.0, 1.0);
}

float random(vec2 st) {
  return fract(sin(dot(st.xy, vec2(12.9898, 78.233))) * 43758.5453123);
}

float rectDistance(vec2 point, vec4 rect) {
  vec2 closest = clamp(point, rect.xy, rect.xy + rect.zw);
  return length(point - closest);
}

/**
 * A window's pull on the lattice.
 *
 * Toward the window, not away from it: a window is a mass sitting on the surface, and the field
 * falls into it. The reference this is modelled on pushed the lattice aside instead, which reads
 * as a box shoving wallpaper rather than as something with weight.
 *
 * Mass grows with the window's footprint, referenced to a default note so a note pulls about one.
 * The falloff is a softened inverse square — a real well, finite at the centre, reaching much
 * further than a linear ramp so distant windows still bend the field a little.
 */
vec2 rectPull(vec2 point, vec4 rect, float strength) {
  if (strength <= 0.001 || rect.z <= 0.0 || rect.w <= 0.0) {
    return vec2(0.0);
  }

  vec2 closest = clamp(point, rect.xy, rect.xy + rect.zw);
  vec2 delta = closest - point;
  float distanceToRect = length(delta);

  if (distanceToRect <= 0.0) {
    return vec2(0.0);
  }

  float mass = sqrt(rect.z * rect.w) / 265.0;
  float pull = uGravity.y * mass / (1.0 + pow(distanceToRect / uGravity.x, 2.0));

  return normalize(delta) * pull * strength;
}

float nearestRectDistance(vec2 point) {
  float nearest = 100000.0;

  for (int index = 0; index < MAX_RECTS; index++) {
    if (uRectStrengths[index] > 0.001 && uRects[index].z > 0.0) {
      nearest = min(nearest, rectDistance(point, uRects[index]));
    }
  }

  return nearest;
}

/** Every window's pull at once, capped so overlapping wells cannot tear the lattice apart. */
vec2 fieldPull(vec2 point) {
  vec2 pull = vec2(0.0);

  for (int index = 0; index < MAX_RECTS; index++) {
    pull += rectPull(point, uRects[index], uRectStrengths[index]);
  }

  float magnitude = length(pull);
  return magnitude > uGravity.z ? normalize(pull) * uGravity.z : pull;
}

float lineMask(float distanceToLine, float width) {
  return 1.0 - smoothstep(width, width + 1.1, distanceToLine);
}

void main() {
  vec2 frag = vUv * uResolution;
  // Sampling from further out than this pixel sits is what drags the lattice inward: the line
  // that belongs further away is drawn here, so the whole field leans into the mass.
  vec2 pull = fieldPull(frag);
  vec2 warped = frag + uLatticeOffset - pull;
  // How deep in a well this pixel is, 0 at rest and 1 at the cap. Compression is the visible
  // signature of gravity, so this drives brightness rather than mere proximity.
  float depth = sat(length(pull) / uGravity.z);
  // "half" is a reserved word in GLSL ES, so this cannot take the obvious name.
  float halfStep = uLatticeStep * 0.5;

  vec2 nearestLattice = round(warped / uLatticeStep) * uLatticeStep;
  float dotDistance = length(warped - nearestLattice);
  float lineDistance = min(abs(warped.x - nearestLattice.x), abs(warped.y - nearestLattice.y));
  vec2 nearestHalf = round(warped / halfStep) * halfStep;
  float halfLineDistance = min(abs(warped.x - nearestHalf.x), abs(warped.y - nearestHalf.y));

  // Measured from the lattice point rather than the pixel, so a whole cell brightens together as
  // a window approaches instead of the brightening sweeping across it.
  float rectNear = nearestRectDistance(nearestLattice - uLatticeOffset);
  // Two readings of the same well: the steep one lights the rim a window sits in, the broad one
  // carries the long gravitational tail out across the canvas.
  float wellCore = max(1.0 - pow(min(rectNear / (uGravity.x * 0.75), 1.0), 2.0), depth);
  float wellTail = max(1.0 - min(rectNear / (uGravity.x * 2.6), 1.0), depth * 0.6);

  // The lit region is measured in screen space, against the anchor brought back out of lattice
  // space. Measuring it in warped space instead let a nearby window drag the highlight off the
  // cursor — the warp is for the lattice, not for where the light is.
  vec2 anchorScreen = uHoverAnchor - uLatticeOffset;
  float anchorDistance = length((frag - anchorScreen) / vec2(1.08, 0.9));
  float pointerDistance = length(frag - uPointer);
  float beam =
    pow(1.0 - smoothstep(uHoverRadius * 0.136, uHoverRadius, anchorDistance), 1.62) * uPointerActive;
  float core =
    pow(1.0 - smoothstep(uHoverRadius * 0.076, uHoverRadius * 0.409, pointerDistance), 1.4) *
    uPointerActive;
  float anchorCatch = (1.0 - smoothstep(0.8, 3.0, dotDistance)) * beam;
  float hoverLine = sat(beam * 0.78 + core * 0.12 + anchorCatch * 0.1);
  float hoverDot =
    (1.0 - smoothstep(0.58, 1.5, dotDistance)) *
    pow(1.0 - smoothstep(uHoverRadius * 0.152, uHoverRadius * 0.955, anchorDistance), 1.45) *
    uPointerActive;

  // The spotlight is the soft radial lift of the whole region, separate from the line and dot
  // structure. Without it the highlight is a few brighter pixels rather than a lit patch of
  // ground, which is what the field is for.
  float radial =
    pow(
      1.0 -
        smoothstep(
          uHoverRadius * 0.152,
          uHoverRadius * 1.121,
          length((frag - uPointer) / vec2(1.1, 0.9))
        ),
      1.74
    );
  float glow = 1.0 - smoothstep(uHoverRadius * 0.091, uHoverRadius * 0.439, pointerDistance);
  float spotlightLine = radial * (0.7 + glow * 0.3) * uPointerActive;
  float spotlightDot = pow(radial, 1.26) * (0.82 + glow * 0.2) * uPointerActive;
  float spotlightGlint = (pow(glow, 1.8) * 0.62 + pow(radial, 2.4) * 0.22) * uPointerActive;

  float hoverLineSignal = max(hoverLine * 0.88, spotlightLine * 0.18);
  float hoverDotSignal = max(hoverDot * 0.86, spotlightDot);
  float dynamic = max(hoverLine * 0.38, hoverDot * 0.28);

  // Cell noise, so the field is not a printed grid. Two scales: broad patches and a finer grain.
  float largeCell = random(floor((frag + vec2(31.0, 79.0)) / 180.0));
  float mediumCell = random(floor((frag + vec2(97.0, 17.0)) / 80.0));
  float cellTexture = 0.72 + largeCell * 0.18 + mediumCell * 0.1;
  float vignette = mix(1.0, smoothstep(1.05, 0.3, length(vUv - 0.5)), uIntensity.w);
  float visibility = clamp(cellTexture * (0.55 + vignette * 0.55) + dynamic * 0.46, 0.0, 1.0);

  float sparseSeed = random(nearestLattice * 0.037 + vec2(3.7, 8.1));
  float sparseDot = (0.58 + pow(sparseSeed, 0.72) * 0.42) * (0.86 + mediumCell * 0.22);
  float shimmer = 0.9 + sin(uTime * (0.74 + sparseSeed * 1.2) + sparseSeed * 6.2831853) * 0.1;
  // Matter falling into a well gets denser, not fatter: dots tighten and brighten as they are
  // drawn in, and swell across the rim of the well where the field is stretched instead.
  float rim = sin(min(rectNear / (uGravity.x * 1.6), 1.0) * 3.14159265);
  float dotRadius = max(0.34, mix(0.52, 0.42 + rim * 0.62, sat(wellTail + dynamic)) - depth * 0.22);
  float dotMask = 1.0 - smoothstep(dotRadius, dotRadius + 1.0, dotDistance);

  float litLines = clamp(visibility + hoverLineSignal * 0.33, 0.0, 1.0);
  float litDots = clamp(visibility + hoverDotSignal * 0.62, 0.0, 1.0);
  float halfLineCore = lineMask(halfLineDistance, 0.08);
  float majorLineCore = lineMask(lineDistance, 0.32 + dynamic * 0.5);
  float baseLineAlpha = (0.0045 + wellTail * 0.028) * (0.82 + largeCell * 0.24);

  float lineAlpha =
    majorLineCore *
    max(baseLineAlpha + hoverLineSignal * 0.041 + spotlightGlint * 0.011, dynamic * 0.18) *
    litLines * uIntensity.x;
  float halfLineAlpha =
    halfLineCore * (0.005 + hoverLineSignal * 0.0034) * (1.0 - dotMask * 0.78) * litLines *
    uIntensity.x;
  float dotAlpha =
    dotMask * sparseDot *
    (0.5 + wellCore * 0.5 + dynamic * 0.24 + hoverDotSignal * 0.64 + spotlightGlint * 0.2) *
    shimmer * litDots * uIntensity.y;

  float fine = random((frag / max(uResolution, vec2(1.0))) * 1000.0 + uTime * 0.1) - 0.5;
  float coarse = random(floor((frag + uTime * 5.0) / 3.0)) - 0.5;
  float grain = (fine * 0.019 + coarse * 0.006) * uIntensity.z;

  vec3 ground = uGround * (0.86 + vignette * 0.18);
  vec3 lineColor = mix(uDotRest, uDotLift, sat(dynamic * 1.35 + hoverLineSignal * 1.44));
  vec3 dotColor = mix(
    mix(uDotRest, vec3(1.0), wellCore * 0.42),
    uDotLift,
    sat(dynamic * 0.42 + hoverDotSignal * 0.7)
  );

  vec3 color = ground;
  color = mix(color, uDotRest, sat(halfLineAlpha));
  color = mix(color, lineColor, sat(lineAlpha));
  color = mix(color, dotColor, sat(dotAlpha));
  // Added rather than mixed: the lit region has to gain light, not merely swap the colour of the
  // few pixels a line already covered.
  color += uDotLift * hoverLineSignal * max(majorLineCore, halfLineCore) * 0.2 * uIntensity.x;
  color += uDotLift * hoverDot * 0.2 * uIntensity.y;
  color += vec3(grain);

  fragColor = vec4(color, 1.0);
}
`;

type RectState = {
  height: number;
  strength: number;
  targetHeight: number;
  targetStrength: number;
  targetWidth: number;
  targetX: number;
  targetY: number;
  velocityHeight: number;
  velocityWidth: number;
  velocityX: number;
  velocityY: number;
  width: number;
  x: number;
  y: number;
};

type FieldInput = Readonly<{
  camera: InfiniteCanvasCamera;
  viewport: InfiniteCanvasViewportSize;
  windows: readonly InfiniteCanvasWindow<WindowKind>[];
}>;

/**
 * A token's colour in the 0–1 channels a shader wants.
 *
 * Painted into a 1×1 canvas and read back rather than parsed, because `getPropertyValue` returns
 * the token's *text* and the palette is written in `oklch` — scraping three numbers out of
 * `oklch(0.155 0.008 265)` and calling them RGB turned the ground bright blue. Painting makes the
 * browser resolve whatever syntax a token happens to use, so the stylesheet stays the only place
 * colour is decided.
 */
const readColor = (element: Element, name: string): readonly [number, number, number] => {
  const probe = document.createElement("canvas").getContext("2d");

  if (probe === null) {
    return [0, 0, 0];
  }

  probe.fillStyle = globalThis.getComputedStyle(element).getPropertyValue(name).trim();
  probe.fillRect(0, 0, 1, 1);

  const [red = 0, green = 0, blue = 0] = probe.getImageData(0, 0, 1, 1).data;

  return [red / 255, green / 255, blue / 255];
};

const compile = (gl: WebGL2RenderingContext, type: number, source: string) => {
  const shader = gl.createShader(type);

  if (shader === null) {
    return null;
  }

  gl.shaderSource(shader, source);
  gl.compileShader(shader);

  if (gl.getShaderParameter(shader, gl.COMPILE_STATUS) !== true) {
    console.error("field shader failed to compile", gl.getShaderInfoLog(shader));
    gl.deleteShader(shader);

    return null;
  }

  return shader;
};

const createProgram = (gl: WebGL2RenderingContext) => {
  const vertex = compile(gl, gl.VERTEX_SHADER, VERTEX_SHADER);
  const fragment = compile(gl, gl.FRAGMENT_SHADER, FRAGMENT_SHADER);
  const program = gl.createProgram();

  if (vertex === null || fragment === null || program === null) {
    return null;
  }

  gl.attachShader(program, vertex);
  gl.attachShader(program, fragment);
  gl.linkProgram(program);

  if (gl.getProgramParameter(program, gl.LINK_STATUS) !== true) {
    console.error("field program failed to link", gl.getProgramInfoLog(program));

    return null;
  }

  return program;
};

/**
 * The windows nearest the viewport centre, in screen pixels.
 *
 * Only eight rects fit the uniform array, and a window far off screen contributes nothing anyway —
 * the push falls to zero at its radius. Minimized windows are excluded because they have no rect
 * on screen to push with.
 */
const getScreenRects = ({ camera, viewport, windows }: FieldInput) => {
  const centre = { x: viewport.width / 2, y: viewport.height / 2 };
  const distanceFromCentre = (
    rect: Readonly<{ height: number; width: number; x: number; y: number }>,
  ) => (rect.x + rect.width / 2 - centre.x) ** 2 + (rect.y + rect.height / 2 - centre.y) ** 2;

  return windows
    .filter((window) => window.mode !== "minimized")
    .map((window) => {
      const origin = worldPointToScreenPoint(camera, viewport, {
        x: window.rect.x,
        y: window.rect.y,
      });

      return {
        height: window.rect.height * camera.zoom,
        id: window.id,
        width: window.rect.width * camera.zoom,
        x: origin.x,
        y: origin.y,
      };
    })
    .sort((left, right) => distanceFromCentre(left) - distanceFromCentre(right))
    .slice(0, MAX_RECTS);
};

export function Field({ config = DEFAULT_FIELD_CONFIG }: Readonly<{ config?: FieldConfig }>) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const camera = useInfiniteCanvasSelector((state) => state.camera);
  const viewport = useInfiniteCanvasSelector((state) => state.viewport);
  const windows = useInfiniteCanvasSelector<
    WindowKind,
    readonly InfiniteCanvasWindow<WindowKind>[]
  >((state) => state.windows);
  // The loop reads the latest canvas through a ref rather than restarting on every camera frame:
  // rebuilding the GL program each pan would drop the field's own settling on the floor.
  const inputRef = useRef<FieldInput>({ camera, viewport, windows });
  const configRef = useRef<FieldConfig>(config);

  inputRef.current = { camera, viewport, windows };
  configRef.current = config;
  const styles = field();

  useEffect(() => {
    const canvas = canvasRef.current;
    const gl = canvas?.getContext("webgl2", { alpha: false, antialias: false }) ?? null;

    if (canvas === null || gl === null) {
      return;
    }

    const program = createProgram(gl);

    if (program === null) {
      return;
    }

    const uniform = (name: string) => gl.getUniformLocation(program, name);
    const locations = {
      dotLift: uniform("uDotLift"),
      dotRest: uniform("uDotRest"),
      ground: uniform("uGround"),
      hoverAnchor: uniform("uHoverAnchor"),
      hoverRadius: uniform("uHoverRadius"),
      intensity: uniform("uIntensity"),
      latticeOffset: uniform("uLatticeOffset"),
      latticeStep: uniform("uLatticeStep"),
      pointer: uniform("uPointer"),
      pointerActive: uniform("uPointerActive"),
      gravity: uniform("uGravity"),
      rects: uniform("uRects"),
      rectStrengths: uniform("uRectStrengths"),
      resolution: uniform("uResolution"),
      time: uniform("uTime"),
    };

    gl.useProgram(program);
    gl.uniform3fv(locations.ground, readColor(canvas, "--ground"));
    gl.uniform3fv(locations.dotRest, readColor(canvas, "--dot-rest"));
    gl.uniform3fv(locations.dotLift, readColor(canvas, "--dot-lift"));

    const rects = new Map<string, RectState>();
    const rectUniform = new Float32Array(MAX_RECTS * 4);
    const strengthUniform = new Float32Array(MAX_RECTS);
    const pointer = { active: false, x: -9999, y: -9999 };
    const anchor = { x: -9999, y: -9999 };
    let hoverStrength = 0;
    let started = 0;
    let previous = 0;
    let frame = 0;

    const onPointerMove = (event: PointerEvent) => {
      const bounds = canvas.getBoundingClientRect();

      pointer.active = true;
      pointer.x = event.clientX - bounds.left;
      pointer.y = event.clientY - bounds.top;
    };
    const onPointerLeave = () => {
      pointer.active = false;
    };

    const resize = () => {
      const ratio = Math.min(globalThis.devicePixelRatio, 2);
      const width = Math.max(Math.round(canvas.clientWidth * ratio), 1);
      const height = Math.max(Math.round(canvas.clientHeight * ratio), 1);

      if (canvas.width !== width || canvas.height !== height) {
        canvas.width = width;
        canvas.height = height;
        gl.viewport(0, 0, width, height);
      }
    };

    const observer = new ResizeObserver(resize);

    observer.observe(canvas);
    globalThis.addEventListener("pointermove", onPointerMove);
    globalThis.addEventListener("pointerleave", onPointerLeave);

    const draw = (now: number) => {
      frame = globalThis.requestAnimationFrame(draw);

      const settings = configRef.current;

      started = started === 0 ? now : started;
      const ratio = frameRatio(previous === 0 ? 1000 / TARGET_FRAME_RATE : now - previous);

      previous = now;
      resize();

      // Retarget: every window on screen chases its real rect, and one that has gone fades its
      // influence out rather than snapping the field flat.
      const present = new Set<string>();

      for (const rect of getScreenRects(inputRef.current)) {
        const existing = rects.get(rect.id);

        present.add(rect.id);

        if (existing === undefined) {
          rects.set(rect.id, {
            height: rect.height,
            strength: 0,
            targetHeight: rect.height,
            targetStrength: 1,
            targetWidth: rect.width,
            targetX: rect.x,
            targetY: rect.y,
            velocityHeight: 0,
            velocityWidth: 0,
            velocityX: 0,
            velocityY: 0,
            width: rect.width,
            x: rect.x,
            y: rect.y,
          });
        } else {
          existing.targetHeight = rect.height;
          existing.targetStrength = 1;
          existing.targetWidth = rect.width;
          existing.targetX = rect.x;
          existing.targetY = rect.y;
        }
      }

      const gain = settings.settle.gain * ratio;
      const damping = frameDamping(settings.settle.damping, ratio);
      const strengthAlpha = frameAlpha(settings.settle.strengthEase, ratio);

      for (const [id, rect] of rects) {
        if (!present.has(id)) {
          rect.targetStrength = 0;
        }

        rect.velocityX = (rect.velocityX + (rect.targetX - rect.x) * gain) * damping;
        rect.velocityY = (rect.velocityY + (rect.targetY - rect.y) * gain) * damping;
        rect.velocityWidth =
          (rect.velocityWidth + (rect.targetWidth - rect.width) * gain) * damping;
        rect.velocityHeight =
          (rect.velocityHeight + (rect.targetHeight - rect.height) * gain) * damping;
        rect.x += rect.velocityX;
        rect.y += rect.velocityY;
        rect.width += rect.velocityWidth;
        rect.height += rect.velocityHeight;
        rect.strength += (rect.targetStrength - rect.strength) * strengthAlpha;

        if (rect.targetStrength === 0 && rect.strength < 0.01) {
          rects.delete(id);
        }
      }

      rectUniform.fill(0);
      strengthUniform.fill(0);

      let slot = 0;

      for (const rect of rects.values()) {
        if (slot >= MAX_RECTS) {
          break;
        }

        rectUniform.set([rect.x, rect.y, rect.width, rect.height], slot * 4);
        strengthUniform[slot] = rect.strength;
        slot += 1;
      }

      // The lattice slides with the camera so the ground belongs to the world, but its spacing
      // stays in screen pixels: a texture of the surface, not a ruler laid over it.
      const offset = {
        x: inputRef.current.camera.center.x * inputRef.current.camera.zoom,
        y: inputRef.current.camera.center.y * inputRef.current.camera.zoom,
      };
      const snap = (value: number) =>
        Math.round(value / settings.latticeStep) * settings.latticeStep;

      hoverStrength +=
        ((pointer.active ? 1 : 0) - hoverStrength) * frameAlpha(settings.hover.ease, ratio);

      if (pointer.active) {
        const targetX = snap(pointer.x + offset.x);
        const targetY = snap(pointer.y + offset.y);
        const anchorAlpha = frameAlpha(settings.hover.anchorEase, ratio);
        // Past the reset distance the anchor jumps rather than gliding, so flicking across the
        // canvas does not drag a lit streak behind the cursor.
        const jumped =
          anchor.x < -1000 ||
          Math.hypot(targetX - anchor.x, targetY - anchor.y) > settings.hover.snapReset;

        anchor.x = jumped ? targetX : anchor.x + (targetX - anchor.x) * anchorAlpha;
        anchor.y = jumped ? targetY : anchor.y + (targetY - anchor.y) * anchorAlpha;
      }

      gl.useProgram(program);
      gl.uniform2f(locations.resolution, canvas.clientWidth, canvas.clientHeight);
      gl.uniform1f(locations.time, (now - started) / 1000);
      gl.uniform2f(locations.pointer, pointer.x, pointer.y);
      gl.uniform2f(locations.hoverAnchor, anchor.x, anchor.y);
      gl.uniform1f(locations.pointerActive, hoverStrength);
      gl.uniform2f(locations.latticeOffset, offset.x, offset.y);
      gl.uniform1f(locations.latticeStep, settings.latticeStep);
      gl.uniform1f(locations.hoverRadius, settings.hover.radius);
      gl.uniform3f(
        locations.gravity,
        settings.gravity.reach,
        settings.gravity.mass,
        settings.gravity.ceiling,
      );
      gl.uniform4f(
        locations.intensity,
        settings.intensity.line,
        settings.intensity.dot,
        settings.intensity.grain,
        settings.intensity.vignette,
      );
      gl.uniform4fv(locations.rects, rectUniform);
      gl.uniform1fv(locations.rectStrengths, strengthUniform);
      gl.drawArrays(gl.TRIANGLES, 0, 3);
    };

    frame = globalThis.requestAnimationFrame(draw);

    return () => {
      globalThis.cancelAnimationFrame(frame);
      observer.disconnect();
      globalThis.removeEventListener("pointermove", onPointerMove);
      globalThis.removeEventListener("pointerleave", onPointerLeave);
      gl.deleteProgram(program);
    };
  }, []);

  return <canvas className={styles.canvas()} data-slot="field" ref={canvasRef} />;
}

export { DEFAULT_FIELD_CONFIG, type FieldConfig };
