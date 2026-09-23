import { type } from "arktype";
import { batch, observable, observe, when } from "@legendapp/state";
import {
  animate,
  type AnimationPlaybackControlsWithThen,
  type Transition,
} from "motion";
import {
  getCameraDestination,
  interpolateCamera,
  unionRects,
  type Camera,
  type Rect,
} from "@hyphened/math/cpu";
import type { CanvasContext } from "./state.types";

const point = type({ x: "number", y: "number" });
export const cameraNavigation = type({
  target: type({ type: "'point'", point })
    .or({
      type: "'rect'",
      rect: { x: "number", y: "number", width: "number >= 0", height: "number >= 0" },
    })
    .or({ type: "'window'", windowId: "string > 0" })
    .or({ type: "'selection'" })
    .or({ type: "'visibleWindows'" }),
  "behavior?": type({ type: "'center'" }).or({ type: "'centerAtZoom'", zoom: "number > 0" }).or({
    type: "'fit'",
    "padding?": "number >= 0",
    "framingMode?": "'both' | 'horizontal' | 'vertical'",
    "framingSize?": "number > 0",
    "maxZoom?": "number > 0",
  }),
  "composition?": { "targetOffset?": point, "screenPosition?": point },
  "curvature?": "number >= 0",
  "reducedMotion?": "'user' | 'always' | 'never'",
});

export type CameraMotion = {
  transition?: Transition;
  curvature?: number;
  reducedMotion?: "user" | "always" | "never";
};
export type CameraRequest = CameraNavigation & CameraMotion;
export type CameraRequestSource = CameraRequest | (() => CameraRequest | null);
export type CameraController = {
  navigate: (source: CameraRequestSource) => Promise<CameraNavigationResult>;
  isNavigating: (source?: CameraRequestSource) => boolean;
  stop: () => void;
};

export function createCameraController({
  canvas,
  motion = {},
}: {
  canvas: Pick<CanvasContext, "state" | "computed">;
  motion?: CameraMotion;
}): CameraController {
  const active: { cancel?: () => void; source?: CameraRequestSource } = {};
  const stop = () => active.cancel?.();
  return {
    stop,
    isNavigating: (source) =>
      active.cancel !== undefined && (source === undefined || active.source === source),
    navigate: (source) => {
      stop();
      const workspaceId = canvas.state.document.activeWorkspaceId.peek();
      const view =
        workspaceId === null
          ? canvas.state.document.canvasView
          : canvas.state.document.workspaceViews[workspaceId];
      const initialCamera = canvas.computed.camera.peek();
      const status$ = observable<CameraNavigationResult["status"]>();
      const resources: {
        animation?: AnimationPlaybackControlsWithThen;
        disposeObserver?: () => void;
        destination?: Camera;
        camera: Camera;
        progress: number;
        interpolate?: (progress: number) => Camera;
      } = { camera: initialCamera, progress: 0 };
      const finish = (status: CameraNavigationResult["status"]) => {
        if (status$.peek() !== undefined) return;
        resources.disposeObserver?.();
        resources.animation?.stop();
        const preview = canvas.state.session.camera.peek();
        batch(() => {
          if (
            workspaceId === null ||
            canvas.state.document.content.workspaces[workspaceId].peek() !== undefined
          ) {
            if (status === "completed" && resources.destination !== undefined)
              view.camera.set(resources.destination);
            else if (resources.animation !== undefined || preview?.workspaceId === workspaceId)
              view.camera.set(resources.camera);
          }
          canvas.state.session.camera.set(null);
          status$.set(status);
        });
        if (active.cancel === cancel) {
          active.cancel = undefined;
          active.source = undefined;
        }
      };
      const cancel = () => finish("cancelled");
      active.cancel = cancel;
      active.source = source;
      const disposeObserver = observe(() => {
        const activeWorkspace = canvas.state.document.activeWorkspaceId.get();
        const pointerId = canvas.computed.capturedPointerId.get();
        if (activeWorkspace !== workspaceId || pointerId !== null) {
          cancel();
          return;
        }
        const request = typeof source === "function" ? source() : source;
        if (request === null) {
          finish("unavailable");
          return;
        }
        const target = request.target;
        const rect: Rect | null | undefined = (() => {
          switch (target.type) {
            case "point":
              return { ...target.point, width: 0, height: 0 };
            case "rect":
              return target.rect;
            case "window":
              return canvas.computed.windowVisible[target.windowId].get()
                ? canvas.computed.windowRect[target.windowId].get()
                : null;
            case "visibleWindows":
              return canvas.computed.contentBounds.get();
            case "selection":
              return unionRects(
                canvas.computed.selectionTargets.flatMap((entry) => {
                  const target = entry.get();
                  const rect =
                    target.type === "window"
                      ? canvas.computed.windowRect[target.id].get()
                      : undefined;
                  return rect === undefined ? [] : [rect];
                }),
              );
          }
        })();
        if (rect == null) {
          finish("unavailable");
          return;
        }
        const viewport = canvas.state.input.viewport.get();
        if (viewport.width <= 0 || viewport.height <= 0) {
          finish("unavailable");
          return;
        }
        const destination = getCameraDestination({
          rect,
          camera: initialCamera,
          viewport,
          insets: canvas.computed.viewportInsets.get(),
          navigation: request,
          limits: canvas.state.config.camera.get(),
        });
        const previous = resources.destination;
        if (
          previous?.center.x === destination.center.x &&
          previous.center.y === destination.center.y &&
          previous.zoom === destination.zoom
        )
          return;
        resources.destination = destination;
        resources.interpolate = interpolateCamera({
          from: resources.camera,
          to: destination,
          width: viewport.width,
          curvature: request.curvature ?? motion.curvature,
          startProgress: resources.progress,
        });
        const reducedMotion = request.reducedMotion ?? motion.reducedMotion ?? "user";
        const immediate =
          reducedMotion === "always" ||
          typeof requestAnimationFrame === "undefined" ||
          (reducedMotion === "user" &&
            typeof matchMedia !== "undefined" &&
            matchMedia("(prefers-reduced-motion: reduce)").matches);
        if (immediate) {
          finish("completed");
          return;
        }
        if (resources.animation !== undefined) return;
        const transition = {
          duration: 0.7,
          ease: [0.22, 1, 0.36, 1] as const,
          ...motion.transition,
          ...request.transition,
        };
        const animation = animate(0, 1, {
          ...transition,
          onUpdate: (progress) => {
            resources.progress = progress;
            resources.camera = resources.interpolate!(progress);
            canvas.state.session.camera.set({ workspaceId, camera: resources.camera });
            transition.onUpdate?.(progress);
          },
        });
        resources.animation = animation;
        animation.finished.then(
          () => {
            if (resources.animation === animation) finish("completed");
          },
          (error: unknown) => {
            if (resources.animation !== animation) return;
            console.warn("Camera animation failed.", { error });
            finish("cancelled");
          },
        );
      });
      resources.disposeObserver = disposeObserver;
      if (status$.peek() !== undefined) disposeObserver();
      return when(status$, (status) => ({ status: status! }));
    },
  };
}

export type CameraNavigation = typeof cameraNavigation.infer;
export type CameraTarget = CameraNavigation["target"];

export type CameraNavigationResult =
  | { status: "completed" }
  | { status: "cancelled" }
  | { status: "unavailable" };
