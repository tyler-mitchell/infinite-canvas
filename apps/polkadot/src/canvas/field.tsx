import {
  getInfiniteCanvasGroupProjection,
  isInfiniteCanvasWindowInActiveWorkspace,
  useInfiniteCanvasSelector,
  worldPointToScreenPoint,
  type InfiniteCanvasCamera,
  type InfiniteCanvasViewportSize,
  type InfiniteCanvasWindow,
} from "@hyphened/infinite-canvas";
import { useEffect, useRef } from "react";
import tgpu from "typegpu";
import { fullScreenTriangle } from "typegpu/common";
import * as d from "typegpu/data";
import { tv } from "ui/tv";

import { fieldFragment, FieldUniforms, layout, MAX_RECTS, RectMass } from "./field-shader";
import type { WindowKind } from "./window-registry";

/**
 * The ground.
 *
 * A canvas whose background is wallpaper is a canvas you do not believe in, so this one is a
 * field the windows deform. The diegetic idea is gravity: a window is a mass resting on the
 * surface and the lattice falls into it, draping the way a rubber sheet does around a weight.
 *
 * **What is simulated is the rectangles, not the lattice.** The field itself is a formula
 * evaluated per pixel in warped space — see `field-shader.ts`, which owns all of it. The momentum
 * lives here instead: rect positions and sizes chase the real windows with gain `0.08` and damping
 * `0.75`, and influence eases in at `0.15`. That is why a window that stops moving leaves the
 * field still settling behind it.
 *
 * This file owns the CPU half — the settle, the pointer anchor, and the uniform writes. It holds
 * no shader source at all.
 */

const field = tv({
  slots: {
    canvas: "absolute inset-0 h-full w-full",
  },
});

/**
 * The field's tuning, and the whole of it.
 *
 * The reference this is modelled on carried five near-duplicate hover radii and three influence
 * radii, each a fixed ratio of one real number. They are collapsed here: one hover radius and one
 * gravitational reach move their whole family together, which is the only way tuning the feel is
 * possible without unpicking which of five smoothsteps was the one that mattered.
 *
 * Everything a consumer would actually reach for while tuning is here. What is not: the ratios
 * themselves, and the eight-rect uniform array — the first is the field's identity rather than a
 * setting, and the second is a GPU cost decision no product should be making.
 */
type FieldConfig = Readonly<{
  /**
   * What a window does to the field it sits on.
   *
   * `mass` is the pull of a default-sized note; bigger windows pull harder in proportion to the
   * square root of their footprint. `reach` is where that pull has fallen to half, and because the
   * falloff is inverse-square the tail runs well past it. `ceiling` caps the total displacement so
   * overlapping wells cannot tear the lattice open.
   */
  gravity: Readonly<{ ceiling: number; mass: number; reach: number }>;
  /** How strongly the pointer's dots and lines lift, and how far that reaches in screen pixels. */
  hover: Readonly<{ anchorEase: number; ease: number; radius: number; snapReset: number }>;
  /** Ink weights. Raise `line` for a drafting surface, `dot` for a field of points. */
  intensity: Readonly<{ dot: number; grain: number; line: number; vignette: number }>;
  /** Screen pixels between lattice lines. Faint traces sit on the half-step. */
  latticeStep: number;
  /**
   * Device pixels drawn per CSS pixel.
   *
   * The default is `1` rather than the display's ratio, which on a retina screen is a straight
   * four-fold cut in a cost that is entirely per-pixel. The field is a soft, low-frequency image
   * and its lines are meant to read as one CSS pixel wide, so drawing it at device resolution buys
   * crispness the design never asked for at four times the price.
   */
  renderScale: number;
  /** How the rects chase the real windows. Low gain and high damping is a heavy, settling field. */
  settle: Readonly<{ damping: number; gain: number; strengthEase: number }>;
}>;

