import {
  useInfiniteCanvasStore,
  worldPointToScreenPoint,
  type InfiniteCanvasRect,
} from "@hyphened/infinite-canvas";
import { useEffect, useRef } from "react";
import { tv } from "ui/tv";

/**
 * Polkadot's ground.
 *
 * The lattice is anchored in **world** space so panning moves it and the canvas reads as a place
 * rather than a texture behind a moving picture — but every dot is drawn at a constant *screen*
 * size, so zooming out does not grind the field into noise. That split is the whole trick: the
 * position is world, the presence is screen.
 *
 * Two fields act on it, both eased rather than applied raw:
 *
 * - **The pointer** lifts and warms nearby dots, falling off over `POINTER_RADIUS`. It follows a
 *   smoothed cursor, so a fast flick draws a trail that catches up instead of teleporting.
 * - **Every window** pushes dots away from its rect and dims them beneath it, so a window reads
 *   as resting *on* the field with weight, and moving one visibly disturbs the ground.
 *
 * Painted with Canvas 2D on an animation frame, reading the store through `peek()` rather than
 * subscribing. A subscription would re-render this component on every camera tick, which is the
 * one thing a background must never do.
 */

const dotField = tv({ slots: { canvas: "absolute inset-0 size-full" } });

/** Screen-space lattice pitch. Dots are placed on world multiples of this at zoom 1. */
const LATTICE_PITCH = 30;
const DOT_RADIUS = 1;
const POINTER_RADIUS = 150;
/** How far a window's edge disturbs the field, in screen pixels. */
const WINDOW_FALLOFF = 90;
const WINDOW_PUSH = 7;
/** Per-frame easing toward the live pointer. Lower is heavier. */
const POINTER_EASING = 0.12;

type Vector = { x: number; y: number };
type Rgb = readonly [number, number, number];

/**
 * Canvas 2D resolves neither `var()` nor `color-mix()` in `fillStyle`, so the tokens are read
 * from the document once and interpolated here. Reading them rather than hardcoding keeps the
 * field on the same palette as the rest of the shell.
 */
function readTokenColor(name: string, fallback: Rgb): Rgb {
  const value = getComputedStyle(document.documentElement).getPropertyValue(name).trim();
  const parts = value.match(/[\d.]+/g);

  return parts === null || parts.length < 3
    ? fallback
    : [Number(parts[0]), Number(parts[1]), Number(parts[2])];
}

function mixRgb(from: Rgb, to: Rgb, amount: number) {
  return `rgb(${from[0] + (to[0] - from[0]) * amount} ${from[1] + (to[1] - from[1]) * amount} ${
    from[2] + (to[2] - from[2]) * amount
  })`;
}

/** Distance from a point to the nearest edge of a rect. Negative inside. */
function getSignedRectDistance(rect: InfiniteCanvasRect, point: Vector) {
  const dx = Math.max(rect.x - point.x, 0, point.x - (rect.x + rect.width));
  const dy = Math.max(rect.y - point.y, 0, point.y - (rect.y + rect.height));

  if (dx === 0 && dy === 0) {
    return -Math.min(
      point.x - rect.x,
      rect.x + rect.width - point.x,
      point.y - rect.y,
      rect.y + rect.height - point.y,
    );
  }

  return Math.hypot(dx, dy);
}

