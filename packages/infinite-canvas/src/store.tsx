"use client";

import { batch, observable, observe, type Observable } from "@legendapp/state";
import { useSelector, useValue } from "@legendapp/state/react";
import { createContext, useContext, useEffect, useRef, type ReactNode } from "react";

import { resolveInfiniteCanvasZoomPolicy } from "./constants";
import {
  getInfiniteCanvasScopedStorageKey,
  parseInfiniteCanvasStateJson,
  stringifyInfiniteCanvasState,
} from "./persistence";
import { reduceInfiniteCanvasState } from "./reducer";
import { cloneInfiniteCanvasState } from "./state";
import type {
  InfiniteCanvasAction,
  InfiniteCanvasGroup,
  InfiniteCanvasHistory,
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
} from "./types";

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
    groups: Readonly<{
      set: (value: readonly InfiniteCanvasGroup[]) => void;
    }>;
    history: Readonly<{
      set: (value: InfiniteCanvasHistory<Kind>) => void;
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
    for (const field of Object.keys(nextState) as readonly (keyof InfiniteCanvasState<Kind>)[]) {
      if (currentState[field] !== nextState[field]) {
        // The per-field observable is typed for its own field; the loop is generic over all of
        // them, so this is the one place a cast is unavoidable. The reference comparison above
        // is what keeps the write set minimal, which is the reason this writes fields at all
        // rather than replacing the root: a `set` on the root would invalidate every observer
        // on every action.
        (writableState$[field] as { set: (value: unknown) => void }).set(nextState[field]);
      }
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
    closeGroup: (groupId) => {
      dispatch({
        groupId,
        type: "group.close",
      });
    },
    createGroup: (input) => {
      dispatch({
        ...input,
        type: "group.create",
      });
    },
    dockWindow: (input) => {
      dispatch({
        ...input,
        type: "group.dockWindow",
      });
    },
    focusWindow: (windowId) => {
      dispatch({
        type: "window.focus",
        windowId,
      });
    },
    applyRecipe: (input) => {
      dispatch({
        ...input,
        type: "recipe.apply",
      });
    },
    redo: () => {
      dispatch({
        command: { type: "history.redo" },
        type: "command.execute",
      });
    },
    reorderGroupChild: (input) => {
      dispatch({
        ...input,
        type: "group.reorderChild",
      });
    },
    setGroupActiveChild: (input) => {
      dispatch({
        ...input,
        type: "group.setActiveChild",
      });
    },
    setGroupChildWeights: (input) => {
      dispatch({
        ...input,
        type: "group.setChildWeights",
      });
    },
    setWindowTitle: (input) => {
      dispatch({
        ...input,
        type: "window.setTitle",
      });
    },
    setGroupTitle: (input) => {
      dispatch({
        ...input,
        type: "group.setTitle",
      });
    },
    addWindowToWorkspace: (input) => {
      dispatch({
        ...input,
        type: "workspace.addWindow",
      });
    },
    removeWindowFromWorkspace: (input) => {
      dispatch({
        ...input,
        type: "workspace.removeWindow",
      });
    },
    setWorkspaceTitle: (input) => {
      dispatch({
        ...input,
        type: "workspace.setTitle",
      });
    },
    setGroupAxis: (input) => {
      dispatch({
        ...input,
        type: "group.setAxis",
      });
    },
    setGroupLayoutMode: (input) => {
      dispatch({
        ...input,
        type: "group.setLayoutMode",
      });
    },
    setGroupRect: (input) => {
      dispatch({
        ...input,
        type: "group.setRect",
      });
    },
    startGroupGutterDrag: (input) => {
      dispatch({
        ...input,
        type: "interaction.startGroupGutter",
      });
    },
    startGroupResize: (input) => {
      dispatch({
        ...input,
        type: "interaction.startGroupResize",
      });
    },
    undo: () => {
      dispatch({
        command: { type: "history.undo" },
        type: "command.execute",
      });
    },
    undockWindow: (input) => {
      dispatch({
        ...input,
        type: "group.undockWindow",
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
    stepInteraction: ({ dockIntent, pointerId, point }) => {
      dispatch({
        dockIntent,
        pointerId,
        point,
        // Alignment guides and a dock region are contradictory affordances; the
        // reducer drops the snap policy while docking intent is held.
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

/**
 * Either state to build a store from, or a store built already — never both.
 *
 * `createInfiniteCanvasStore` and `createInfiniteCanvasHandle` were public exports that no
 * consumer could reach until 2026-08-12: the provider minted its own store internally and
 * took no `store` prop, and the handle's only argument source was `useInfiniteCanvasStore`
 * from *inside* the tree. So the handle's stated audience — "agents, E2E drivers, and
 * command palettes", all of them parent-side — could not obtain one, and a parent that
 * owned the canvas could not read it, subscribe to it, or drive it.
 *
 * Injecting the store is the whole fix, and it needs no second prop: a parent that built
 * the store can call `createInfiniteCanvasHandle(store)` on it directly.
 *
 * `store?: never` on one branch and `initialState?: never` on the other make supplying both
 * a compile error rather than a runtime precedence puzzle.
 */
type InfiniteCanvasProviderProps<Kind extends string> = Readonly<{
  children: ReactNode;
  documentKey?: string;
  snapPolicy?: InfiniteCanvasSnapPolicy;
  stateValidator?: InfiniteCanvasStateValidator<Kind>;
  /**
   * Persistence follows this key, not store ownership: an injected store with a
   * `storageKey` is hydrated and persisted like any other, because wanting parent access to
   * the store is orthogonal to wanting the framework to persist it. One difference is worth
   * knowing — `onReset` can only be wired when a store is constructed, so a reset on an
   * injected store is written by the ordinary 120ms debounce rather than flushed
   * immediately. Pass `onReset` to `createInfiniteCanvasStore` yourself to restore that.
   */
  storageKey?: string;
  zoomPolicy?: InfiniteCanvasZoomPolicyInput;
}> &
  (
    | Readonly<{ initialState: InfiniteCanvasState<Kind>; store?: never }>
    | Readonly<{ initialState?: never; store: InfiniteCanvasStore<Kind> }>
  );

function InfiniteCanvasProvider<Kind extends string>(props: InfiniteCanvasProviderProps<Kind>) {
  const { children, documentKey, snapPolicy, stateValidator, storageKey, zoomPolicy } = props;
  const storeRef = useRef<InfiniteCanvasStore<Kind> | null>(null);
  const persistTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const scopedStorageKey = getInfiniteCanvasScopedStorageKey({
    documentKey,
    storageKey,
  });

  if (storeRef.current === null) {
    // An injected store is adopted as-is. Only a store this provider constructs can carry
    // `onReset`, which is the flush that writes a reset immediately instead of waiting out
    // the debounce below.
    storeRef.current =
      props.store === undefined
        ? createInfiniteCanvasStore(props.initialState, {
            onReset:
              scopedStorageKey === undefined
                ? undefined
                : (state) => {
                    if (typeof window !== "undefined") {
                      if (persistTimeoutRef.current !== null) {
                        clearTimeout(persistTimeoutRef.current);
                        persistTimeoutRef.current = null;
                      }

                      window.localStorage.setItem(
                        scopedStorageKey,
                        stringifyInfiniteCanvasState(state),
                      );
                    }
                  },
            snapPolicy,
            zoomPolicy,
          })
        : props.store;
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
