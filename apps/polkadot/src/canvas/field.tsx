import {
  useInfiniteCanvasStore,
  useInfiniteCanvasSelector,
  worldPointToScreenPoint,
  type InfiniteCanvasCamera,
  type CanvasLayout,
  type InfiniteCanvasViewportSize,
  type InfiniteCanvasWindow,
} from "@hyphened/infinite-canvas";
import { useEffect, useRef } from "react";
import { useValue } from "@legendapp/state/react";
import tgpu from "typegpu";
import { fullScreenTriangle } from "typegpu/common";
import * as d from "typegpu/data";
import { tv } from "ui/tv";

import { fieldFragment, FieldUniforms, layout, MAX_RECTS, RectMass } from "./field-shader";
import type { WindowKind } from "./window-registry";

const field = tv({
  slots: {
    canvas: "absolute inset-0 h-full w-full",
  },
});

type FieldConfig = Readonly<{
  /** These values control the pull, range, and displacement limit. */
  gravity: Readonly<{ ceiling: number; mass: number; reach: number }>;
  /** These values control pointer lift and its screen-space radius. */
  hover: Readonly<{ anchorEase: number; ease: number; radius: number; snapReset: number }>;
  /** These values control line, dot, grain, and vignette strength. */
  intensity: Readonly<{ dot: number; grain: number; line: number; vignette: number }>;
  /** This is the gap between lattice lines in screen pixels. */
  latticeStep: number;
  /** This is the number of device pixels per CSS pixel. */
  renderScale: number;
  /** These values control rectangle motion and fade. */
  settle: Readonly<{ damping: number; gain: number; strengthEase: number }>;
}>;

const DEFAULT_FIELD_CONFIG: FieldConfig = {
  gravity: { ceiling: 13, mass: 14, reach: 210 },
  hover: { anchorEase: 0.2, ease: 0.18, radius: 132, snapReset: 96 },
  intensity: { dot: 1.9, grain: 1, line: 2.4, vignette: 1 },
  latticeStep: 40,
  renderScale: 1,
  settle: { damping: 0.75, gain: 0.08, strengthEase: 0.15 },
};

// These thresholds stop frames that cannot change a pixel.
const SETTLED_VELOCITY = 0.05;
const SETTLED_ANCHOR = 0.5;
const SETTLED_STRENGTH = 0.004;

const TARGET_FRAME_RATE = 60;

// These constants use a 60 Hz frame as their base.
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
  camera: InfiniteCanvasCamera;
  canvasLayout: CanvasLayout;
  viewport: InfiniteCanvasViewportSize;
  windows: readonly InfiniteCanvasWindow<WindowKind>[];
}>;

// The canvas converts CSS color syntax to RGB values for the shader.
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

const getScreenRects = ({ camera, canvasLayout, viewport, windows }: FieldInput) => {
  const centre = { x: viewport.width / 2, y: viewport.height / 2 };
  const distanceFromCentre = (
    rect: Readonly<{ height: number; width: number; x: number; y: number }>,
  ) => (rect.x + rect.width / 2 - centre.x) ** 2 + (rect.y + rect.height / 2 - centre.y) ** 2;

  return windows
    .filter((window) => canvasLayout.visibleWindowIds.has(window.id))
    .flatMap((window) => {
      const rect = canvasLayout.windowRects.get(window.id);

      if (rect === undefined) {
        return [];
      }

      const origin = worldPointToScreenPoint(camera, viewport, {
        x: rect.x,
        y: rect.y,
      });

      return [
        {
          height: rect.height * camera.zoom,
          id: window.id,
          width: rect.width * camera.zoom,
          x: origin.x,
          y: origin.y,
        },
      ];
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
  const canvasLayout = useValue(useInfiniteCanvasStore<WindowKind>().layout$);
  const inputRef = useRef<FieldInput>({
    camera,
    canvasLayout,
    viewport,
    windows,
  });
  const configRef = useRef<FieldConfig>(config);

  inputRef.current = { camera, canvasLayout, viewport, windows };
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
        // renderScale is the device-pixel count for one CSS pixel.
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
          // A long pointer move resets the anchor to prevent a light trail.
          const jumped =
            anchor.x < -1000 ||
            Math.hypot(targetX - anchor.x, targetY - anchor.y) > settings.hover.snapReset;

          anchor.x = jumped ? targetX : anchor.x + (targetX - anchor.x) * anchorAlpha;
          anchor.y = jumped ? targetY : anchor.y + (targetY - anchor.y) * anchorAlpha;
        }

        // Skip a frame when no input can change the image.
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
