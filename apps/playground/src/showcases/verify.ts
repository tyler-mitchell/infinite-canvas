/** The development harness examines theme, focus, and detail behavior. */
type CheckStatus = "fail" | "pass" | "skip";

type CheckResult = Readonly<{
  detail: string;
  name: string;
  status: CheckStatus;
}>;

const pass = (name: string, detail: string): CheckResult => ({ detail, name, status: "pass" });
const fail = (name: string, detail: string): CheckResult => ({ detail, name, status: "fail" });
const skip = (name: string, detail: string): CheckResult => ({ detail, name, status: "skip" });

const getViewport = (): HTMLElement | null =>
  document.querySelector<HTMLElement>("[data-slot='viewport']");

/** This function names the focused element without String(element). */
const describeActiveElement = (): string => {
  const active = document.activeElement;

  return active === null
    ? "nothing"
    : `<${active.tagName.toLowerCase()}${active.id === "" ? "" : `#${active.id}`}>`;
};

/** These tokens must resolve to nonempty computed values. */
const EXPECTED_TOKENS = [
  "--icx-color-foreground",
  "--icx-color-accent",
  "--icx-title-fg",
  "--icx-control-fg",
  "--icx-corner",
  "--icx-snap-guide",
  "--icx-marquee-border",
  "--icx-hud-panel-bg",
  "--icx-host-idle-border",
  "--icx-viewport-shadow",
] as const;

function theme(): readonly CheckResult[] {
  const viewport = getViewport();

  if (viewport === null) {
    return [skip("theme", "No [data-slot='viewport'] on this page.")];
  }

  const computed = globalThis.getComputedStyle(viewport);
  const unresolved = EXPECTED_TOKENS.filter(
    (token) => computed.getPropertyValue(token).trim() === "",
  );

  return [
    unresolved.length === 0
      ? pass("theme.tokens-resolve", `${EXPECTED_TOKENS.length} tokens all resolve.`)
      : fail(
          "theme.tokens-resolve",
          `${unresolved.length} resolve to empty: ${unresolved.join(", ")}. ` +
            "A var() chain is broken, or color-mix is unsupported here.",
        ),
    // This reports a missing stylesheet separately from a missing token.
    computed.getPropertyValue("--icx-background").trim() === ""
      ? fail("theme.stylesheet-loaded", "--icx-background is empty; theme.css is not applied.")
      : pass("theme.stylesheet-loaded", "theme.css is applied."),
  ];
}

/** This function examines focus entry, tab wrapping, and escape behavior. */
function focus(): readonly CheckResult[] {
  const surface = document.querySelector<HTMLElement>(
    "[data-infinite-canvas-command-scope='surface']",
  );
  const body = document.querySelector<HTMLElement>("[data-infinite-canvas-body='true']");

  if (surface === null || body === null) {
    return [skip("focus", "No command surface or window body on this route.")];
  }

  const results: CheckResult[] = [];

  results.push(
    body.tabIndex === -1
      ? pass("focus.body-programmatically-focusable", "Body carries tabIndex=-1.")
      : fail(
          "focus.body-programmatically-focusable",
          `Body tabIndex is ${body.tabIndex}; an empty window would not be enterable, and a ` +
            "body in the desktop tab order would defeat containment.",
        ),
  );

  // Focus enters the first tabbable control or the body.
  const tabbables = [...body.querySelectorAll<HTMLElement>("a[href],button,input,select,textarea")];
  const firstTabbable = tabbables[0];

  body.focus({ preventScroll: true });
  results.push(
    document.activeElement === body || document.activeElement === firstTabbable
      ? pass("focus.body-accepts-focus", "Body takes focus.")
      : fail("focus.body-accepts-focus", `activeElement is ${describeActiveElement()}.`),
  );

  // Forward Tab at the last control must wrap to the first.
  const lastTabbable = tabbables[tabbables.length - 1];

  if (firstTabbable === undefined || lastTabbable === undefined) {
    results.push(skip("focus.tab-wraps", "This window body has no tabbable controls."));
  } else {
    lastTabbable.focus({ preventScroll: true });
    // The event starts at the focused control because the body handler uses event.target.
    lastTabbable.dispatchEvent(
      new KeyboardEvent("keydown", { bubbles: true, cancelable: true, key: "Tab" }),
    );
    results.push(
      document.activeElement === firstTabbable
        ? pass("focus.tab-wraps", "Tab at the last control wrapped to the first.")
        : fail(
            "focus.tab-wraps",
            "Tab at the last control did not wrap. Focus would escape into the document, " +
              "which is the failure containment exists to prevent.",
          ),
    );

    // Escape returns focus to the canvas command surface.
    (document.activeElement ?? body).dispatchEvent(
      new KeyboardEvent("keydown", { bubbles: true, cancelable: true, key: "Escape" }),
    );
    results.push(
      document.activeElement === surface
        ? pass("focus.escape-returns", "Escape returned focus to the command surface.")
        : fail(
            "focus.escape-returns",
            `Escape left focus on ${describeActiveElement()}. The user would be inside ` +
              "a window with no keyboard way out.",
          ),
    );
  }

  return results;
}

/** Detail checks apply only to window kinds with a summary. */
function detail(): readonly CheckResult[] {
  const bodies = document.querySelectorAll("[data-infinite-canvas-body='true']");

  return [
    bodies.length === 0
      ? skip("detail", "No window bodies on this route.")
      : skip(
          "detail.summary-threshold",
          `Not machine-checkable from here: zoom out past ~180 screen px per window on /stress ` +
            `and confirm the ${bodies.length} bodies swap to their summary, then back in past ` +
            "~240 px. The band between them is what stops it flickering.",
        ),
  ];
}

function all(): readonly CheckResult[] {
  return [...theme(), ...focus(), ...detail()];
}

declare global {
  interface Window {
    __canvasVerify?: Readonly<{
      all: typeof all;
      detail: typeof detail;
      focus: typeof focus;
      theme: typeof theme;
    }>;
  }
}

export function exposeCanvasVerification(): void {
  if (!import.meta.env.DEV) {
    return;
  }

  globalThis.window.__canvasVerify = { all, detail, focus, theme };
}
