import {
  axes,
  cameraEquals,
  visibleWorldRect,
  type Axis,
  type CameraTrack,
} from "@hyphened/math/cpu";
import { ScrollArea } from "@base-ui/react/scroll-area";
import { batch, type Observable } from "@legendapp/state";
import { observer, useComputed, useObservable } from "@legendapp/state/react";
import {
  createContext,
  useContext,
  useCallback,
  useLayoutEffect,
  useEffectEvent,
  useMemo,
  useRef,
  type CSSProperties,
  type ReactNode,
  type RefObject,
} from "react";
import type { PlacedSection } from "@hyphened/math/cpu";
import type { Canvas } from "../state.types";
import type { CameraRequest } from "../camera";

type ScrollContextValue = {
  canvas: Canvas;
  windows: readonly PlacedSection[];
  attached: boolean;
  following: Observable<boolean>;
  axis: Axis;
  scrollTo: () => void;
  focusWindow: (windowId: string) => void;
  viewport: RefObject<HTMLDivElement | null>;
  track: CameraTrack | null;
};

export const ScrollContext = createContext<ScrollContextValue | null>(null);

export function useCanvasScroll() {
  const context = useContext(ScrollContext);
  if (context === null) throw new Error("This component requires CanvasScroll.");
  return context;
}

export function useCanvasScrollMode(): "read" | "explore" | undefined {
  const context = useContext(ScrollContext);
  if (context === null) return undefined;
  return context.attached ? "read" : "explore";
}

export function useCanvasScrollAxis(): Axis | undefined {
  return useContext(ScrollContext)?.axis;
}

