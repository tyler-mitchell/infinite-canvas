/** Selects possible tab stops. Later checks remove hidden and inherited inert elements. */
const TABBABLE_SELECTOR = [
  "a[href]",
  "area[href]",
  "audio[controls]",
  "button",
  "details > summary:first-of-type",
  "iframe",
  "input",
  "select",
  "textarea",
  "video[controls]",
  "[contenteditable='']",
  "[contenteditable='true']",
  "[tabindex]",
].join(",");

/** Uses client rects because fixed elements do not have an offset parent. */
function isTabbable(element: Element): element is HTMLElement {
  if (!(element instanceof HTMLElement)) {
    return false;
  }

  if (element.hasAttribute("disabled") || element.getAttribute("aria-hidden") === "true") {
    return false;
  }

  const tabIndex = element.getAttribute("tabindex");

  if (tabIndex !== null && Number.parseInt(tabIndex, 10) < 0) {
    return false;
  }

  // An ancestor can apply `inert` to the element.
  if (element.closest("[inert]") !== null) {
    return false;
  }

  return element.getClientRects().length > 0;
}

function getInfiniteCanvasTabbableElements(root: HTMLElement): readonly HTMLElement[] {
  return [...root.querySelectorAll(TABBABLE_SELECTOR)].filter(isTabbable);
}

/** Focuses the first tab stop or the root when the root has no tab stops. */
function focusInfiniteCanvasContent(root: HTMLElement): boolean {
  const [first] = getInfiniteCanvasTabbableElements(root);
  const target = first ?? root;

  target.focus({ preventScroll: true });

  return document.activeElement === target;
}

/** Traps edge `Tab` presses and leaves inner traversal to the browser. */
type InfiniteCanvasTabTrapAction = "focus-first" | "focus-last" | "focus-root" | "release";

function getInfiniteCanvasTabTrapAction(
  event: Readonly<{ shiftKey: boolean; target: EventTarget | null }>,
  edges: Readonly<{ first: EventTarget; last: EventTarget }> | null,
): InfiniteCanvasTabTrapAction {
  // A root with no tab stops wraps focus to itself.
  if (edges === null) {
    return "focus-root";
  }

  if (!event.shiftKey && event.target === edges.last) {
    return "focus-first";
  }

  return event.shiftKey && event.target === edges.first ? "focus-last" : "release";
}

function trapInfiniteCanvasTabKey(
  event: Readonly<{ shiftKey: boolean; target: EventTarget | null }>,
  root: HTMLElement,
): boolean {
  const tabbable = getInfiniteCanvasTabbableElements(root);
  const first = tabbable[0];
  const last = tabbable[tabbable.length - 1];
  const action = getInfiniteCanvasTabTrapAction(
    event,
    first === undefined || last === undefined ? null : { first, last },
  );

  if (action === "release") {
    return false;
  }

  const destination =
    action === "focus-root"
      ? root
      : action === "focus-first"
        ? (first as HTMLElement)
        : (last as HTMLElement);

  destination.focus({ preventScroll: true });

  return true;
}

export {
  focusInfiniteCanvasContent,
  getInfiniteCanvasTabTrapAction,
  getInfiniteCanvasTabbableElements,
  trapInfiniteCanvasTabKey,
};
export type { InfiniteCanvasTabTrapAction };
