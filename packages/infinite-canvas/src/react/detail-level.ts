import { useValue } from "@legendapp/state/react";
import { useRef } from "react";
import {
  getInfiniteCanvasWindowDetailLevel,
  type InfiniteCanvasDetailLevel,
} from "../detail-level";
import type { InfiniteCanvasRect } from "../types";
import { useInfiniteCanvasState$ } from "./store";

export function useInfiniteCanvasDetailLevel(
  rect: InfiniteCanvasRect,
  enabled = true,
): InfiniteCanvasDetailLevel {
  const state$ = useInfiniteCanvasState$();
  const previousLevel = useRef<InfiniteCanvasDetailLevel>("full");
  const level = useValue(() =>
    enabled
      ? getInfiniteCanvasWindowDetailLevel(rect, state$.camera.zoom.get(), previousLevel.current)
      : "full",
  );
  previousLevel.current = level;
  return level;
}
