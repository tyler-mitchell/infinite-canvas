import {
  animate,
  cancelFrame,
  frame,
  motionValue,
  type AnimationPlaybackControlsWithThen,
  type ValueAnimationTransition,
} from "motion";
import { getConstrainedZoom } from "./geometry";
import { navigateCamera } from "./camera-navigation";
import { canvasModel } from "./schema";
import type {
  InfiniteCanvasCamera,
  InfiniteCanvasCameraNavigationRequest,
  InfiniteCanvasRect,
  InfiniteCanvasState,
  InfiniteCanvasZoomPolicy,
} from "./types";

export type CameraTransition = Omit<
  ValueAnimationTransition<number>,
  "onUpdate" | "onComplete" | "onStop" | "onPlay" | "onRepeat"
>;

export type CameraNavigation = InfiniteCanvasCameraNavigationRequest &
  Readonly<{
    transition?: CameraTransition | false;
    signal?: AbortSignal;
  }>;

export type CameraNavigationResult = "completed" | "cancelled" | "unavailable";

export type CameraAnimationRequest = Readonly<{
  camera: InfiniteCanvasCamera;
  transition?: CameraTransition | false;
  signal?: AbortSignal;
}>;

export type CameraRigOptions = Readonly<{
  transition?: CameraTransition | false;
  reducedMotion?: "user" | "always" | "never";
}>;

export type CameraRig = Readonly<{
  animate(request: CameraAnimationRequest): Promise<CameraNavigationResult>;
  navigate(request: CameraNavigation): Promise<CameraNavigationResult>;
  stop(): void;
}>;

export function createCameraRig<Kind extends string>({
  getState,
  getSelectionBounds,
  write,
  commit,
  zoomPolicy,
  options = {},
}: Readonly<{
  getState(): InfiniteCanvasState<Kind>;
  getSelectionBounds(state: InfiniteCanvasState<Kind>): InfiniteCanvasRect | null;
  write(camera: InfiniteCanvasCamera): void;
  commit(): void;
  zoomPolicy: InfiniteCanvasZoomPolicy;
  options?: CameraRigOptions;
}>): CameraRig & Readonly<{ refresh(): void }> {
  const initial = getState().camera;
  const values = {
    x: motionValue(initial.center.x),
    y: motionValue(initial.center.y),
    zoom: motionValue(Math.log(initial.zoom)),
  };
  const active: {
    finish?: (result: CameraNavigationResult) => void;
    refresh?: () => void;
  } = {};
  const writeCamera = () =>
    write({
      center: { x: values.x.get(), y: values.y.get() },
      zoom: getConstrainedZoom(Math.exp(values.zoom.get()), zoomPolicy),
    });
  const schedule = () => {
    if (active.finish !== undefined) frame.render(writeCamera);
  };
  Object.values(values).forEach((value) => value.on("change", schedule));
  const stop = () => active.finish?.("cancelled");
  const animateTo = (
    request: CameraAnimationRequest & Readonly<{ navigation?: CameraNavigation }>,
  ): Promise<CameraNavigationResult> => {
    if (request.signal?.aborted) return Promise.resolve("cancelled");
    if (!canvasModel.Camera.allows(request.camera)) return Promise.resolve("unavailable");
    if (getState().interaction !== null) return Promise.resolve("unavailable");
    const camera = { ...request.camera, zoom: getConstrainedZoom(request.camera.zoom, zoomPolicy) };
    stop();
    const state = getState();
    const transition = request.transition ?? options.transition;
    const reducedMotion = options.reducedMotion ?? "user";
    const immediate =
      transition === false ||
      reducedMotion === "always" ||
      typeof requestAnimationFrame === "undefined" ||
      (reducedMotion === "user" &&
        globalThis.matchMedia?.("(prefers-reduced-motion: reduce)").matches);
    if (immediate) {
      write(camera);
      commit();
      return Promise.resolve("completed");
    }
    const source = {
      x: state.camera.center.x,
      y: state.camera.center.y,
      zoom: Math.log(state.camera.zoom),
    };
    (Object.keys(values) as (keyof typeof values)[]).forEach((key) => {
      if (values[key].get() !== source[key]) values[key].jump(source[key]);
    });
    return new Promise<CameraNavigationResult>((resolve) => {
      const playback: {
        camera: InfiniteCanvasCamera;
        animations: AnimationPlaybackControlsWithThen[];
      } = { camera, animations: [] };
      const finish = (result: CameraNavigationResult) => {
        if (active.finish !== finish) return;
        active.finish = undefined;
        active.refresh = undefined;
        playback.animations.forEach((animation) => animation.stop());
        cancelFrame(writeCamera);
        request.signal?.removeEventListener("abort", cancel);
        writeCamera();
        commit();
        resolve(result);
      };
      const play = (camera: InfiniteCanvasCamera) => {
        const options: CameraTransition = {
          duration: 0.7,
          ease: [0.22, 1, 0.36, 1],
          ...transition,
        };
        const animations = [
          animate(values.x, camera.center.x, options),
          animate(values.y, camera.center.y, options),
          animate(values.zoom, Math.log(camera.zoom), options),
        ];
        playback.camera = camera;
        playback.animations = animations;
        void Promise.all(animations).then(() => {
          if (playback.animations === animations) finish("completed");
        });
      };
      const cancel = () => finish("cancelled");
      active.finish = finish;
      active.refresh = () => {
        if (request.navigation === undefined) return;
        const state = getState();
        const next = navigateCamera(
          state,
          request.navigation,
          zoomPolicy,
          getSelectionBounds(state),
        );
        if (next === state) {
          finish("unavailable");
          return;
        }
        if (
          next.camera.center.x !== playback.camera.center.x ||
          next.camera.center.y !== playback.camera.center.y ||
          next.camera.zoom !== playback.camera.zoom
        )
          play(next.camera);
      };
      request.signal?.addEventListener("abort", cancel, { once: true });
      play(camera);
    });
  };
  return {
    animate: animateTo,
    refresh: () => active.refresh?.(),
    stop,
    navigate: (request) => {
      if (request.signal?.aborted) return Promise.resolve("cancelled");
      if (!canvasModel.CameraNavigationRequest.allows(request))
        return Promise.resolve("unavailable");
      const state = getState();
      const next = navigateCamera(state, request, zoomPolicy, getSelectionBounds(state));
      return next === state
        ? Promise.resolve("unavailable")
        : animateTo({
            camera: next.camera,
            transition: request.transition,
            signal: request.signal,
            navigation: request,
          });
    },
  };
}
