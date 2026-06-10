import type { InfiniteCanvasPoint, InfiniteCanvasViewport } from "./types";

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

function getElementViewport(element: HTMLElement): InfiniteCanvasViewport {
  const bounds = element.getBoundingClientRect();

  return {
    height: Math.round(bounds.height),
    width: Math.round(bounds.width),
  };
}

function capturePointer(element: Pick<HTMLElement, "setPointerCapture">, pointerId: number) {
  // Pointer capture is best-effort: setPointerCapture throws NotFoundError
  // when the pointer is no longer active (pen lifted between events) or when
  // the event was dispatched synthetically (automated tests, agent drivers).
  // Interaction state must still start/finish in those cases.
  try {
    element.setPointerCapture(pointerId);
  } catch {
    // Continue without capture; handlers track the pointer by id.
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

function clearNativeTextSelection() {
  const selection = typeof document === "undefined" ? null : document.getSelection();

  if (selection !== null && !selection.isCollapsed) {
    selection.removeAllRanges();
  }
}

export {
  capturePointer,
  clearNativeTextSelection,
  getClientPoint,
  getElementViewport,
  getViewportPoint,
  isPrimaryButton,
  releasePointer,
};
