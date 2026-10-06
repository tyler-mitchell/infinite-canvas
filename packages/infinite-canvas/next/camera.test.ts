import { observable } from "@legendapp/state";
import { afterEach, beforeEach, expect, test, vi } from "vite-plus/test";
import type { CameraRequest } from "./camera";
import { createCanvasState } from "./state";

const playback = vi.hoisted(() => ({
  controls: [] as {
    advance: (progress: number) => void;
    finish: () => void;
    stop: ReturnType<typeof vi.fn>;
  }[],
}));

vi.mock("motion", async (original) => {
  const { observable, when } = await import("@legendapp/state");
  return {
    ...(await original<typeof import("motion")>()),
    animate: (_from: number, _to: number, options: { onUpdate: (progress: number) => void }) => {
      const finished$ = observable(false);
      const control = {
        finished: when(finished$),
        advance: options.onUpdate,
        finish: () => {
          options.onUpdate(1);
          finished$.set(true);
        },
        stop: vi.fn(),
      };
      playback.controls.push(control);
      return control;
    },
  };
});

beforeEach(() => {
  vi.stubGlobal("requestAnimationFrame", vi.fn());
});

afterEach(() => {
  playback.controls.length = 0;
  vi.unstubAllGlobals();
});

const createCanvas = () =>
  createCanvasState({
    viewport: { width: 800, height: 600 },
    cameraMotion: { reducedMotion: "never" },
    windowDefinitions: { card: { size: { width: 200, height: 100 } } },
    document: {
      content: {
        windows: {
          a: { kind: "card", rect: { x: 0, y: 0, width: 200, height: 100 } },
        },
      },
      canvasView: { camera: { center: { x: 400, y: 300 }, zoom: 1 } },
    },
  });

test("reactive destinations keep one animation and do not commit intermediate views", async () => {
  const canvas = createCanvas();
  const point$ = observable({ x: 1000, y: 800 });
  const source = (): CameraRequest => ({
    target: { type: "point", point: point$.get() },
    behavior: { type: "centerAtZoom", zoom: 1 },
  });
  const committed = canvas.computed.view.camera.peek();
  const navigation = canvas.camera.navigate(source);
  expect(canvas.camera.isNavigating(source)).toBe(true);
  const control = playback.controls[0]!;
  control.advance(0.4);
  const displayed = canvas.computed.camera.peek();
  point$.set({ x: 1200, y: 900 });
  expect(playback.controls).toHaveLength(1);
  expect(control.stop).not.toHaveBeenCalled();
  expect(canvas.computed.camera.peek()).toEqual(displayed);
  expect(canvas.computed.view.camera.peek()).toEqual(committed);
  control.advance(0.4);
  expect(canvas.computed.camera.peek().center.x).toBeCloseTo(displayed.center.x);
  expect(canvas.computed.camera.peek().center.y).toBeCloseTo(displayed.center.y);
  control.finish();
  expect(await navigation).toEqual({ status: "completed" });
  expect(canvas.computed.camera.peek()).toEqual({ center: point$.peek(), zoom: 1 });
  expect(canvas.camera.isNavigating(source)).toBe(false);
});

test("moving a window retargets the active animation", async () => {
  const canvas = createCanvas();
  const navigation = canvas.camera.navigate({
    target: { type: "window", windowId: "a" },
    behavior: { type: "centerAtZoom", zoom: 1 },
  });
  const control = playback.controls[0]!;
  control.advance(0.3);
  const displayed = canvas.computed.camera.peek();
  canvas.state.document.content.windows.a.rect.x.set(600);
  expect(playback.controls).toHaveLength(1);
  expect(control.stop).not.toHaveBeenCalled();
  expect(canvas.computed.camera.peek()).toEqual(displayed);
  control.finish();
  expect(await navigation).toEqual({ status: "completed" });
  expect(canvas.computed.camera.peek()).toEqual({ center: { x: 700, y: 50 }, zoom: 1 });
});

test("a new navigation cancels the old source and stops observing it", async () => {
  const canvas = createCanvas();
  const point$ = observable({ x: 1000, y: 800 });
  const source = (): CameraRequest => ({ target: { type: "point", point: point$.get() } });
  const previous = canvas.camera.navigate(source);
  playback.controls[0]!.advance(0.3);
  const next = canvas.camera.navigate({ target: { type: "point", point: { x: 50, y: 60 } } });
  expect(await previous).toEqual({ status: "cancelled" });
  expect(canvas.camera.isNavigating(source)).toBe(false);
  point$.set({ x: 1400, y: 900 });
  expect(playback.controls).toHaveLength(2);
  playback.controls[1]!.finish();
  expect(await next).toEqual({ status: "completed" });
  expect(canvas.computed.camera.peek().center.x).toBeCloseTo(50, 9);
  expect(canvas.computed.camera.peek().center.y).toBeCloseTo(60, 9);
});

test("an unavailable source preserves the displayed view and releases its observer", async () => {
  const canvas = createCanvas();
  const available$ = observable(true);
  const source = (): CameraRequest | null =>
    available$.get() ? { target: { type: "point", point: { x: 1000, y: 800 } } } : null;
  const navigation = canvas.camera.navigate(source);
  playback.controls[0]!.advance(0.4);
  const displayed = canvas.computed.camera.peek();
  available$.set(false);
  expect(await navigation).toEqual({ status: "unavailable" });
  expect(canvas.computed.camera.peek()).toEqual(displayed);
  expect(canvas.state.session.camera.peek()).toBeNull();
  expect(canvas.camera.isNavigating(source)).toBe(false);
  available$.set(true);
  expect(playback.controls).toHaveLength(1);
});
