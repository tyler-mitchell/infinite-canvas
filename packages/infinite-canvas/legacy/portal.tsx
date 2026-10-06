"use client";

import { createContext, useContext, type ReactNode } from "react";
import { createPortal } from "react-dom";

/** Provides portal roots outside each window transform. */
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

/** Returns the viewport portal root after mount. */
function useInfiniteCanvasDesktopPortalRoot(): HTMLElement | null {
  return useContext(InfiniteCanvasDesktopPortalContext);
}

/** Returns the current window portal root, or null when it is not available. */
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

/** Renders children in the selected root. Returns null until the root exists. */
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