const DEFAULT_FIELD_CONFIG: FieldConfig = {
  // A third of a cell of displacement at the rim, falling away by roughly two window-widths. Set
  // to 26 at first, which bent the whole canvas into a fisheye rather than denting it.
  gravity: { ceiling: 13, mass: 14, reach: 210 },
  hover: { anchorEase: 0.2, ease: 0.18, radius: 132, snapReset: 96 },
  // Loud enough that the wells read, quiet enough to stay ground. At the reference's 1 the
  // gravity was geometrically present and completely invisible; past about 4 it becomes a
  // wireframe, which is the look the bar explicitly bans.
  intensity: { dot: 1.9, grain: 1, line: 2.4, vignette: 1 },
  latticeStep: 40,
  renderScale: 1,
  settle: { damping: 0.75, gain: 0.08, strengthEase: 0.15 },
};

/**
 * The thresholds below which a frame could not change a pixel.
 *
 * An exponential ease never arrives, so a gate on exact equality repaints forever chasing the
 * last thousandth. These are set where the motion is smaller than half a pixel — invisible, and
 * therefore not worth the whole viewport.
 */
const SETTLED_VELOCITY = 0.05;
const SETTLED_ANCHOR = 0.5;
const SETTLED_STRENGTH = 0.004;

const TARGET_FRAME_RATE = 60;

/** Easing constants are per-frame at 60Hz, so every one is re-based on the frame actually taken. */
const frameRatio = (deltaMs: number) =>
  Math.min(Math.max(deltaMs / (1000 / TARGET_FRAME_RATE), 0), 2.5);
const frameAlpha = (alpha: number, ratio: number) => 1 - (1 - alpha) ** ratio;
const frameDamping = (damping: number, ratio: number) => damping ** ratio;

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
  /**
   * The windows this desktop admits.
   *
   * `state.windows` is every window on the canvas rather than every window on the desktop being
   * looked at, so without this the field was displaced by windows nobody could see — the same
   * omission `ROADMAP.md` records seven other surfaces making, and this was the eighth. It went
   * unnoticed because the field is unmounted: a bug nothing renders is still a bug, and it would
   * have arrived looking like the field was pulling toward nothing.
   */
  admittedWindowIds: ReadonlySet<string>;
  camera: InfiniteCanvasCamera;
  /** Members a group is not drawing — behind a tab, or a collapsed fold. */
  hiddenWindowIds: ReadonlySet<string>;
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
const readColor = (element: Element, name: string) => {
  const probe = document.createElement("canvas").getContext("2d");

  if (probe === null) {
    return d.vec3f();
  }

  probe.fillStyle = globalThis.getComputedStyle(element).getPropertyValue(name).trim();
  probe.fillRect(0, 0, 1, 1);

  const [red = 0, green = 0, blue = 0] = probe.getImageData(0, 0, 1, 1).data;

  return d.vec3f(red / 255, green / 255, blue / 255);
};

/**
 * The windows nearest the viewport centre, in screen pixels.
 *
 * Only eight rects fit the uniform array, and a window far off screen contributes nothing anyway —
 * the pull falls away with the square of the distance. Minimized windows are excluded because they
 * have no rect on screen to pull with.
 */
