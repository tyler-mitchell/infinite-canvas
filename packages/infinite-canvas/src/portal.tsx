"use client";

import { createContext, useContext, type ReactNode } from "react";
import { createPortal } from "react-dom";

/**
 * Portal roots for content that must escape a window's transformed subtree.
 *
 * A window frame is `transform: translate(...) scale(zoom)`. That makes it a
 * containing block for `position: fixed`, so a popover, menu, tooltip, or select
 * rendered inside a window body — anything that positions itself against the
 * viewport, which is every floating-UI library there is — resolves against the
 * frame instead. It lands in the wrong place, and it lands *scaled*, because the
 * zoom applies to it too. This is the sharpest trap in the way of running a real
 * application inside a window (docs/research/body-content-contract.md).
 *
 * Two roots, both outside every transform:
 *
 * - **desktop** — the viewport-level root. Overlays that should escape the window
 *   entirely mount here: command palettes, modals, drag ghosts.
 * - **window** — a root positioned and sized to one window's *screen* rect, and
 *   moved as the camera does. Content mounted here tracks its window but is never
 *   scaled by zoom, so a popover anchored to a button inside the body appears
 *   beside that button at its natural size.
 *
 * The window root is opt-in per window kind (`portalRoot: true` on the window
 * definition). Mounting one for every window would cost a style write per window
 * per camera tick, which is precisely the cost the frame's memoization exists to
 * avoid. Windows that never open a popover pay nothing.
 */

type InfiniteCanvasPortalScope = "desktop" | "window";

type InfiniteCanvasPortalContextValue = Readonly<{
  desktop: HTMLElement | null;
  window: HTMLElement | null;
}>;

const EMPTY_INFINITE_CANVAS_PORTAL_CONTEXT: InfiniteCanvasPortalContextValue = {
  desktop: null,
  window: null,
};

const InfiniteCanvasDesktopPortalContext = createContext<HTMLElement | null>(null);
const InfiniteCanvasWindowPortalContext = createContext<HTMLElement | null>(null);

/** The viewport-level root. `null` before the viewport has mounted. */
function useInfiniteCanvasDesktopPortalRoot(): HTMLElement | null {
  return useContext(InfiniteCanvasDesktopPortalContext);
}

/**
 * The root tracking the window this hook is called from, or `null` — outside a
 * window, or inside one whose definition did not ask for `portalRoot: true`.
 */
function useInfiniteCanvasWindowPortalRoot(): HTMLElement | null {
  return useContext(InfiniteCanvasWindowPortalContext);
}

function useInfiniteCanvasPortalRoots(): InfiniteCanvasPortalContextValue {
  const desktop = useInfiniteCanvasDesktopPortalRoot();
  const window = useInfiniteCanvasWindowPortalRoot();

  return desktop === null && window === null
    ? EMPTY_INFINITE_CANVAS_PORTAL_CONTEXT
    : { desktop, window };
}

/**
 * Render children outside the window's transform.
 *
 * Renders nothing until the requested root exists, rather than falling back to
 * the transformed subtree. A popover that quietly appears in the wrong place,
 * scaled to the zoom level, is worse than one that appears a frame late — the
 * first is a bug the consumer will chase into their own code.
 */
function InfiniteCanvasPortal({
  children,
  scope = "desktop",
}: Readonly<{
  children: ReactNode;
  scope?: InfiniteCanvasPortalScope;
}>) {
  const roots = useInfiniteCanvasPortalRoots();
  const root = scope === "window" ? roots.window : roots.desktop;

  return root === null ? null : createPortal(children, root);
}

export {
  InfiniteCanvasDesktopPortalContext,
  InfiniteCanvasPortal,
  InfiniteCanvasWindowPortalContext,
  useInfiniteCanvasDesktopPortalRoot,
  useInfiniteCanvasPortalRoots,
  useInfiniteCanvasWindowPortalRoot,
};
export type { InfiniteCanvasPortalScope };
