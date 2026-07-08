import {
  getInfiniteCanvasMinimapLayout,
  getInfiniteCanvasMinimapWorldPoint,
  useInfiniteCanvasActions,
  useInfiniteCanvasState,
} from "@infinite-canvas/react";

/**
 * A world overview, drawn from `getInfiniteCanvasMinimapLayout`.
 *
 * The framework hands over the projection and nothing else — no rounded corners, no colours,
 * no opinion about where the box sits. That is the same bargain `data-slot` strikes: the part
 * a consumer cannot easily get right is given, and the part they will want to own is left
 * alone. Everything below the `layout` call is this playground's taste.
 *
 * Click to fly there. `getInfiniteCanvasMinimapWorldPoint` is the exact inverse of the
 * projection, which is why the camera lands under the cursor rather than near it — re-deriving
 * the inverse by hand is how a minimap ends up half a window off at the edges.
 */
const MINIMAP_SIZE = { height: 132, width: 200 } as const;

export function CanvasMinimap() {
  // The overview must follow the camera, so it subscribes to everything. That is correct for
  // an overlay and wrong for a window body: an overlay is expected to re-render per frame.
  const state = useInfiniteCanvasState();
  const actions = useInfiniteCanvasActions();
  const layout = getInfiniteCanvasMinimapLayout(state, MINIMAP_SIZE);

  if (layout === null) {
    return null;
  }

  return (
    <div
      className="pointer-events-auto absolute top-4 right-4 overflow-hidden rounded-lg border border-border bg-popover/80 backdrop-blur"
      onPointerDown={(event) => {
        const bounds = event.currentTarget.getBoundingClientRect();

        actions.navigateToPoint({
          point: getInfiniteCanvasMinimapWorldPoint(layout, {
            x: event.clientX - bounds.left,
            y: event.clientY - bounds.top,
          }),
        });
      }}
      style={{ cursor: "crosshair", height: MINIMAP_SIZE.height, width: MINIMAP_SIZE.width }}
      title="Click to fly there"
    >
      {/* Shells under their members, as on the canvas itself. */}
      {layout.groups.map((group) => (
        <div
          className="absolute rounded-[1px] border border-sky-400/30 bg-sky-400/5"
          key={group.groupId}
          // Explicit, not `{...group.rect}`: an `InfiniteCanvasRect` carries `x`/`y`, which
          // are not CSS properties and which React would pass straight through to the DOM.
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
            // A window a third of a pixel tall is invisible. At 160 windows zoomed out, most
            // of them are: the map exists to show you they are there.
            width: Math.max(window.rect.width, 1.5),
          }}
        />
      ))}

      {/* Drawn last: where you are is the thing you are looking for. */}
      <div
        className="pointer-events-none absolute border border-emerald-300/80 bg-emerald-300/5"
        style={{
          height: layout.viewport.height,
          left: layout.viewport.x,
          top: layout.viewport.y,
          width: layout.viewport.width,
        }}
      />
    </div>
  );
}
