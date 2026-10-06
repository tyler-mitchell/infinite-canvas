import { useValue } from "@legendapp/state/react";
import { InfiniteCanvasCameraLayer } from "../camera-layer";
import { DEFAULT_INFINITE_CANVAS_STACK_BANDS } from "../constants";
import type {
  InfiniteCanvasChromeMetrics,
  InfiniteCanvasRect,
  InfiniteCanvasSize,
  InfiniteCanvasTheme,
  InfiniteCanvasWindow,
} from "../types";
import { InfiniteCanvasWindowFrame } from "../window-frame";
import { useInfiniteCanvasStore } from "./store";

export function ComponentPreview<Kind extends string>({
  window,
  rect,
  canvasInstanceId,
  chrome,
  theme,
  onMeasure,
}: Readonly<{
  window: InfiniteCanvasWindow<Kind>;
  rect: InfiniteCanvasRect;
  canvasInstanceId: string;
  chrome: InfiniteCanvasChromeMetrics;
  theme: InfiniteCanvasTheme;
  onMeasure: (measurement: Readonly<{ windowId: string; contentSize: InfiniteCanvasSize }>) => void;
}>) {
  const store = useInfiniteCanvasStore<Kind>();
  const zoom = useValue(store.state$.camera.zoom);
  const windowDefinitions = useValue(store.windowDefinitions$);
  return (
    <div
      aria-hidden
      inert
      data-slot="component-measurement"
      style={{ position: "absolute", inset: 0, visibility: "hidden", pointerEvents: "none" }}
    >
      <InfiniteCanvasCameraLayer zIndex={0}>
        <InfiniteCanvasWindowFrame
          canvasInstanceId={`${canvasInstanceId}:preview`}
          chrome={chrome}
          isActive
          isSelected
          isGrouped={false}
          isPointerOwned
          rect={rect}
          window={window}
          windowDefinitions={windowDefinitions}
          stackBands={DEFAULT_INFINITE_CANVAS_STACK_BANDS}
          theme={theme}
          zoom={zoom}
          dispatch={(action) => {
            if (action.type === "window.setContentHeight")
              onMeasure({
                windowId: window.id,
                contentSize: { width: rect.width, height: action.height },
              });
          }}
        />
      </InfiniteCanvasCameraLayer>
    </div>
  );
}
