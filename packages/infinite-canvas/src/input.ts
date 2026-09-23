import type { Point } from "@hyphened/math/cpu";

export {
  clearNativeTextSelection,
  isInteractiveTarget,
  isPrimaryButton,
  releasePointer,
} from "../next/input";

export function getClientPoint(event: Pick<PointerEvent, "clientX" | "clientY">): Point {
  return { x: event.clientX, y: event.clientY };
}

export function getViewportPoint(element: HTMLElement, point: Point): Point {
  const bounds = element.getBoundingClientRect();
  return { x: point.x - bounds.left, y: point.y - bounds.top };
}

export function capturePointer(element: Pick<HTMLElement, "setPointerCapture">, pointerId: number) {
  try {
    element.setPointerCapture(pointerId);
  } catch (error) {
    console.warn("Pointer capture failed; document handlers still track the pointer.", error);
  }
}
