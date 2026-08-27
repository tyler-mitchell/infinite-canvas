import type { InfiniteCanvasGroupLayoutMode } from "@hyphened/infinite-canvas";

/**
 * The three shapes a container can take, as values rather than as a type.
 *
 * **This is a framework ask, written down where it is paid.** `@hyphened/infinite-canvas` exports
 * `InfiniteCanvasGroupLayoutMode` and keeps the runtime list that inhabits it private — it holds
 * `INFINITE_CANVAS_GROUP_LAYOUT_MODES` in `validation.ts` with exactly one internal reference. So a
 * consumer that wants to enumerate the modes, offer them, or validate one against a schema has to
 * re-type them, and every consumer re-types the same three. Exporting that const is the generic fix
 * and is not written here: the framework is the other session's, and it has changes in flight to
 * `docs/API.md`, which the public-API gate would make part of the same edit.
 *
 * Ordered as they escalate: apart, stacked, one at a time. That order is shared by everything that
 * offers all three, so a container's states read the same way on a rail as they do round a wheel.
 *
 * The annotation is what makes this safe to keep: if the framework's union ever gains or loses a
 * mode, this stops compiling rather than silently offering a mode nothing implements.
 */
export const GROUP_LAYOUT_MODES = [
  "split",
  "accordion",
  "tabs",
] as const satisfies readonly InfiniteCanvasGroupLayoutMode[];
