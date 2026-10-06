"use client";

import { observable, type Observable } from "@legendapp/state";
import { useValue } from "@legendapp/state/react";
import { createContext, useContext, useMemo, type ReactNode } from "react";

import { isWorldRectWithinViewport } from "./geometry";
import { getCanvasLayout } from "./layout";
import { useInfiniteCanvasStore } from "./react/store";
import type { InfiniteCanvasState } from "./types";

/** Whether the viewport frames each tracked window. */
type InfiniteCanvasVisibilityState = Readonly<Record<string, boolean>>;

type InfiniteCanvasVisibilitySummary = Readonly<{
  hidden: number;
  tracked: number;
  visible: number;
}>;

/** Stays empty without a provider, so every reading falls back. */
const disabledVisibility$ = observable<InfiniteCanvasVisibilityState>({});

const InfiniteCanvasVisibilityContext =
  createContext<Observable<InfiniteCanvasVisibilityState>>(disabledVisibility$);

/** Which windows the viewport frames right now. */
function getFramedWindows(
  state: InfiniteCanvasState,
  canvasLayout = getCanvasLayout(state),
): InfiniteCanvasVisibilityState {
  return Object.fromEntries(
    state.windows
      .filter((window) => canvasLayout.visibleWindowIds.has(window.id))
      .map((window) => [
        window.id,
        isWorldRectWithinViewport(
          state.camera,
          state.viewport,
          canvasLayout.windowRects.get(window.id)!,
          0,
        ),
      ]),
  );
}

function InfiniteCanvasVisibilityProvider({ children }: Readonly<{ children: ReactNode }>) {
  const store = useInfiniteCanvasStore();
  const visibility$ = useMemo(
    () =>
      observable(() =>
        getFramedWindows(
          {
            ...store.state$.peek(),
            camera: store.state$.camera.get(),
            viewport: store.state$.viewport.get(),
          },
          store.layout$.get(),
        ),
      ),
    [store],
  );

  return (
    <InfiniteCanvasVisibilityContext.Provider value={visibility$}>
      {children}
    </InfiniteCanvasVisibilityContext.Provider>
  );
}

/** Uses a fallback when visibility tracking is disabled. */
function useInfiniteCanvasWindowFramed(windowId: string, fallback = true) {
  const visibility$ = useContext(InfiniteCanvasVisibilityContext);

  return useValue(() => visibility$[windowId].get() ?? fallback);
}

/** Returns the current window visibility counts. */
function useInfiniteCanvasVisibilitySummary(): InfiniteCanvasVisibilitySummary {
  const visibility$ = useContext(InfiniteCanvasVisibilityContext);

  return useValue(() => {
    const framed = Object.values(visibility$.get());
    const visible = framed.filter(Boolean).length;

    return { hidden: framed.length - visible, tracked: framed.length, visible };
  });
}

export {
  InfiniteCanvasVisibilityProvider,
  getFramedWindows,
  useInfiniteCanvasVisibilitySummary,
  useInfiniteCanvasWindowFramed,
};

export type { InfiniteCanvasVisibilityState, InfiniteCanvasVisibilitySummary };
