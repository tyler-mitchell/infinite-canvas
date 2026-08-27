import type { InfiniteCanvasViewportOccluder } from "@hyphened/infinite-canvas";
import { observable } from "@legendapp/state";
import { useValue } from "@legendapp/state/react";
import { useEffect, useMemo, type RefObject } from "react";

/**
 * What this app's floating chrome is actually covering, measured rather than calculated.
 *
 * `viewportInsets` describes chrome that brackets the canvas — the library rail down one side, the
 * identity bar across the top. It takes one number per edge, so it can only describe a band, and
 * the minimap is not a band: it is a 150×100 box in a corner. Declared as an inset it wrote off a
 * 1440-wide strip, 19% of the viewport, to reserve space for something covering 1% of it. The
 * framework's `viewportOccluders` is the shape that fits, and this is where the app fills it in.
 *
 * **Measured from the DOM, not derived from the constants that position it.** A HUD surface is
 * placed by anchor classes, padding and a border; recomputing that here would be a second copy of
 * the layout, correct until someone changes a class and silently wrong afterwards — with the
 * failure being a window opening under the map, which nobody would trace back to a rounding
 * constant. The element knows where it is. Ask it.
 *
 * Keyed, so more than one surface can declare itself without any of them knowing about the others.
 *
 * **Every write replaces the whole record**, which looks wasteful and is not optional. Legend State
 * commits per field and does not replace the root, so a component reading the root of an object
 * observable stays subscribed to something that never changes — `note-window.tsx` carries the same
 * warning after its scroll fades never moved. Written per key first here too, and the canvas
 * received an empty array while the map sat measured in the store.
 */

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

/**
 * Report an element's screen rect for as long as it is mounted, and withdraw it when it is not.
 *
 * Screen coordinates relative to the viewport, which is the space `viewportOccluders` is in and the
 * space `getBoundingClientRect` already answers in — the canvas fills the window here, so the two
 * agree with no conversion. A canvas inset inside a larger page would need the host's own rect
 * subtracted, and that is the day this grows an argument rather than a guess.
 */
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

      // Written only on a real change: this feeds a prop depended on by identity, so re-publishing
      // an equal rect would re-dispatch on every observed frame.
      if (!isSameRect(current[id], rect)) {
        hudOccluders$.set({ ...current, [id]: rect });
      }
    };
    const observer = new ResizeObserver(measure);

    measure();
    observer.observe(element);
    // The box moves when the window resizes even though its own size has not changed, because it is
    // anchored to a corner — so the element's own observer never fires and the rect goes stale.
    globalThis.addEventListener("resize", measure);

    return () => {
      const { [id]: _withdrawn, ...rest } = hudOccluders$.peek();

      observer.disconnect();
      globalThis.removeEventListener("resize", measure);
      hudOccluders$.set(rest);
    };
  }, [active, id, ref]);
}

/** Every declared occluder, as the array the canvas prop takes. Stable while nothing has moved. */
function useHudOccluders(): readonly InfiniteCanvasViewportOccluder[] {
  const declared = useValue(hudOccluders$);

  return useMemo(() => Object.values(declared), [declared]);
}

export { hudOccluders$, useHudOccluder, useHudOccluders };
