"use client";

import { batch, observable, observe, type Observable } from "@legendapp/state";
import { useSelector, useValue } from "@legendapp/state/react";
import { createContext, useContext, useEffect, useRef, type ReactNode } from "react";

import { resolveInfiniteCanvasZoomPolicy } from "#/experiments/infinite-canvas/constants";
import {
  getInfiniteCanvasScopedStorageKey,
  parseInfiniteCanvasStateJson,
  stringifyInfiniteCanvasState,
} from "#/experiments/infinite-canvas/persistence";
import { reduceInfiniteCanvasState } from "#/experiments/infinite-canvas/reducer";
import { cloneInfiniteCanvasState } from "#/experiments/infinite-canvas/state";
import type {
  InfiniteCanvasAction,
  InfiniteCanvasCamera,
  InfiniteCanvasCommand,
  InfiniteCanvasCommands,
  InfiniteCanvasInteraction,
  InfiniteCanvasSelection,
  InfiniteCanvasSnapPolicy,
  InfiniteCanvasState,
  InfiniteCanvasViewport,
  InfiniteCanvasWindow,
  InfiniteCanvasZoomPolicyInput,
} from "#/experiments/infinite-canvas/types";

type InfiniteCanvasStore<Kind extends string = string> = Readonly<{
  commands: InfiniteCanvasCommands<Kind>;
  dispatch: (action: InfiniteCanvasAction<Kind>) => void;
  initialState: InfiniteCanvasState<Kind>;
  state$: Observable<InfiniteCanvasState<Kind>>;
}>;

type InfiniteCanvasStoreOptions<Kind extends string> = Readonly<{
  onReset?: (state: InfiniteCanvasState<Kind>) => void;
  snapPolicy?: InfiniteCanvasSnapPolicy;
  zoomPolicy?: InfiniteCanvasZoomPolicyInput;
}>;

type InfiniteCanvasStateValidator<Kind extends string> = (
  state: InfiniteCanvasState<Kind>,
) => InfiniteCanvasState<Kind> | null;

type InfiniteCanvasWritableObservable<Kind extends string> = Observable<InfiniteCanvasState<Kind>> &
  Readonly<{
    activeWindowId: Readonly<{
      set: (value: string | null) => void;
    }>;
    camera: Readonly<{
      set: (value: InfiniteCanvasCamera) => void;
    }>;
    interaction: Readonly<{
      set: (value: InfiniteCanvasInteraction) => void;
    }>;
    selection: Readonly<{
      set: (value: InfiniteCanvasSelection) => void;
    }>;
    snapPreview: Readonly<{
      set: (value: InfiniteCanvasState<Kind>["snapPreview"]) => void;
    }>;
    viewport: Readonly<{
      set: (value: InfiniteCanvasViewport) => void;
    }>;
    windows: Readonly<{
      set: (value: readonly InfiniteCanvasWindow<Kind>[]) => void;
    }>;
  }>;

const InfiniteCanvasStoreContext = createContext<InfiniteCanvasStore | null>(null);

function commitInfiniteCanvasState<Kind extends string>(
  state$: Observable<InfiniteCanvasState<Kind>>,
  nextState: InfiniteCanvasState<Kind>,
) {
  const writableState$ = state$ as unknown as InfiniteCanvasWritableObservable<Kind>;
  const currentState = writableState$.peek() as InfiniteCanvasState<Kind>;

  batch(() => {
    if (currentState.activeWindowId !== nextState.activeWindowId) {
      writableState$.activeWindowId.set(nextState.activeWindowId);
    }

    if (currentState.camera !== nextState.camera) {
      writableState$.camera.set(nextState.camera);
    }

    if (currentState.interaction !== nextState.interaction) {
      writableState$.interaction.set(nextState.interaction);
    }

    if (currentState.selection !== nextState.selection) {
      writableState$.selection.set(nextState.selection);
    }

    if (currentState.snapPreview !== nextState.snapPreview) {
      writableState$.snapPreview.set(nextState.snapPreview);
    }

    if (currentState.viewport !== nextState.viewport) {
      writableState$.viewport.set(nextState.viewport);
    }

    if (currentState.windows !== nextState.windows) {
      writableState$.windows.set(nextState.windows);
    }
  });
}