const getScreenRects = ({
  admittedWindowIds,
  camera,
  hiddenWindowIds,
  viewport,
  windows,
}: FieldInput) => {
  const centre = { x: viewport.width / 2, y: viewport.height / 2 };
  const distanceFromCentre = (
    rect: Readonly<{ height: number; width: number; x: number; y: number }>,
  ) => (rect.x + rect.width / 2 - centre.x) ** 2 + (rect.y + rect.height / 2 - centre.y) ** 2;

  return (
    windows
      /*
       * Three ways a window is on the canvas without being on screen, and this knew one.
       *
       * A hidden tab member has no rect to pull with — its `mode` is `"normal"` and its `rect` is
       * the shell's whole content rect, so both members of a tab pair displaced the field at the
       * same place and one visible shell pulled twice. A window on another desktop has no rect on
       * *this* screen at all, and that one was still missing: `state.windows` is every window on the
       * canvas rather than every window on the desktop you are looking at.
       *
       * Asking all three is the rule `ROADMAP.md` records seven surfaces breaking. Asking one of
       * them is what let this be the eighth.
       */
      .filter(
        (window) =>
          window.mode !== "minimized" &&
          !hiddenWindowIds.has(window.id) &&
          admittedWindowIds.has(window.id),
      )
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
      .slice(0, MAX_RECTS)
  );
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
  // rebuilding the device and pipeline each pan would drop the field's own settling on the floor.
  const hiddenWindowIds = useInfiniteCanvasSelector<WindowKind, ReadonlySet<string>>(
    (state) => getInfiniteCanvasGroupProjection(state.groups, state.groupMetrics).hiddenWindowIds,
  );
  /*
   * Selected as a set, the way `hiddenWindowIds` is, rather than filtered where it is used: the
   * membership answer is the framework's and asking it per window inside the render loop would put
   * a state lookup on every frame the field draws.
   */
  const admittedWindowIds = useInfiniteCanvasSelector<WindowKind, ReadonlySet<string>>((state) => {
    const admitted = state.windows.filter((window) =>
      isInfiniteCanvasWindowInActiveWorkspace(state, window.id),
    );

    return new Set(admitted.map((window) => window.id));
  });
  const inputRef = useRef<FieldInput>({
    admittedWindowIds,
    camera,
    hiddenWindowIds,
    viewport,
    windows,
  });
  const configRef = useRef<FieldConfig>(config);

  inputRef.current = { admittedWindowIds, camera, hiddenWindowIds, viewport, windows };
  configRef.current = config;
  const styles = field();

  useEffect(() => {
    const canvas = canvasRef.current;
    const context = canvas?.getContext("webgpu") ?? null;

    if (canvas === null || context === null) {
      return;
    }

    let frame = 0;
    let disposed = false;
    let dispose = () => {
      disposed = true;
    };

    // Requesting a device is async, and the canvas must paint before it resolves — the same rule
    // the database follows. Until it does, the ground is the token colour behind this element.
    void (async () => {
      const root = await tgpu.init();

      if (disposed) {
        root.destroy();

        return;
      }

      const format = navigator.gpu.getPreferredCanvasFormat();

      context.configure({ alphaMode: "opaque", device: root.device, format });

      const uniformsBuffer = root.createBuffer(FieldUniforms).$usage("uniform");
      const massesBuffer = root.createBuffer(d.arrayOf(RectMass, MAX_RECTS)).$usage("uniform");
      const bindGroup = root.createBindGroup(layout, {
        masses: massesBuffer,
        uniforms: uniformsBuffer,
      });
      // 0.12 removed the `withVertex(...).withFragment(...).createPipeline()` builder; the stages
      // and their targets are passed to `createRenderPipeline` directly.
      const pipeline = root.createRenderPipeline({
        fragment: fieldFragment,
        targets: { format },
        vertex: fullScreenTriangle,
      });

      const ground = readColor(canvas, "--ground");
      const dotRest = readColor(canvas, "--dot-rest");
      const dotLift = readColor(canvas, "--dot-lift");

      const rects = new Map<string, RectState>();
      const pointer = { active: false, x: -9999, y: -9999 };
      const anchor = { x: -9999, y: -9999 };
      let hoverStrength = 0;
      let started = 0;
      let previous = 0;
      let lastOffset = { x: Number.NaN, y: Number.NaN };
      let lastPointer = { x: Number.NaN, y: Number.NaN };

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
        // Device pixels per CSS pixel, outright — not a multiplier on the display's ratio, which
        // would quietly reinstate the 4× retina cost this exists to avoid.
        const ratio = configRef.current.renderScale;
        const width = Math.max(Math.round(canvas.clientWidth * ratio), 1);
        const height = Math.max(Math.round(canvas.clientHeight * ratio), 1);

        if (canvas.width === width && canvas.height === height) {
          return false;
        }

        canvas.width = width;
        canvas.height = height;

        return true;
      };

      const observer = new ResizeObserver(resize);

      observer.observe(canvas);
      globalThis.addEventListener("pointermove", onPointerMove);
      globalThis.addEventListener("pointerleave", onPointerLeave);

      dispose = () => {
        disposed = true;
        globalThis.cancelAnimationFrame(frame);
        observer.disconnect();
        globalThis.removeEventListener("pointermove", onPointerMove);
        globalThis.removeEventListener("pointerleave", onPointerLeave);
        root.destroy();
      };

      const draw = (now: number) => {
        frame = globalThis.requestAnimationFrame(draw);

        const settings = configRef.current;

        started = started === 0 ? now : started;
        const ratio = frameRatio(previous === 0 ? 1000 / TARGET_FRAME_RATE : now - previous);

        previous = now;
        const resized = resize();

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

        const stillMoving = [...rects.values()].some(
          (rect) =>
            Math.abs(rect.velocityX) > SETTLED_VELOCITY ||
            Math.abs(rect.velocityY) > SETTLED_VELOCITY ||
            Math.abs(rect.velocityWidth) > SETTLED_VELOCITY ||
            Math.abs(rect.velocityHeight) > SETTLED_VELOCITY ||
            Math.abs(rect.targetStrength - rect.strength) > SETTLED_STRENGTH,
        );
        const live = [...rects.values()].slice(0, MAX_RECTS);

        massesBuffer.write(
          Array.from({ length: MAX_RECTS }, (_, index) => {
            const rect = live[index];

            return rect === undefined
              ? { rect: d.vec4f(), strength: 0 }
              : {
                  rect: d.vec4f(rect.x, rect.y, rect.width, rect.height),
                  strength: rect.strength,
                };
          }),
        );

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

        /**
         * Nothing to redraw means nothing is drawn.
         *
         * The shimmer and grain are driven by time, so without this the field repaints the whole
         * viewport forever: reading a note with the pointer parked cost exactly as much as
         * dragging a window.
         *
         * The gate is *change*, not presence. Gating on `pointer.active` looked right and idled
         * never — it latches true on the first move and only `pointerleave` on the window clears
         * it, which does not fire while the cursor is simply sitting still on the canvas. A
         * stationary pointer over a settled highlight has nothing left to draw.
         *
         * Every source of change is enumerated rather than assumed: the rects settling, the
         * pointer moving, its brightness and its anchor still easing, the camera, and a resize.
         * Skipping leaves the last frame up, which is exactly what a still field looks like.
         */
        const pointerMoved = pointer.x !== lastPointer.x || pointer.y !== lastPointer.y;
        const hoverSettling = Math.abs(hoverStrength - (pointer.active ? 1 : 0)) > SETTLED_STRENGTH;
        const anchorSettling =
          pointer.active &&
          Math.hypot(snap(pointer.x + offset.x) - anchor.x, snap(pointer.y + offset.y) - anchor.y) >
            SETTLED_ANCHOR;
        const cameraMoved = offset.x !== lastOffset.x || offset.y !== lastOffset.y;

        if (
          !stillMoving &&
          !pointerMoved &&
          !hoverSettling &&
          !anchorSettling &&
          !cameraMoved &&
          !resized
        ) {
          return;
        }

        lastOffset = offset;
        lastPointer = { x: pointer.x, y: pointer.y };

        uniformsBuffer.write({
          dotLift,
          dotRest,
          gravity: d.vec3f(settings.gravity.reach, settings.gravity.mass, settings.gravity.ceiling),
          ground,
          hoverAnchor: d.vec2f(anchor.x, anchor.y),
          hoverRadius: settings.hover.radius,
          intensity: d.vec4f(
            settings.intensity.line,
            settings.intensity.dot,
            settings.intensity.grain,
            settings.intensity.vignette,
          ),
          latticeOffset: d.vec2f(offset.x, offset.y),
          latticeStep: settings.latticeStep,
          pointer: d.vec2f(pointer.x, pointer.y),
          pointerActive: hoverStrength,
          resolution: d.vec2f(canvas.clientWidth, canvas.clientHeight),
          time: (now - started) / 1000,
        });

        pipeline
          // The bind group carries its own layout; passing both is TypeGPU's outdated overload.
          .with(bindGroup)
          .withColorAttachment({
            clearValue: [0, 0, 0, 1],
            loadOp: "clear",
            storeOp: "store",
            view: context.getCurrentTexture().createView(),
          })
          .draw(3);
      };

      frame = globalThis.requestAnimationFrame(draw);
    })();

    return () => {
      dispose();
    };
  }, []);

  return <canvas className={styles.canvas()} data-slot="field" ref={canvasRef} />;
}

export { DEFAULT_FIELD_CONFIG, type FieldConfig };
