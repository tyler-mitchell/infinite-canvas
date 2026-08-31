import type { InfiniteCanvasViewportOccluder } from "@hyphened/infinite-canvas";
import { observable } from "@legendapp/state";
import { useValue } from "@legendapp/state/react";
import { useEffect, useMemo, type RefObject } from "react";

// Replace the record because Legend State does not replace the root after field commits.
const hudOccluders$ = observable<Record<string, InfiniteCanvasViewportOccluder>>({});

const isSameRect = (
  left: InfiniteCanvasViewportOccluder | undefined,
  right: InfiniteCanvasViewportOccluder,
) =>
  left !== undefined &&
  left.x === right.x &&
  left.y === right.y &&
  left.width === right.width &&
  left.height === right.height;

// These rectangles use viewport coordinates.
function useHudOccluder(id: string, ref: RefObject<HTMLElement | null>, active = true) {
  useEffect(() => {
    const element = ref.current;

    if (!active || element === null) {
      const { [id]: _withdrawn, ...rest } = hudOccluders$.peek();

      hudOccluders$.set(rest);

      return;
    }

    const measure = () => {
      const box = element.getBoundingClientRect();
      const rect = {
        height: box.height,
        width: box.width,
        x: box.x,
        y: box.y,
      };
      const current = hudOccluders$.peek();

      if (!isSameRect(current[id], rect)) {
        hudOccluders$.set({ ...current, [id]: rect });
      }
    };
    const observer = new ResizeObserver(measure);

    measure();
    observer.observe(element);
    // Window resize can move a corner anchor without resizing this element.
    globalThis.addEventListener("resize", measure);

    return () => {
      const { [id]: _withdrawn, ...rest } = hudOccluders$.peek();

      observer.disconnect();
      globalThis.removeEventListener("resize", measure);
      hudOccluders$.set(rest);
    };
  }, [active, id, ref]);
}

function useHudOccluders(): readonly InfiniteCanvasViewportOccluder[] {
  const declared = useValue(hudOccluders$);

  return useMemo(() => Object.values(declared), [declared]);
}

export { hudOccluders$, useHudOccluder, useHudOccluders };
