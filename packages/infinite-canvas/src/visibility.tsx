"use client";

import { observable, type Observable } from "@legendapp/state";
import { useSelector } from "@legendapp/state/react";
import { createContext, useContext, useMemo, type ReactNode } from "react";

type InfiniteCanvasWindowFrustumVisibility = Readonly<{
  isFramed: boolean;
  updatedAt: number;
}>;

type InfiniteCanvasVisibilityState = Readonly<{
  revision: number;
  windows: Readonly<Record<string, InfiniteCanvasWindowFrustumVisibility>>;
}>;

type InfiniteCanvasVisibilitySummary = Readonly<{
  hidden: number;
  tracked: number;
  visible: number;
}>;

type InfiniteCanvasVisibilityContextValue = Readonly<{
  markWindowsFramed: (entries: readonly InfiniteCanvasWindowFrustumVisibilityEntry[]) => void;
  pruneWindows: (windowIds: readonly string[]) => void;
  state$: Observable<InfiniteCanvasVisibilityState>;
}>;

type InfiniteCanvasVisibilityWritableObservable = Observable<InfiniteCanvasVisibilityState> &
  Readonly<{
    peek: () => InfiniteCanvasVisibilityState;
    set: (state: InfiniteCanvasVisibilityState) => void;
  }>;

type InfiniteCanvasWindowFrustumObservable = Readonly<{
  get: () => InfiniteCanvasWindowFrustumVisibility | undefined;
}>;

type InfiniteCanvasWindowFrustumVisibilityEntry = Readonly<{
  isFramed: boolean;
  windowId: string;
}>;

const createInfiniteCanvasVisibilityState = (): InfiniteCanvasVisibilityState => ({
  revision: 0,
  windows: {},
});

const disabledVisibilityState$ = observable<InfiniteCanvasVisibilityState>(
  createInfiniteCanvasVisibilityState(),
);

const DISABLED_INFINITE_CANVAS_VISIBILITY_CONTEXT: InfiniteCanvasVisibilityContextValue = {
  markWindowsFramed: () => {},
  pruneWindows: () => {},
  state$: disabledVisibilityState$,
};

const InfiniteCanvasVisibilityContext = createContext<InfiniteCanvasVisibilityContextValue>(
  DISABLED_INFINITE_CANVAS_VISIBILITY_CONTEXT,
);

function setWindowFrustumVisibility(
  state: InfiniteCanvasVisibilityState,
  windowId: string,
  isFramed: boolean,
  updatedAt = Date.now(),
): InfiniteCanvasVisibilityState {
  const current = state.windows[windowId];

  if (current?.isFramed === isFramed) {
    return state;
  }

  return {
    revision: state.revision + 1,
    windows: {
      ...state.windows,
      [windowId]: {
        isFramed,
        updatedAt,
      },
    },
  };
}

function setWindowsFrustumVisibility(
  state: InfiniteCanvasVisibilityState,
  entries: readonly InfiniteCanvasWindowFrustumVisibilityEntry[],
  updatedAt = Date.now(),
): InfiniteCanvasVisibilityState {
  const changedEntries = entries.filter(
    (entry) => state.windows[entry.windowId]?.isFramed !== entry.isFramed,
  );

  if (changedEntries.length === 0) {
    return state;
  }

  return {
    revision: state.revision + 1,
    windows: {
      ...state.windows,
      ...Object.fromEntries(
        changedEntries.map((entry) => [
          entry.windowId,
          {
            isFramed: entry.isFramed,
            updatedAt,
          },
        ]),
      ),
    },
  };
}

function pruneWindowFrustumVisibility(
  state: InfiniteCanvasVisibilityState,
  windowIds: readonly string[],
): InfiniteCanvasVisibilityState {
  const nextWindows = Object.fromEntries(
    Object.entries(state.windows).filter(([windowId]) => windowIds.includes(windowId)),
  );

  if (Object.keys(nextWindows).length === Object.keys(state.windows).length) {
    return state;
  }

  return {
    revision: state.revision + 1,
    windows: nextWindows,
  };
}

function getWindowFrustumVisibility(
  state: InfiniteCanvasVisibilityState,
  windowId: string,
): InfiniteCanvasWindowFrustumVisibility | null {
  return state.windows[windowId] ?? null;
}

function isWindowFramed(state: InfiniteCanvasVisibilityState, windowId: string, fallback = true) {
  return getWindowFrustumVisibility(state, windowId)?.isFramed ?? fallback;
}

