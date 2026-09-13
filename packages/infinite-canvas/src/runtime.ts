import type { InfiniteCanvasPoint } from "./types";

type PointerLike = Pick<PointerEvent, "clientX" | "clientY">;

function getClientPoint(event: PointerLike): InfiniteCanvasPoint {
  return {
    x: event.clientX,
    y: event.clientY,
  };
}

function getViewportPoint(element: HTMLElement, point: InfiniteCanvasPoint): InfiniteCanvasPoint {
  const bounds = element.getBoundingClientRect();

  return {
    x: point.x - bounds.left,
    y: point.y - bounds.top,
  };
}

function capturePointer(element: Pick<HTMLElement, "setPointerCapture">, pointerId: number) {
  // Pointer capture can fail after release or for synthetic events.
  try {
    element.setPointerCapture(pointerId);
  } catch {
    // Handlers still track the pointer by ID.
  }
}

function releasePointer(
  element: Pick<HTMLElement, "hasPointerCapture" | "releasePointerCapture">,
  pointerId: number,
) {
  if (element.hasPointerCapture(pointerId)) {
    element.releasePointerCapture(pointerId);
  }
}

function isPrimaryButton(event: Pick<PointerEvent, "button" | "isPrimary">) {
  return event.button === 0 && event.isPrimary;
}

/** Screen pixels a press travels before it is a drag rather than a click. */
const DRAG_THRESHOLD_PX = 6;

/** Elements that own their own press: a drag must not start on them. */
const INTERACTIVE_TARGET_SELECTOR = [
  "[data-infinite-canvas-control='true']",
  "a",
  "button",
  "input",
  "select",
  "textarea",
  "[contenteditable='true']",
  "[contenteditable='']",
].join(",");

function isInteractiveTarget(target: EventTarget | null): boolean {
  return target instanceof Element && target.closest(INTERACTIVE_TARGET_SELECTOR) !== null;
}

function clearNativeTextSelection() {
  const selection = typeof document === "undefined" ? null : document.getSelection();

  if (selection !== null && !selection.isCollapsed) {
    selection.removeAllRanges();
  }
}

export {
  DRAG_THRESHOLD_PX,
  capturePointer,
  clearNativeTextSelection,
  getClientPoint,
  getViewportPoint,
  isInteractiveTarget,
  isPrimaryButton,
  releasePointer,
};