export const CanvasScroll = observer(function CanvasScroll({
  canvas,
  attached = true,
  focusedWindowId,
  onFocusedWindowChange,
  className,
  style,
  scrollbar,
  children,
}: {
  canvas: Canvas;
  attached?: boolean;
  focusedWindowId?: string;
  onFocusedWindowChange?: (windowId: string) => void;
  className?: string;
  style?: CSSProperties;
  scrollbar?: ReactNode;
  children: ReactNode;
}) {
  const viewport = useRef<HTMLDivElement>(null);
  const scrollOffset = useObservable(0);
  const following = useComputed(() => {
    const track = canvas.computed.cameraTrack.get();
    return (
      attached &&
      track !== null &&
      cameraEquals({
        camera: canvas.computed.camera.get(),
        target: track.at(scrollOffset.get()),
      })
    );
  }, [canvas, attached]);
  const axis = canvas.state.document.content.presentation.axis.get();
  const track = canvas.computed.cameraTrack.get();
  const follow = useCallback(
    (offset: number, settled: boolean) => {
      const track = canvas.computed.cameraTrack.peek();
      if (track === null || !attached) return;
      batch(() => {
        scrollOffset.set(offset);
        canvas.actions[settled ? "setCamera" : "previewCamera"].run(track.at(offset));
      });
    },
    [canvas, attached, scrollOffset],
  );
  const offsetOf = (element: HTMLElement) =>
    axis === "vertical" ? element.scrollTop : element.scrollLeft;
  const scrollNavigation = useCallback((): CameraRequest | null => {
    const track = canvas.computed.cameraTrack.get();
    if (track === null || !attached) return null;
    const pose = track.at(scrollOffset.get());
    return {
      target: {
        type: "rect",
        rect: visibleWorldRect({
          camera: pose,
          viewport: canvas.state.input.viewport.get(),
          insets: canvas.computed.viewportInsets.get(),
        }),
      },
      behavior: { type: "centerAtZoom", zoom: pose.zoom },
    };
  }, [canvas, attached, scrollOffset]);
  const place = useCallback(
    async ({ offset, immediate = false }: { offset: number; immediate?: boolean }) => {
      const element = viewport.current;
      const track = canvas.computed.cameraTrack.peek();
      if (track === null || element === null) return;
      const camera = canvas.computed.camera.peek();
      const pose = track.at(offset);
      const settle = () => {
        const owner = synchronized.current;
        if (
          owner?.canvas !== canvas ||
          !owner.attached ||
          owner.track !== track ||
          viewport.current !== element
        )
          return;
        element[axis === "vertical" ? "scrollTop" : "scrollLeft"] = offset;
        follow(offset, true);
      };
      if (immediate || cameraEquals({ camera, target: pose })) {
        settle();
        return;
      }
      const navigation = await canvas.commands.navigateCamera.run({
        target: {
          type: "rect",
          rect: visibleWorldRect({
            camera: pose,
            viewport: canvas.state.input.viewport.peek(),
            insets: canvas.computed.viewportInsets.peek(),
          }),
        },
        behavior: { type: "centerAtZoom", zoom: pose.zoom },
      });
      if (
        navigation.data?.status === "completed" &&
        !canvas.camera.isNavigating() &&
        cameraEquals({ camera: canvas.computed.camera.peek(), target: pose })
      )
        settle();
    },
    [canvas, axis, follow],
  );
  const scrollTo = useCallback(() => {
    const offset = viewport.current?.[axis === "vertical" ? "scrollTop" : "scrollLeft"];
    if (offset === undefined) return;
    void place({ offset });
  }, [canvas, axis, place]);
  const focusWindow = useCallback(
    (windowId: string) => {
      if (!canvas.commands.revealWindow.canRun({ window: windowId })) return;
      void canvas.commands.revealWindow.run({ window: windowId });
      onFocusedWindowChange?.(windowId);
    },
    [canvas, onFocusedWindowChange],
  );
  const synchronized = useRef<{
    canvas: Canvas;
    track: CameraTrack | null;
    attached: boolean;
    focusedWindowId: string | undefined;
  } | null>(null);
  const synchronize = useEffectEvent(() => {
    const previous = synchronized.current;
    synchronized.current = { canvas, track, attached, focusedWindowId };
    if (!attached) {
      if (previous?.attached !== false || previous.canvas !== canvas)
        canvas.actions.setCamera.run(canvas.computed.camera.peek());
      return;
    }
    const element = viewport.current;
    if (track === null || element === null) return;
    if (previous?.track == null || previous.canvas !== canvas) {
      void place({ offset: 0, immediate: true });
      if (
        focusedWindowId !== undefined &&
        canvas.commands.revealWindow.canRun({ window: focusedWindowId })
      )
        void canvas.commands.revealWindow.run({ window: focusedWindowId, reducedMotion: "always" });
    } else if (!previous.attached) {
      void place({ offset: track.offsetAt(canvas.computed.camera.peek()) });
    } else if (previous.focusedWindowId !== focusedWindowId && focusedWindowId !== undefined) {
      if (
        canvas.computed.view.activeWindowId.peek() !== focusedWindowId &&
        canvas.commands.revealWindow.canRun({ window: focusedWindowId })
      )
        void canvas.commands.revealWindow.run({ window: focusedWindowId });
    } else if (
      previous.track !== track &&
      cameraEquals({
        camera: canvas.computed.camera.peek(),
        target: previous.track.at(scrollOffset.peek()),
      })
    ) {
      follow(offsetOf(element), true);
    }
  });
  useLayoutEffect(() => synchronize(), [canvas, track, attached, focusedWindowId]);
  const context = useMemo<ScrollContextValue>(
    () => ({
      canvas,
      windows: track?.sections ?? [],
      attached,
      following,
      axis,
      scrollTo,
      focusWindow,
      viewport,
      track,
    }),
    [canvas, track, attached, following, axis, scrollTo, focusWindow],
  );
  return (
    <ScrollContext.Provider value={context}>
      <ScrollArea.Root
        data-slot="canvas-scroll"
        className={className}
        style={{ position: "relative", height: "100%", ...style }}
      >
        <ScrollArea.Viewport
          ref={viewport}
          onScroll={async (event) => {
            const element = event.currentTarget;
            const offset = offsetOf(element);
            if (following.peek() && !canvas.camera.isNavigating(scrollNavigation)) {
              follow(offset, false);
              return;
            }
            if (!attached) return;
            scrollOffset.set(offset);
            if (canvas.camera.isNavigating(scrollNavigation)) return;
            const navigation = await canvas.camera.navigate(scrollNavigation);
            const owner = synchronized.current;
            if (
              navigation.status === "completed" &&
              owner?.canvas === canvas &&
              owner.attached &&
              viewport.current === element &&
              !canvas.camera.isNavigating() &&
              following.peek()
            )
              follow(scrollOffset.peek(), true);
          }}
          onScrollEnd={(event) => {
            if (following.peek() && !canvas.camera.isNavigating(scrollNavigation))
              follow(offsetOf(event.currentTarget), true);
          }}
          style={{
            position: "relative",
            height: "100%",
            [`overflow${axis === "vertical" ? "X" : "Y"}`]: "hidden",
          }}
        >
          <div
            aria-hidden="true"
            style={{
              position: "absolute",
              top: 0,
              left: 0,
              [axes[axis].cross]: 1,
              [axes[axis].main]: `calc(100% + ${track?.length ?? 0}px)`,
              pointerEvents: "none",
            }}
          />
          <div style={{ position: "sticky", top: 0, left: 0, height: "100%" }}>{children}</div>
        </ScrollArea.Viewport>
        {scrollbar}
      </ScrollArea.Root>
    </ScrollContext.Provider>
  );
});
