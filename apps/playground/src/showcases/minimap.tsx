import {
  getInfiniteCanvasMinimapLayout,
  getInfiniteCanvasMinimapWorldPoint,
  useInfiniteCanvasDispatch,
  useInfiniteCanvasState,
} from "@hyphened/infinite-canvas/legacy";

/** The framework owns projection. The playground owns minimap UI. */
const MINIMAP_SIZE = { height: 132, width: 200 } as const;

export function CanvasMinimap() {
  // The minimap follows camera changes, so it subscribes to all state.
  const state = useInfiniteCanvasState();
  const dispatch = useInfiniteCanvasDispatch();
  const layout = getInfiniteCanvasMinimapLayout(state, MINIMAP_SIZE);

  if (layout === null) {
    return null;
  }

  return (
    <div
      className="pointer-events-auto absolute top-4 right-4 overflow-hidden rounded-lg border border-border bg-popover/80 backdrop-blur"
      onPointerDown={(event) => {
        const bounds = event.currentTarget.getBoundingClientRect();

        dispatch({
          request: {
            target: {
              point: getInfiniteCanvasMinimapWorldPoint(layout, {
                x: event.clientX - bounds.left,
                y: event.clientY - bounds.top,
              }),
              type: "point",
            },
          },
          type: "camera.navigate",
        });
      }}
      style={{ cursor: "crosshair", height: MINIMAP_SIZE.height, width: MINIMAP_SIZE.width }}
      title="Click to fly there"
    >
      {layout.groups.map((group) => (
        <div
          className="absolute rounded-[1px] border border-sky-400/30 bg-sky-400/5"
          key={group.groupId}
          // The style maps x and y to CSS positions instead of DOM attributes.
          style={{
            height: group.rect.height,
            left: group.rect.x,
            top: group.rect.y,
            width: group.rect.width,
          }}
        />
      ))}

      {layout.windows.map((window) => (
        <div
          className={
            window.isActive
              ? "absolute rounded-[1px] bg-emerald-300/80"
              : window.isSelected
                ? "absolute rounded-[1px] bg-white/45"
                : "absolute rounded-[1px] bg-white/20"
          }
          key={window.windowId}
          style={{
            height: Math.max(window.rect.height, 1.5),
            left: window.rect.x,
            top: window.rect.y,
            // A 1.5-pixel minimum keeps small windows visible at low zoom.
            width: Math.max(window.rect.width, 1.5),
          }}
        />
      ))}

      {/* The viewport renders last so it stays visible above the map. */}
      {layout.viewport === null ? null : (
        <div
          className="pointer-events-none absolute border border-emerald-300/80 bg-emerald-300/5"
          style={{
            height: layout.viewport.height,
            left: layout.viewport.x,
            top: layout.viewport.y,
            width: layout.viewport.width,
          }}
        />
      )}
    </div>
  );
}
