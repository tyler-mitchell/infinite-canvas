import type { InfiniteCanvasWindow, InfiniteCanvasWindowCapability } from "./types";

/**
 * What a window permits, in one place.
 *
 * The rule this module exists to own is **absent means permitted**. It is read from four
 * directions — the reducer, which enforces it; the command layer, which decides what to
 * offer; the chrome, which disables what is withheld; and a consumer replacing that chrome,
 * who needs the same answer. A `=== true` comparison in any one of them would silently
 * forbid every window that never opted in, so none of them re-derive it.
 *
 * Public for the fourth reader specifically. Replacing the `Controls` slot is a supported
 * thing to do, and a consumer who did it while hand-writing
 * `window.capabilities?.closable !== false` would be duplicating this default rather than
 * consulting it — and would be wrong the day it changes.
 */
function isInfiniteCanvasWindowCapable(
  window: InfiniteCanvasWindow<string> | null,
  capability: InfiniteCanvasWindowCapability,
): boolean {
  return window !== null && window.capabilities?.[capability] !== false;
}

export { isInfiniteCanvasWindowCapable };
