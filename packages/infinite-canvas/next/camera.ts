import { type } from "arktype";
import { batch, observable, observe, when } from "@legendapp/state";
import {
  animate,
  cancelFrame,
  frame,
  motionValue,
  type AnimationPlaybackControlsWithThen,
  type Transition,
} from "motion";
import { unionRects, type Camera, type Point, type Rect, type Size } from "./geometry";
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
});

export type ViewportInsets = { top: number; right: number; bottom: number; left: number };

export type CameraMotion = { transition?: Transition; reducedMotion?: "user" | "always" | "never" };
export type CameraRequest = CameraNavigation & CameraMotion;
export type CameraController = {
  navigate: (request: CameraRequest) => Promise<CameraNavigationResult>;
  stop: () => void;
};

export function createCameraController({
  canvas,
  motion = {},
}: {
  canvas: Pick<CanvasContext, "state" | "computed">;
  motion?: CameraMotion;
}): CameraController {
  const active: { cancel?: () => void } = {};
  const stop = () => active.cancel?.();
  return {
    stop,
    navigate: (request) => {
      stop();
      const workspaceId = canvas.state.document.activeWorkspaceId.peek();
      const view =
        workspaceId === null
          ? canvas.state.document.canvasView
          : canvas.state.document.workspaceViews[workspaceId];
      const initialCamera = view.camera.peek();
      const x = motionValue(initialCamera.center.x);
      const y = motionValue(initialCamera.center.y);
      const zoom = motionValue(Math.log(initialCamera.zoom));
      const status$ = observable<CameraNavigationResult["status"]>();
      const resources: {
        animation?: AnimationPlaybackControlsWithThen;
        disposeObserver?: () => void;
        destination?: Camera;
      } = {};
      const write = () =>
        canvas.state.session.camera.set({
          workspaceId,
          camera: { center: { x: x.get(), y: y.get() }, zoom: Math.exp(zoom.get()) },
        });
      const scheduleWrite = () => frame.render(write);
      const subscriptions = [
        x.on("change", scheduleWrite),
        y.on("change", scheduleWrite),
        zoom.on("change", scheduleWrite),
      ];
      const finish = (status: CameraNavigationResult["status"]) => {
        if (status$.peek() !== undefined) return;
        resources.disposeObserver?.();
        subscriptions.forEach((unsubscribe) => unsubscribe());
        resources.animation?.stop();
        cancelFrame(write);
        const preview = canvas.state.session.camera.peek();
        batch(() => {
          if (
            workspaceId === null ||
            canvas.state.document.content.workspaces[workspaceId].peek() !== undefined
          ) {
            if (status === "completed" && resources.destination !== undefined)
              view.camera.set(resources.destination);
            else if (resources.animation !== undefined || preview?.workspaceId === workspaceId)
              view.camera.set({ center: { x: x.get(), y: y.get() }, zoom: Math.exp(zoom.get()) });
          }
          canvas.state.session.camera.set(null);
          status$.set(status);
        });
        if (active.cancel === cancel) active.cancel = undefined;
        x.destroy();
        y.destroy();
        zoom.destroy();
      };
      const cancel = () => finish("cancelled");
      active.cancel = cancel;
      const disposeObserver = observe(() => {
        const activeWorkspace = canvas.state.document.activeWorkspaceId.get();
        const pointerId = canvas.computed.capturedPointerId.get();
        if (activeWorkspace !== workspaceId || pointerId !== null) {
          cancel();
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
          insets: canvas.state.input.viewportInsets.get(),
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
        resources.animation?.stop();
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
        const transition = {
          duration: 0.7,
          ease: [0.22, 1, 0.36, 1] as const,
          ...motion.transition,
          ...request.transition,
          at: 0,
        };
        const animation = animate([
          [x, destination.center.x, transition],
          [y, destination.center.y, transition],
          [zoom, Math.log(destination.zoom), transition],
        ]);
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

export type CameraTarget =
  | { type: "point"; point: Point }
  | { type: "rect"; rect: Rect }
  | { type: "window"; windowId: string }
  | { type: "selection" }
  | { type: "visibleWindows" };

export type CameraBehavior =
  | { type: "center" }
  | { type: "centerAtZoom"; zoom: number }
  | {
      type: "fit";
      padding?: number;
      framingMode?: "both" | "horizontal" | "vertical";
      framingSize?: number;
      maxZoom?: number;
    };

export type CameraNavigation = {
  target: CameraTarget;
  behavior?: CameraBehavior;
  composition?: { targetOffset?: Point; screenPosition?: Point };
};

export type CameraNavigationResult =
  | { status: "completed" }
  | { status: "cancelled" }
  | { status: "unavailable" };

export function getCameraDestination({
  rect,
  camera,
  viewport,
  insets,
  navigation,
  limits,
}: {
  rect: Rect;
  camera: Camera;
  viewport: Size;
  insets: ViewportInsets;
  navigation: CameraNavigation;
  limits: { minZoom: number; maxZoom: number; padding: number };
}): Camera {
  const width = Math.max(viewport.width - insets.left - insets.right, 1);
  const height = Math.max(viewport.height - insets.top - insets.bottom, 1);
  const behavior = navigation.behavior ?? { type: "center" };
  const requestedZoom = (() => {
    switch (behavior.type) {
      case "center":
        return camera.zoom;
      case "centerAtZoom":
        return behavior.zoom;
      case "fit": {
        const padding = behavior.padding ?? limits.padding;
        const horizontal = Math.max(width - padding * 2, 1) / Math.max(rect.width, 1);
        const vertical = Math.max(height - padding * 2, 1) / Math.max(rect.height, 1);
        const fit = { horizontal, vertical, both: Math.min(horizontal, vertical) };
        return Math.min(
          fit[behavior.framingMode ?? "both"] * (behavior.framingSize ?? 1),
          behavior.maxZoom ?? limits.maxZoom,
        );
      }
    }
  })();
  const zoom = Math.min(limits.maxZoom, Math.max(limits.minZoom, requestedZoom));
  const offset = navigation.composition?.targetOffset ?? { x: 0, y: 0 };
  const position = navigation.composition?.screenPosition ?? { x: 0.5, y: 0.5 };
  return {
    zoom,
    center: {
      x:
        rect.x +
        rect.width / 2 +
        offset.x -
        (insets.left + width * position.x - viewport.width / 2) / zoom,
      y:
        rect.y +
        rect.height / 2 +
        offset.y -
        (insets.top + height * position.y - viewport.height / 2) / zoom,
    },
  };
}