function createInfiniteCanvasStore<Kind extends string>(
  initialState: InfiniteCanvasState<Kind>,
  options: InfiniteCanvasStoreOptions<Kind> = {},
): InfiniteCanvasStore<Kind> {
  const baselineState = cloneInfiniteCanvasState(initialState);
  const zoomPolicy = resolveInfiniteCanvasZoomPolicy(options.zoomPolicy);
  const state$ = observable<InfiniteCanvasState<Kind>>(cloneInfiniteCanvasState(baselineState));
  const dispatch = (action: InfiniteCanvasAction<Kind>) => {
    const currentState = state$.peek() as InfiniteCanvasState<Kind>;
    const nextState = reduceInfiniteCanvasState(currentState, action, {
      zoomPolicy,
    });

    if (nextState !== currentState) {
      commitInfiniteCanvasState(state$, nextState);
    }
  };
  const commands: InfiniteCanvasCommands<Kind> = {
    closeWindow: (windowId) => {
      dispatch({
        type: "window.close",
        windowId,
      });
    },
    dispatch,
    executeCommand: (command: InfiniteCanvasCommand) => {
      dispatch({
        command,
        type: "command.execute",
      });
    },
    finishInteraction: (pointerId) => {
      dispatch({
        pointerId,
        type: "interaction.finish",
      });
    },
    fitAllVisibleWindows: () => {
      dispatch({
        command: {
          type: "view.fitAll",
        },
        type: "command.execute",
      });
    },
    fitSelection: () => {
      dispatch({
        command: {
          type: "view.fitSelection",
        },
        type: "command.execute",
      });
    },
    focusWindow: (windowId) => {
      dispatch({
        type: "window.focus",
        windowId,
      });
    },
    hydrate: (state) => {
      dispatch({
        state,
        type: "desktop.hydrate",
      });
    },
    maximizeWindow: (windowId) => {
      dispatch({
        type: "window.maximize",
        windowId,
      });
    },
    minimizeWindow: (windowId) => {
      dispatch({
        type: "window.minimize",
        windowId,
      });
    },
    navigateToWindow: ({ behavior, windowId }) => {
      dispatch({
        request: {
          behavior,
          target: {
            type: "window",
            windowId,
          },
        },
        type: "camera.navigate",
      });
    },
    navigateView: (request) => {
      dispatch({
        request,
        type: "camera.navigate",
      });
    },
    navigateToPoint: ({ behavior, point }) => {
      dispatch({
        request: {
          behavior,
          target: {
            point,
            type: "point",
          },
        },
        type: "camera.navigate",
      });
    },
    navigateToRect: ({ behavior, rect }) => {
      dispatch({
        request: {
          behavior,
          target: {
            rect,
            type: "rect",
          },
        },
        type: "camera.navigate",
      });
    },
    openWindow: (window) => {
      dispatch({
        type: "window.open",
        window,
      });
    },
    panBy: ({ delta }) => {
      dispatch({
        delta,
        type: "camera.panBy",
      });
    },
    reset: () => {
      dispatch({
        state: baselineState,
        type: "desktop.reset",
      });
      options.onReset?.(state$.peek() as InfiniteCanvasState<Kind>);
    },
    restoreWindow: (windowId) => {
      dispatch({
        type: "window.restore",
        windowId,
      });
    },
    selectAllVisibleWindows: () => {
      dispatch({
        type: "selection.selectAllVisible",
      });
    },
    selectTarget: (target) => {
      dispatch({
        targets: [target],
        type: "selection.targets.replace",
      });
    },
    selectWindow: (windowId) => {
      dispatch({
        type: "selection.replace",
        windowIds: [windowId],
      });
    },
    setTargetSelection: (targets) => {
      dispatch({
        targets,
        type: "selection.targets.replace",
      });
    },
    setSelection: (windowIds) => {
      dispatch({
        type: "selection.replace",
        windowIds,
      });
    },
    setViewport: (viewport) => {
      dispatch({
        type: "viewport.set",
        viewport,
      });
    },
    startMarquee: ({ mode, pointerId, point }) => {
      dispatch({
        mode,
        pointerId,
        point,
        type: "interaction.startMarquee",
      });
    },
    startMove: ({ pointerId, point, windowId }) => {
      dispatch({
        pointerId,
        point,
        type: "interaction.startMove",
        windowId,
      });
    },
    startPan: ({ clearSelection, pointerId, point }) => {
      dispatch({
        clearSelection,
        pointerId,
        point,
        type: "interaction.startPan",
      });
    },
    startResize: ({ handle, pointerId, point, windowId }) => {
      dispatch({
        handle,
        pointerId,
        point,
        type: "interaction.startResize",
        windowId,
      });
    },
    stepInteraction: ({ pointerId, point }) => {
      dispatch({
        pointerId,
        point,
        snapPolicy: options.snapPolicy,
        type: "interaction.step",
      });
    },
    toggleWindowSelection: (windowId) => {
      dispatch({
        type: "selection.toggle",
        windowIds: [windowId],
      });
    },
    toggleTargetSelection: (target) => {
      dispatch({
        targets: [target],
        type: "selection.targets.toggle",
      });
    },
    togglePinned: (windowId) => {
      dispatch({
        type: "window.togglePinned",
        windowId,
      });
    },
    zoomAt: ({ anchor, zoom }) => {
      dispatch({
        anchor,
        type: "camera.zoomAt",
        zoom,
      });
    },
  };

  return {
    commands,
    dispatch,
    initialState: baselineState,
    state$,
  };
}

