"use client";

import { observable, type Observable } from "@legendapp/state";
import { useValue } from "@legendapp/state/react";
import { createContext, useContext, useEffect, useMemo, type ReactNode } from "react";

import { isWorldRectWithinViewport } from "./geometry";
import { useInfiniteCanvasStore } from "./store";
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
function getFramedWindows(state: InfiniteCanvasState): InfiniteCanvasVisibilityState {
  return Object.fromEntries(
    state.windows
      .filter((window) => window.mode !== "minimized")
      .map((window) => [
        window.id,
        isWorldRectWithinViewport(state.camera, state.viewport, window.rect, 0),
      ]),
  );
}

function InfiniteCanvasVisibilityProvider({ children }: Readonly<{ children: ReactNode }>) {
  const visibility$ = useMemo(() => observable<InfiniteCanvasVisibilityState>({}), []);

  return (
    <InfiniteCanvasVisibilityContext.Provider value={visibility$}>
      {children}
    </InfiniteCanvasVisibilityContext.Provider>
  );
}

/** Records which windows the viewport frames, on every store change. */
function InfiniteCanvasWindowFrustumProbe() {
  const store = useInfiniteCanvasStore();
  const visibility$ = useContext(InfiniteCanvasVisibilityContext);

  useEffect(() => {
    // One whole-record write drops closed windows, and Legend-State compares
    // deeply, so only a window whose framing changed notifies its readers.
    const probe = () => {
      visibility$.set(getFramedWindows(store.state$.peek() as InfiniteCanvasState));
    };

    probe();

    return store.state$.onChange(probe);
  }, [store, visibility$]);

  return null;
}

/** @experimental Uses a fallback when no frustum probe measures this window. */
function useInfiniteCanvasWindowFramed(windowId: string, fallback = true) {
  const visibility$ = useContext(InfiniteCanvasVisibilityContext);

  return useValue(() => visibility$[windowId].get() ?? fallback);
}

/** @experimental Returns aggregate frustum counts from the probe store. */
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
  InfiniteCanvasWindowFrustumProbe,
  getFramedWindows,
  useInfiniteCanvasVisibilitySummary,
  useInfiniteCanvasWindowFramed,
};

export type { InfiniteCanvasVisibilityState, InfiniteCanvasVisibilitySummary };