function getInfiniteCanvasVisibilitySummary(
  state: InfiniteCanvasVisibilityState,
): InfiniteCanvasVisibilitySummary {
  const windows = Object.values(state.windows);
  const visible = windows.filter((window) => window.isFramed).length;

  return {
    hidden: windows.length - visible,
    tracked: windows.length,
    visible,
  };
}

function updateVisibilityState(
  state$: Observable<InfiniteCanvasVisibilityState>,
  updater: (state: InfiniteCanvasVisibilityState) => InfiniteCanvasVisibilityState,
) {
  const writableState$ = state$ as InfiniteCanvasVisibilityWritableObservable;
  const currentState = writableState$.peek() as InfiniteCanvasVisibilityState;
  const nextState = updater(currentState);

  if (nextState !== currentState) {
    writableState$.set(nextState);
  }
}

function InfiniteCanvasVisibilityProvider({ children }: Readonly<{ children: ReactNode }>) {
  const state$ = useMemo(
    () => observable<InfiniteCanvasVisibilityState>(createInfiniteCanvasVisibilityState()),
    [],
  );
  const context = useMemo<InfiniteCanvasVisibilityContextValue>(
    () => ({
      markWindowsFramed: (entries) => {
        updateVisibilityState(state$, (state) => setWindowsFrustumVisibility(state, entries));
      },
      pruneWindows: (windowIds) => {
        updateVisibilityState(state$, (state) => pruneWindowFrustumVisibility(state, windowIds));
      },
      state$,
    }),
    [state$],
  );

  return (
    <InfiniteCanvasVisibilityContext.Provider value={context}>
      {children}
    </InfiniteCanvasVisibilityContext.Provider>
  );
}

function useInfiniteCanvasVisibilityContext() {
  return useContext(InfiniteCanvasVisibilityContext);
}

/**
 * Live frustum-visibility for one window, or `null` when nothing is measuring it.
 *
 * @experimental Only the frustum probe layer writes this store, and that layer
 * ships behind `@infinite-canvas/react/scene` and runs only when
 * `diagnostics.frustum` is on. Without both, every window reads as unmeasured —
 * `useInfiniteCanvasWindowFramed` will return its fallback forever, and a
 * culling decision built on it will silently keep everything. Treat a `null`
 * here as "unknown", never as "offscreen".
 */
function useInfiniteCanvasWindowFrustum(windowId: string) {
  const { state$ } = useInfiniteCanvasVisibilityContext();

  return useSelector(
    () =>
      (state$.windows[windowId] as unknown as InfiniteCanvasWindowFrustumObservable).get() ?? null,
  );
}

/**
 * Whether a window is inside the camera frustum, falling back to `fallback` when
 * nothing is measuring it.
 *
 * @experimental See {@link useInfiniteCanvasWindowFrustum}: the probe that feeds
 * this lives behind the `/scene` entry and only runs under `diagnostics.frustum`.
 * The fallback defaults to `true` precisely so that an unmeasured canvas renders
 * everything rather than nothing.
 */
function useInfiniteCanvasWindowFramed(windowId: string, fallback = true) {
  const visibility = useInfiniteCanvasWindowFrustum(windowId);

  return visibility?.isFramed ?? fallback;
}

/**
 * Aggregate frustum-visibility counts across the canvas.
 *
 * @experimental Reads the same probe-fed store as
 * {@link useInfiniteCanvasWindowFrustum}, so it reports zeros unless a scene
 * surface is mounted with `diagnostics.frustum` on.
 */
function useInfiniteCanvasVisibilitySummary() {
  const { state$ } = useInfiniteCanvasVisibilityContext();

  return useSelector(() =>
    getInfiniteCanvasVisibilitySummary(state$.get() as InfiniteCanvasVisibilityState),
  );
}

export {
  InfiniteCanvasVisibilityProvider,
  createInfiniteCanvasVisibilityState,
  getInfiniteCanvasVisibilitySummary,
  getWindowFrustumVisibility,
  isWindowFramed,
  pruneWindowFrustumVisibility,
  setWindowFrustumVisibility,
  setWindowsFrustumVisibility,
  useInfiniteCanvasVisibilityContext,
  useInfiniteCanvasVisibilitySummary,
  useInfiniteCanvasWindowFramed,
  useInfiniteCanvasWindowFrustum,
};

export type {
  InfiniteCanvasVisibilityState,
  InfiniteCanvasVisibilitySummary,
  InfiniteCanvasWindowFrustumVisibilityEntry,
  InfiniteCanvasWindowFrustumVisibility,
};
