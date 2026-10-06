import { observer } from "@legendapp/state/react";
import {
  getMinimapLayout,
  getMinimapWorldPoint,
  getOffscreenIndicators,
  type Canvas,
  type Rect,
} from "@hyphened/infinite-canvas";

const size = { width: 200, height: 132 };
const place = (rect: Rect) => ({
  left: rect.x,
  top: rect.y,
  width: rect.width,
  height: rect.height,
});

export const CanvasMinimap = observer(function CanvasMinimap({ canvas }: { canvas: Canvas }) {
  const rects = canvas.computed.contentRects.get();
  const viewport = canvas.computed.viewportRect.get();
  const layout = getMinimapLayout({ rects, viewport, size, padding: 6 });
  if (layout === null) return null;
  return (
    <>
      <button
        data-canvas-control
        aria-label="Canvas overview"
        style={size}
        className="absolute right-4 bottom-4 z-70 cursor-crosshair border border-white/15 bg-black/80"
        onClick={(event) => {
          const bounds = event.currentTarget.getBoundingClientRect();
          const point = getMinimapWorldPoint({
            layout,
            point: { x: event.clientX - bounds.left, y: event.clientY - bounds.top },
          });
          void canvas.commands.navigateCamera.run({ target: { type: "point", point } });
        }}
      >
        {Object.entries(layout.items).map(([key, rect]) => (
          <span key={key} className="absolute bg-white/25" style={place(rect)} />
        ))}
        <span className="absolute border border-cyan-300" style={place(layout.viewport)} />
      </button>
      {getOffscreenIndicators({ rects, viewport }).map(({ key, edge, angle }) => (
        <span
          key={key}
          data-canvas-control
          aria-hidden="true"
          className="absolute z-70 text-cyan-300"
          style={{
            left: `calc(${edge.x * 100}% + ${(0.5 - edge.x) * 48}px)`,
            top: `calc(${edge.y * 100}% + ${(0.5 - edge.y) * 48}px)`,
            transform: `translate(-50%, -50%) rotate(${angle}rad)`,
          }}
        >
          ➤
        </span>
      ))}
    </>
  );
});