function InfiniteCanvasProvider<Kind extends string>({
  children,
  documentKey,
  initialState,
  snapPolicy,
  stateValidator,
  storageKey,
  zoomPolicy,
}: Readonly<{
  children: ReactNode;
  documentKey?: string;
  initialState: InfiniteCanvasState<Kind>;
  snapPolicy?: InfiniteCanvasSnapPolicy;
  stateValidator?: InfiniteCanvasStateValidator<Kind>;
  storageKey?: string;
  zoomPolicy?: InfiniteCanvasZoomPolicyInput;
}>) {
  const storeRef = useRef<InfiniteCanvasStore<Kind> | null>(null);
  const persistTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const scopedStorageKey = getInfiniteCanvasScopedStorageKey({
    documentKey,
    storageKey,
  });

  if (storeRef.current === null) {
    storeRef.current = createInfiniteCanvasStore(initialState, {
      onReset:
        scopedStorageKey === undefined
          ? undefined
          : (state) => {
              if (typeof window !== "undefined") {
                if (persistTimeoutRef.current !== null) {
                  clearTimeout(persistTimeoutRef.current);
                  persistTimeoutRef.current = null;
                }

                window.localStorage.setItem(scopedStorageKey, stringifyInfiniteCanvasState(state));
              }
            },
      snapPolicy,
      zoomPolicy,
    });
  }

  useEffect(() => {
    const store = storeRef.current;

    if (store === null || scopedStorageKey === undefined || typeof window === "undefined") {
      return;
    }

    const hydratedState = parseInfiniteCanvasStateJson(
      window.localStorage.getItem(scopedStorageKey) ?? "",
      store.initialState,
    );

    const validatedHydratedState =
      hydratedState === null ? null : (stateValidator?.(hydratedState) ?? hydratedState);

    if (validatedHydratedState !== null) {
      store.commands.hydrate(validatedHydratedState);
    }

    const observer = observe(() => {
      const state = store.state$.get() as InfiniteCanvasState<Kind>;

      if (state.interaction !== null) {
        return;
      }

      if (persistTimeoutRef.current !== null) {
        clearTimeout(persistTimeoutRef.current);
      }

      persistTimeoutRef.current = setTimeout(() => {
        window.localStorage.setItem(scopedStorageKey, stringifyInfiniteCanvasState(state));
        persistTimeoutRef.current = null;
      }, 120);
    });

    return () => {
      if (persistTimeoutRef.current !== null) {
        clearTimeout(persistTimeoutRef.current);
        persistTimeoutRef.current = null;
      }

      observer?.();
    };
  }, [scopedStorageKey, stateValidator]);

  return (
    <InfiniteCanvasStoreContext.Provider value={storeRef.current as unknown as InfiniteCanvasStore}>
      {children}
    </InfiniteCanvasStoreContext.Provider>
  );
}

function useInfiniteCanvasStore<Kind extends string = string>() {
  const store = useContext(InfiniteCanvasStoreContext);

  if (store === null) {
    throw new Error("InfiniteCanvas components must be rendered inside InfiniteCanvasProvider.");
  }

  return store as unknown as InfiniteCanvasStore<Kind>;
}

function useInfiniteCanvasState$<Kind extends string = string>() {
  return useInfiniteCanvasStore<Kind>().state$;
}

function useInfiniteCanvasState<Kind extends string = string>() {
  return useValue(useInfiniteCanvasState$<Kind>());
}

function useInfiniteCanvasActions<Kind extends string = string>() {
  return useInfiniteCanvasStore<Kind>().commands;
}

function useInfiniteCanvasSelector<Kind extends string, Value>(
  selector: (state: InfiniteCanvasState<Kind>) => Value,
) {
  const state$ = useInfiniteCanvasState$<Kind>();

  return useSelector(() => selector(state$.get() as InfiniteCanvasState<Kind>));
}

export {
  InfiniteCanvasProvider,
  commitInfiniteCanvasState,
  createInfiniteCanvasStore,
  useInfiniteCanvasActions,
  useInfiniteCanvasSelector,
  useInfiniteCanvasState,
  useInfiniteCanvasState$,
  useInfiniteCanvasStore,
};

export type { InfiniteCanvasStateValidator, InfiniteCanvasStore };
