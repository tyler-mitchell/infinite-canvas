import { clamp0, intersectsRect, worldToScreen } from "@hyphened/math/cpu";
import { createContext, useContext, useId, useRef, type ReactNode, type RefObject } from "react";
import { observer, useValue } from "@legendapp/state/react";
import { getDetailLevel, type DetailLevel } from "@hyphened/math/cpu";
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
  mode: "edit" | "read" | "explore";
} | null>(null);

export function useCanvasViewport() {
  const context = useContext(ViewportContext);
  if (context === null) throw new Error("This component requires CanvasViewport.");
  return context;
}

const sides = {
  top: { fallbacks: "flip-block, span-bottom span-all", margin: "marginBottom" },
  bottom: { fallbacks: "flip-block, span-top span-all", margin: "marginTop" },
  left: { fallbacks: "flip-inline, span-right span-all", margin: "marginRight" },
  right: { fallbacks: "flip-inline, span-left span-all", margin: "marginLeft" },
} as const;

export const CanvasPortal = observer(function CanvasPortal({
  children,
  scope = "viewport",
  side,
  sideOffset = 0,
}: {
  children: ReactNode;
  scope?: "viewport" | "window" | "selection";
  side?: keyof typeof sides;
  sideOffset?: number;
}) {
  const { canvas, portal, mode } = useCanvasViewport();
  const context = useContext(WindowContext);
  const anchorName = `--canvas-anchor-${useId().replace(/[^\w-]/g, "")}`;
  if (portal === null) return null;
  if (scope === "viewport") return createPortal(children, portal);
  const selection = scope === "selection";
  if (selection && mode !== "edit") return null;
  if (!selection && context === null)
    throw new Error("A window portal requires a canvas window.");
  const id = selection ? undefined : context!.window.id.get();
  const rect = selection
    ? (canvas.computed.selectionBounds.get() ?? undefined)
    : canvas.computed.windowRect[id!].get();
  if (rect === undefined) return null;
  const camera = canvas.computed.camera.get();
  const viewport = canvas.state.input.viewport.get();
  const insets = canvas.computed.viewportInsets.get();
  const visible = selection || canvas.computed.windowVisible[id!].get();
  const screen = worldToScreen({ point: rect, camera, viewport });
  const area = {
    x: 0,
    y: 0,
    width: viewport.width - insets.left - insets.right,
    height: viewport.height - insets.top - insets.bottom,
  };
  const box = {
    x: screen.x - insets.left,
    y: screen.y - insets.top,
    width: rect.width * camera.zoom,
    height: rect.height * camera.zoom,
  };
  return createPortal(
    <div
      hidden={!visible}
      style={{
        position: "absolute",
        display: visible ? undefined : "none",
        pointerEvents: "none",
        ...insets,
        ...(selection ? {} : { zIndex: canvas.computed.windowZIndex[id!].get() }),
      }}
    >
      <div
        data-slot={selection ? "canvas-selection-portal" : "canvas-window-portal"}
        style={{ position: "absolute", left: box.x, top: box.y, width: box.width, height: box.height }}
      >
        {side === undefined ? children : null}
      </div>
      {side === undefined || !intersectsRect(box, area) ? null : (
        <>
          <div
            style={{
              position: "absolute",
              left: clamp0(box.x),
              top: clamp0(box.y),
              right: clamp0(area.width - box.x - box.width),
              bottom: clamp0(area.height - box.y - box.height),
              anchorName,
            }}
          />
          <div
            key={selection ? canvas.computed.selectedWindows.map((window) => window.id.get()).join() : id}
            data-slot="canvas-portal-positioner"
            style={{
              position: "absolute",
              positionAnchor: anchorName,
              positionArea: side,
              positionTryFallbacks: sides[side].fallbacks,
              [sides[side].margin]: sideOffset,
            }}
          >
            {children}
          </div>
        </>
      )}
    </div>,
    portal,
  );
});
