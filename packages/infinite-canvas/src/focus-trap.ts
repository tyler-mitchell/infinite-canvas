/**
 * Keeping DOM focus inside the window it belongs to (FR-9's last structural piece).
 *
 * Without this, `Tab` at the desktop walks the document: out of the active window, through an
 * inactive window's buttons, into a third window's form field. Nothing on screen says where
 * focus went, because an inactive window looks inactive whether or not it holds the caret. A
 * spatial window manager whose Tab order is document order is not a window manager; it is a
 * long page that happens to be arranged in space.
 *
 * **The model is the operating system's, because that is the domain this framework is in.**
 * At the desktop level, Tab does not walk into window contents — you enter a window
 * deliberately. Once inside, Tab cycles that window's own controls and stops at its edges.
 * `Escape` leaves the content and returns you to the desktop. Every OS window manager works
 * this way and users already know it; inventing a different model here would be novelty for
 * its own sake.
 *
 * DOM-aware by necessity and therefore **not a pure-core module** — it reads layout to decide
 * what is focusable. It is deliberately *not* exported from the barrel: the behaviour ships,
 * the API does not, until a consumer needs to compose it. An export nobody has used is an
 * export nobody has found the flaws in.
 */

/**
 * What the platform considers focusable, minus the things that only *look* focusable.
 *
 * `[tabindex]` is matched broadly and filtered afterwards rather than excluded here, because
 * `tabindex="-1"` is programmatically focusable but must never be a Tab stop — the distinction
 * the selector alone cannot express.
 */
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

/**
 * Whether an element can actually take focus right now.
 *
 * `getClientRects().length` is the visibility test rather than `offsetParent !== null`, which
 * reports `null` for anything in a `position: fixed` subtree — and a window body's popovers
 * are portalled precisely so they can be fixed. Using `offsetParent` here would silently skip
 * every control inside them.
 */
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

  // `inert` is inherited, so an element inside an inert subtree is unfocusable even though
  // nothing on the element itself says so. `closest` is what reads that inheritance.
  if (element.closest("[inert]") !== null) {
    return false;
  }

  return element.getClientRects().length > 0;
}

/** Every Tab stop inside `root`, in document order — which is Tab order for anything sane. */
function getInfiniteCanvasTabbableElements(root: HTMLElement): readonly HTMLElement[] {
  return [...root.querySelectorAll(TABBABLE_SELECTOR)].filter(isTabbable);
}

/**
 * Move focus into `root`, returning whether anything took it.
 *
 * Falls back to focusing the container itself, which is why a window body carries
 * `tabIndex={-1}`: a window whose content has no controls at all must still be enterable, or
 * `Tab` from the command surface would appear to do nothing and the user would have no way to
 * tell an empty window from a broken one.
 */
function focusInfiniteCanvasContent(root: HTMLElement): boolean {
  const [first] = getInfiniteCanvasTabbableElements(root);
  const target = first ?? root;

  target.focus({ preventScroll: true });

  return document.activeElement === target;
}

/**
 * Contain a `Tab` press within `root`, wrapping at both ends.
 *
 * Returns whether the event was handled, so the caller decides about `preventDefault` — this
 * module does not reach for the event's controls on its own.
 *
 * Only the **edges** are intercepted. A Tab in the middle of a form is left entirely to the
 * browser, which already does it correctly and handles cases (shadow roots, custom tab order,
 * content that changed since the query) that a hand-rolled walk would get wrong. Intercepting
 * every Tab in order to reimplement the platform's own traversal is how focus managers become
 * the bug they were written to fix.
 */
function trapInfiniteCanvasTabKey(
  event: Readonly<{ shiftKey: boolean; target: EventTarget | null }>,
  root: HTMLElement,
): boolean {
  const tabbable = getInfiniteCanvasTabbableElements(root);
  const first = tabbable[0];
  const last = tabbable[tabbable.length - 1];

  // Nothing focusable inside: the whole body is one stop, so either direction wraps to itself
  // and Tab must not escape into the document.
  if (first === undefined || last === undefined) {
    root.focus({ preventScroll: true });

    return true;
  }

  const isLeavingForward = !event.shiftKey && event.target === last;
  const isLeavingBackward = event.shiftKey && event.target === first;

  if (isLeavingForward) {
    first.focus({ preventScroll: true });

    return true;
  }

  if (isLeavingBackward) {
    last.focus({ preventScroll: true });

    return true;
  }

  return false;
}

export { focusInfiniteCanvasContent, getInfiniteCanvasTabbableElements, trapInfiniteCanvasTabKey };
