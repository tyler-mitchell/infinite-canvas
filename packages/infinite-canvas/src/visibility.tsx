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
  /** Keeps only these tracked window IDs. */
  retainWindows: (windowIds: readonly string[]) => void;
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
  retainWindows: () => {},
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

/** Keeps tracked entries whose IDs exist in the input list. */
function retainWindowFrustumVisibility(
  state: InfiniteCanvasVisibilityState,
  windowIds: readonly string[],
): InfiniteCanvasVisibilityState {
  const retainedIds = new Set(windowIds);
  const trackedIds = Object.keys(state.windows);

  if (trackedIds.every((windowId) => retainedIds.has(windowId))) {
    return state;
  }

  return {
    revision: state.revision + 1,
    windows: Object.fromEntries(
      Object.entries(state.windows).filter(([windowId]) => retainedIds.has(windowId)),
    ),
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
      retainWindows: (windowIds) => {
        updateVisibilityState(state$, (state) => retainWindowFrustumVisibility(state, windowIds));
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

/** @experimental Returns frustum data or null when no probe measures this window. */
function useInfiniteCanvasWindowFrustum(windowId: string) {
  const { state$ } = useInfiniteCanvasVisibilityContext();

  return useSelector(
    () =>
      (state$.windows[windowId] as unknown as InfiniteCanvasWindowFrustumObservable).get() ?? null,
  );
}

/** @experimental Uses a fallback when no frustum probe measures this window. */
function useInfiniteCanvasWindowFramed(windowId: string, fallback = true) {
  const visibility = useInfiniteCanvasWindowFrustum(windowId);

  return visibility?.isFramed ?? fallback;
}

/** @experimental Returns aggregate frustum counts from the probe store. */
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
  retainWindowFrustumVisibility,
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
