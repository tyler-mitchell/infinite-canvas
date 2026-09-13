import {
  ClientOnly,
  useConfigureContext,
  useRoot,
  useRootWithStatus,
  useUniform,
} from "@typegpu/react";
import { memo, useCallback, useEffect, useMemo, useRef, type ReactNode } from "react";

import { createSurfaceRenderer } from "../shaders/renderer.ts";
import { SurfaceFrame, type SurfaceShader } from "../shaders/surface.ts";
import { tv } from "../tv.ts";

const backdrop = tv({
  slots: {
    /* Supplies the shader's default background color. */
    root: "relative isolate flex min-h-0 min-w-0 flex-1 flex-col bg-pk-void [--pk-ring-seat:var(--pk-void)]",
    canvas: "pointer-events-none absolute inset-0 block size-full",
    content: "relative flex min-h-0 min-w-0 flex-1 flex-col",
  },
});

const DEFAULT_MAX_PIXEL_RATIO = 2;
const DEFAULT_MAX_PIXELS = 2400000;

/** Longest step one frame may advance, so a hidden tab does not jump on return. */
const MAX_STEP_SECONDS = 0.1;

type Theme = "dark" | "light";

export type BackdropProps = Omit<React.ComponentProps<"div">, "children"> & {
  /** What paints the surface. Build it once, outside render. */
  readonly shader: SurfaceShader;
  /** Drawn over the shader. */
  readonly children?: ReactNode;
  /** Any CSS colour the ink is laid on. Read from the backdrop's own background when absent. */
  readonly ground?: string;
  /** Any CSS colour the shader tints with. Read from the backdrop's own accent token when absent. */
  readonly accent?: string;
  /** Whether the ink brightens a dark ground or darkens a light one. */
  readonly theme?: Theme;
  /** Holds the frame it is on. */
  readonly paused?: boolean;
  /** Device pixels per CSS pixel, at most. */
  readonly maxPixelRatio?: number;
  /** Device pixels painted per frame, at most. */
  readonly maxPixels?: number;
  /** Paints one frame and holds it when the viewer prefers reduced motion. */
  readonly respectReducedMotion?: boolean;
};

type PainterProps = Readonly<{
  accent: string | undefined;
  className: string;
  ground: string | undefined;
  maxPixelRatio: number;
  maxPixels: number;
  paused: boolean;
  respectReducedMotion: boolean;
  shader: SurfaceShader;
  theme: Theme;
}>;

/** The canvas rejects a colour it cannot read, so the sentinel survives only when it did. */
const UNREAD = "transparent";

/** The token the kit tints with, read off the backdrop the way a browser reads it. */
const ACCENT_TOKEN = "--pk-accent";

/** Parses the way the platform does: an invalid colour is refused rather than read as black. */
const toSrgb = (color: string): readonly [number, number, number] | null => {
  const context = new OffscreenCanvas(1, 1).getContext("2d");
  if (context === null) return null;
  context.fillStyle = UNREAD;
  const sentinel = context.fillStyle;
  context.fillStyle = color;
  if (context.fillStyle === sentinel && color.trim().toLowerCase() !== UNREAD) return null;
  context.fillRect(0, 0, 1, 1);
  const [r = 0, g = 0, b = 0] = context.getImageData(0, 0, 1, 1).data;

  return [r / 255, g / 255, b / 255];
};

const positive = (value: number, fallback: number) =>
  Number.isFinite(value) && value > 0 ? value : fallback;

