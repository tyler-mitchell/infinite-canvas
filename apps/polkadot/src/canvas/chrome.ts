import { resolveInfiniteCanvasChromeMetrics } from "@hyphened/infinite-canvas";

/**
 * The window frame's own measurements, shared by the viewport that draws them and anything that
 * has to answer where a pointer landed.
 *
 * Resolved once through the framework's own merge rather than kept as a partial in one place and a
 * default in the other. `resolveInfiniteCanvasSpatialTarget` reads these to decide whether a point
 * is on a header, a body, or a resize handle, so metrics that drifted from what the viewport
 * renders would put the hit areas somewhere other than the chrome you can see.
 *
 * A note names itself in its body, so its header carries only controls and does not need 40px.
 */
const CANVAS_CHROME = resolveInfiniteCanvasChromeMetrics({ headerHeight: 32 });

export { CANVAS_CHROME };
