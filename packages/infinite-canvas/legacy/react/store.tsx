"use client";

import { useValue } from "@legendapp/state/react";
import { createContext, useContext, useLayoutEffect, useState, type ReactNode } from "react";

import { createInfiniteCanvasStore } from "../store";
import type { InfiniteCanvasStore, InfiniteCanvasStoreOptions } from "../store";
import type { InfiniteCanvasState } from "../types";

const InfiniteCanvasStoreContext = createContext<InfiniteCanvasStore | null>(null);
type InfiniteCanvasProviderProps<Kind extends string> = Readonly<{ children: ReactNode }> &
  (InfiniteCanvasStoreOptions<Kind> | Readonly<{ store: InfiniteCanvasStore<Kind> }>);
function InfiniteCanvasProvider<Kind extends string>(props: InfiniteCanvasProviderProps<Kind>) {
  const [initialStore] = useState(() =>
    "store" in props ? props.store : createInfiniteCanvasStore<Kind>(props),
  );
  const store = "store" in props ? props.store : initialStore;
  const windowDefinitions = "store" in props ? undefined : props.windowDefinitions;
  useLayoutEffect(() => {
    if (windowDefinitions !== undefined) store.windowDefinitions$.set(windowDefinitions);
  }, [store, windowDefinitions]);
  useLayoutEffect(() => () => store.camera.stop(), [store]);
  return (
    <InfiniteCanvasStoreContext.Provider value={store as unknown as InfiniteCanvasStore}>
      {props.children}
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

/** Returns bounds for all selected windows and consumer targets. */
function useInfiniteCanvasSelectionBounds<Kind extends string = string>() {
  const store = useInfiniteCanvasStore<Kind>();

  return store.getSelectionBounds(useInfiniteCanvasState<Kind>());
}

function useInfiniteCanvasState$<Kind extends string = string>() {
  return useInfiniteCanvasStore<Kind>().state$;
}

function useInfiniteCanvasState<Kind extends string = string>() {
  return useValue(useInfiniteCanvasState$<Kind>());
}

function useInfiniteCanvasDispatch<Kind extends string = string>() {
  return useInfiniteCanvasStore<Kind>().dispatch;
}

function useInfiniteCanvasSelector<Kind extends string, Value>(
  selector: (state: InfiniteCanvasState<Kind>) => Value,
) {
  const state$ = useInfiniteCanvasState$<Kind>();

  return useValue(() => selector(state$.get() as InfiniteCanvasState<Kind>));
}

export {
  InfiniteCanvasProvider,
  useInfiniteCanvasDispatch,
  useInfiniteCanvasSelectionBounds,
  useInfiniteCanvasSelector,
  useInfiniteCanvasState,
  useInfiniteCanvasState$,
  useInfiniteCanvasStore,
};