export function DotField() {
  const store = useInfiniteCanvasStore();
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    const context = canvas?.getContext("2d");

    if (!canvas || !context) {
      return;
    }

    const restColor = readTokenColor("--dot-rest", [110, 118, 132]);
    const liftColor = readTokenColor("--dot-lift", [255, 168, 112]);
    const restFill = mixRgb(restColor, restColor, 0);
    const pointer: Vector = { x: Number.NaN, y: Number.NaN };
    const easedPointer: Vector = { x: Number.NaN, y: Number.NaN };
    let frame = 0;

    const onPointerMove = (event: PointerEvent) => {
      const bounds = canvas.getBoundingClientRect();

      pointer.x = event.clientX - bounds.left;
      pointer.y = event.clientY - bounds.top;
    };
    const onPointerLeave = () => {
      pointer.x = Number.NaN;
      pointer.y = Number.NaN;
    };

    window.addEventListener("pointermove", onPointerMove, { passive: true });
    window.addEventListener("pointerleave", onPointerLeave, { passive: true });

    const draw = () => {
      frame = requestAnimationFrame(draw);

      const state = store.state$.peek();
      const { camera, viewport } = state;

      if (viewport.width <= 0 || viewport.height <= 0) {
        return;
      }

      const ratio = Math.min(globalThis.devicePixelRatio || 1, 2);

      if (canvas.width !== Math.round(viewport.width * ratio)) {
        canvas.width = Math.round(viewport.width * ratio);
      }

      if (canvas.height !== Math.round(viewport.height * ratio)) {
        canvas.height = Math.round(viewport.height * ratio);
      }

      context.setTransform(ratio, 0, 0, ratio, 0, 0);
      context.clearRect(0, 0, viewport.width, viewport.height);

      // The eased cursor lags the real one, so the highlight has momentum.
      if (Number.isNaN(pointer.x)) {
        easedPointer.x = Number.NaN;
        easedPointer.y = Number.NaN;
      } else if (Number.isNaN(easedPointer.x)) {
        easedPointer.x = pointer.x;
        easedPointer.y = pointer.y;
      } else {
        easedPointer.x += (pointer.x - easedPointer.x) * POINTER_EASING;
        easedPointer.y += (pointer.y - easedPointer.y) * POINTER_EASING;
      }

      // Window rects, projected once per frame rather than once per dot.
      const rects = state.windows
        .filter((window) => window.mode !== "minimized")
        .map((window) => {
          const origin = worldPointToScreenPoint(camera, viewport, {
            x: window.rect.x,
            y: window.rect.y,
          });

          return {
            height: window.rect.height * camera.zoom,
            width: window.rect.width * camera.zoom,
            x: origin.x,
            y: origin.y,
          } satisfies InfiniteCanvasRect;
        });

      // Walk the lattice in world space, so the field pans and zooms with the document.
      const pitch = LATTICE_PITCH * camera.zoom;

      if (pitch < 6) {
        return;
      }

      const originScreen = worldPointToScreenPoint(camera, viewport, { x: 0, y: 0 });
      const startX = originScreen.x - Math.ceil(originScreen.x / pitch) * pitch;
      const startY = originScreen.y - Math.ceil(originScreen.y / pitch) * pitch;

      for (let x = startX; x <= viewport.width + pitch; x += pitch) {
        for (let y = startY; y <= viewport.height + pitch; y += pitch) {
          let offsetX = 0;
          let offsetY = 0;
          let dim = 0;

          for (const rect of rects) {
            const distance = getSignedRectDistance(rect, { x, y });

            if (distance >= WINDOW_FALLOFF) {
              continue;
            }

            if (distance < 0) {
              // Under the window: the field is occluded, not displaced.
              dim = 1;
              continue;
            }

            const strength = (1 - distance / WINDOW_FALLOFF) ** 2;
            const centerX = rect.x + rect.width / 2;
            const centerY = rect.y + rect.height / 2;
            const awayX = x - centerX;
            const awayY = y - centerY;
            const length = Math.hypot(awayX, awayY) || 1;

            offsetX += (awayX / length) * strength * WINDOW_PUSH;
            offsetY += (awayY / length) * strength * WINDOW_PUSH;
            dim = Math.max(dim, strength * 0.7);
          }

          if (dim >= 1) {
            continue;
          }

          const pointerDistance = Number.isNaN(easedPointer.x)
            ? Number.POSITIVE_INFINITY
            : Math.hypot(x - easedPointer.x, y - easedPointer.y);
          const lift =
            pointerDistance >= POINTER_RADIUS ? 0 : (1 - pointerDistance / POINTER_RADIUS) ** 2;

          context.beginPath();
          context.arc(
            x + offsetX,
            y + offsetY,
            DOT_RADIUS * (1 - dim * 0.5) + lift * 1.4,
            0,
            Math.PI * 2,
          );
          context.fillStyle = lift > 0.02 ? mixRgb(restColor, liftColor, lift) : restFill;
          context.globalAlpha = (1 - dim) * (0.5 + lift * 0.5);
          context.fill();
        }
      }

      context.globalAlpha = 1;
    };

    frame = requestAnimationFrame(draw);

    return () => {
      cancelAnimationFrame(frame);
      window.removeEventListener("pointermove", onPointerMove);
      window.removeEventListener("pointerleave", onPointerLeave);
    };
  }, [store]);

  const styles = dotField();

  return <canvas aria-hidden className={styles.canvas()} ref={canvasRef} />;
}
