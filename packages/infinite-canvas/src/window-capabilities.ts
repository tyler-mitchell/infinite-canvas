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
 * **Per-kind defaults are deliberately absent**, and the reason is structural rather than a
 * missing feature. Every per-kind field on `InfiniteCanvasWindowDefinition` — `frameChrome`,
 * `wheelBehavior`, `bodyPointerBehavior`, `overflowY` — is consulted at render time by the
 * frame. Capabilities cannot follow that pattern, because they are enforced in the reducer,
 * which is pure and has no access to a registry that lives in the React layer. Declaring
 * them per kind would mean either threading definitions into the pure core, which
 * `verify-pure-core.mjs` exists to prevent, or a merge-at-creation path that does not exist.
 * A consumer who wants "every console is fixed-size" passes the same `capabilities` object
 * at each creation site; if that repetition ever becomes a real complaint, the resolution
 * belongs here, merging definition defaults under instance overrides.
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