function Canvas({
  accent,
  className,
  ground,
  maxPixelRatio,
  maxPixels,
  paused,
  respectReducedMotion,
  shader,
  theme,
}: PainterProps) {
  const root = useRoot();
  const frameUniform = useUniform(SurfaceFrame);
  const { ctxRef, ref: attach } = useConfigureContext({ alphaMode: "opaque", autoResize: false });
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const clock = useRef(0);

  const ref = useCallback(
    (element: HTMLCanvasElement | null) => {
      canvasRef.current = element;
      const release = attach(element);

      return () => {
        canvasRef.current = null;
        release?.();
      };
    },
    [attach],
  );

  const renderer = useMemo(
    () =>
      createSurfaceRenderer({
        format: navigator.gpu.getPreferredCanvasFormat(),
        frameUniform,
        root,
        shader,
      }),
    [frameUniform, root, shader],
  );

  useEffect(() => () => renderer.destroy(), [renderer]);

  useEffect(() => {
    const own = canvasRef.current?.parentElement;
    const style = own ? getComputedStyle(own) : null;
    const readGround = ground ?? style?.backgroundColor ?? UNREAD;
    const readAccent = accent ?? style?.getPropertyValue(ACCENT_TOKEN).trim() ?? UNREAD;
    const laidOn = toSrgb(readGround);
    const tint = toSrgb(readAccent);
    if (laidOn === null) console.warn(`The backdrop ground "${readGround}" is not a colour.`);
    if (tint === null) console.warn(`The backdrop accent "${readAccent}" is not a colour.`);
    frameUniform.patch({
      accent: tint ?? [1, 1, 1],
      ...(theme === "light"
        ? { lightGround: laidOn ?? [1, 1, 1], lightMode: 1 }
        : { ground: laidOn ?? [0, 0, 0], lightMode: 0 }),
    });
  }, [accent, frameUniform, ground, theme]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (canvas === null) return;

    const maxDimension = root.device.limits.maxTextureDimension2D;
    const ratioCap = positive(maxPixelRatio, DEFAULT_MAX_PIXEL_RATIO);
    const pixelCap = positive(maxPixels, DEFAULT_MAX_PIXELS);
    const still = matchMedia("(prefers-reduced-motion: reduce)");
    const state = {
      disposed: false,
      frame: 0,
      height: canvas.clientHeight,
      previous: -1,
      visible: true,
      width: canvas.clientWidth,
    };

    const animating = () => !paused && !(respectReducedMotion && still.matches);
    const canDraw = () =>
      !state.disposed && !document.hidden && state.visible && state.width > 0 && state.height > 0;

    const fit = () => {
      const ratio = Math.min(
        window.devicePixelRatio || 1,
        ratioCap,
        Math.sqrt(pixelCap / (state.width * state.height)),
        maxDimension / state.width,
        maxDimension / state.height,
      );
      const width = Math.max(1, Math.floor(state.width * ratio));
      const height = Math.max(1, Math.floor(state.height * ratio));
      if (canvas.width === width && canvas.height === height) return;
      if (canvas.width !== width) canvas.width = width;
      if (canvas.height !== height) canvas.height = height;
      frameUniform.patch({ pixelRatio: width / state.width, resolution: [width, height] });
    };

    const draw = () => {
      const view = ctxRef.current;
      if (view === null) return;
      fit();
      frameUniform.patch({ time: clock.current });
      renderer.draw(view, { height: canvas.height, width: canvas.width });
    };

    const schedule = () => {
      if (state.frame === 0 && canDraw()) state.frame = requestAnimationFrame(tick);
    };

    function tick(now: number) {
      state.frame = 0;
      if (!canDraw()) {
        state.previous = -1;
        return;
      }
      const delta =
        state.previous < 0 ? 0 : Math.min((now - state.previous) / 1000, MAX_STEP_SECONDS);
      state.previous = now;
      if (animating()) clock.current += delta;
      draw();
      if (animating()) schedule();
      else state.previous = -1;
    }

    const refresh = () => {
      if (canDraw()) {
        schedule();
        return;
      }
      cancelAnimationFrame(state.frame);
      state.frame = 0;
      state.previous = -1;
    };

    const resize = new ResizeObserver(([entry]) => {
      const box = entry?.contentBoxSize[0];
      if (box === undefined) return;
      state.width = box.inlineSize;
      state.height = box.blockSize;
      refresh();
    });
    const intersection = new IntersectionObserver(([entry]) => {
      if (entry === undefined) return;
      state.visible = entry.isIntersecting;
      refresh();
    });

    resize.observe(canvas);
    intersection.observe(canvas);
    document.addEventListener("visibilitychange", refresh);
    still.addEventListener("change", refresh);
    // A zoom changes the device pixel ratio without resizing the element.
    window.addEventListener("resize", refresh);
    schedule();

    return () => {
      state.disposed = true;
      cancelAnimationFrame(state.frame);
      resize.disconnect();
      intersection.disconnect();
      document.removeEventListener("visibilitychange", refresh);
      still.removeEventListener("change", refresh);
      window.removeEventListener("resize", refresh);
    };
  }, [
    ctxRef,
    frameUniform,
    maxPixelRatio,
    maxPixels,
    paused,
    renderer,
    respectReducedMotion,
    root,
  ]);

  return <canvas aria-hidden className={className} ref={ref} />;
}

/** Without WebGPU nothing mounts and the ground the root paints stands. */
const Painter = memo(function Painter(props: PainterProps) {
  return useRootWithStatus().status === "fulfilled" ? <Canvas {...props} /> : null;
});

/** Renders a shader behind content using the root background color. */
function Backdrop({
  shader,
  ground,
  accent,
  theme = "dark",
  paused = false,
  maxPixelRatio = DEFAULT_MAX_PIXEL_RATIO,
  maxPixels = DEFAULT_MAX_PIXELS,
  respectReducedMotion = true,
  className,
  children,
  ...props
}: BackdropProps) {
  const styles = backdrop();

  return (
    <div data-slot="backdrop" className={styles.root({ className })} {...props}>
      <ClientOnly>
        <Painter
          accent={accent}
          className={styles.canvas()}
          ground={ground}
          maxPixelRatio={maxPixelRatio}
          maxPixels={maxPixels}
          paused={paused}
          respectReducedMotion={respectReducedMotion}
          shader={shader}
          theme={theme}
        />
      </ClientOnly>
      <div className={styles.content()}>{children}</div>
    </div>
  );
}

export { Backdrop, backdrop as backdropVariants };
