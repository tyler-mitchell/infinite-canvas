import { createContext, useContext, useRef, type ReactNode, type RefObject } from "react";
import { observer, useValue } from "@legendapp/state/react";
import { getDetailLevel, type DetailLevel } from "../overview";
import { createPortal } from "react-dom";
import type { Canvas } from "../state.types";
import type { Observable } from "@legendapp/state";
import type { WindowState } from "../document.types";

export type WindowContextValue = {
  canvas: Canvas;
  window: Observable<WindowState>;
  viewport: RefObject<HTMLDivElement | null>;
  element: RefObject<HTMLElement | null>;
};

export const WindowContext = createContext<WindowContextValue | null>(null);

export function useCanvasWindow() {
  const context = useContext(WindowContext);
  if (context === null) throw new Error("This component requires a canvas window.");
  return context;
}

export function useWindowDetail(): DetailLevel {
  const { canvas, window } = useCanvasWindow();
  const level = useRef<DetailLevel>("full");
  return useValue(() => {
    const id = window.id.get();
    const width =
      (canvas.computed.windowRect[id].width.get() ?? 0) * canvas.computed.camera.zoom.get();
    level.current = getDetailLevel({
      width,
      previous: level.current,
      ...canvas.computed.windowDefinition[id].detail.get(),
    });
    return level.current;
  });
}

export const ViewportContext = createContext<{
  canvas: Canvas;
  viewport: RefObject<HTMLDivElement | null>;
  transferType: string;
  portal: HTMLDivElement | null;
} | null>(null);

export function useCanvasViewport() {
  const context = useContext(ViewportContext);
  if (context === null) throw new Error("This component requires CanvasViewport.");
  return context;
}

export const CanvasPortal = observer(function CanvasPortal({
  children,
  scope = "viewport",
  above = false,
}: {
  children: ReactNode;
  scope?: "viewport" | "window";
  above?: boolean;
}) {
  const { canvas, portal } = useCanvasViewport();
  const context = useContext(WindowContext);
  if (portal === null) return null;
  if (scope === "viewport") return createPortal(children, portal);
  if (context === null) throw new Error("A window portal requires a canvas window.");
  const id = context.window.id.get();
  const rect = canvas.computed.windowRect[id].get();
  if (rect === undefined) return null;
  const camera = canvas.computed.camera.get();
  const viewport = canvas.state.input.viewport.get();
  const visible = canvas.computed.windowVisible[id].get();
  return createPortal(
    <div
      data-slot="canvas-window-portal"
      hidden={!visible}
      style={{
        position: "absolute",
        display: visible ? undefined : "none",
        pointerEvents: "none",
        left: viewport.width / 2 + (rect.x - camera.center.x) * camera.zoom,
        top: viewport.height / 2 + (rect.y - camera.center.y) * camera.zoom,
        width: rect.width * camera.zoom,
        height: rect.height * camera.zoom,
        zIndex: above
          ? canvas.computed.windowZIndex[canvas.computed.windowRoot[id].get()].get() + 31
          : canvas.computed.windowZIndex[id].get(),
      }}
    >
      {children}
    </div>,
    portal,
  );
});
