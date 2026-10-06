"use client";

import { useSelector } from "@legendapp/state/react";

import { useInfiniteCanvasStore } from "./react/store";
import type { InfiniteCanvasWindowProximity } from "./types";

/**
 * The latest proximity reading for one window from the store's signals.
 * Null until a compositor with the proximity pass has measured it.
 */
function useInfiniteCanvasWindowProximity(windowId: string): InfiniteCanvasWindowProximity | null {
  const store = useInfiniteCanvasStore();

  return useSelector(() => store.signals$.proximity.get()?.[windowId] ?? null);
}

export { useInfiniteCanvasWindowProximity };
