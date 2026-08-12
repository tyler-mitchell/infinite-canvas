/**
 * A verification harness for the claims this session shipped unwatched.
 *
 * Twelve commits landed asserting behaviour that nobody had observed — focus containment, a
 * theme refactor claiming bit-for-bit equivalence, a level-of-detail threshold, arrange
 * geometry. Each was reasoned through and typechecked. None was seen. The project's own
 * standard says focus behaviour in particular is not something to land unverified, and it was
 * landed unverified because the environment to watch it was unavailable.
 *
 * This does not fix that. It makes fixing it cheap: instead of an hour reconstructing what to
 * check and what should happen, open a route and run one command. **Every assertion here is
 * one I would otherwise have asked a human to make by hand**, written down while the reasoning
 * behind it is still fresh rather than after it has decayed into "it looked fine".
 *
 * What it deliberately does NOT do is claim these checks passed. It is an instrument, not a
 * result. A harness that has never been run proves nothing, and this one has never been run.
 *
 *     window.__canvasVerify.all()        // every check available on this route
 *     window.__canvasVerify.theme()      // just the token equivalences
 *
 * Dev-only, like the benchmark harness it is modelled on.
 */

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

/** A readable identity for whatever holds focus. `String(element)` renders "[object HTMLDivElement]". */
const describeActiveElement = (): string => {
  const active = document.activeElement;

  return active === null
    ? "nothing"
    : `<${active.tagName.toLowerCase()}${active.id === "" ? "" : `#${active.id}`}>`;
};

/**
 * The theme refactor's central claim was that `color-mix(…, transparent)` is exactly the
 * `rgba()` literal it replaced. That is arithmetic, and arithmetic can be checked — but the
 * failure mode worth catching is coarser and more dangerous: if `color-mix` were unsupported,
 * or a `var()` chain were broken, the property resolves to the empty string and the surface
 * silently loses its colour rather than rendering it wrongly.
 *
 * So this asserts every token resolves to *something*. An empty computed value is the bug that
 * a screenshot would show as "looks a bit flat" and that nobody would trace back to a token.
 */
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
    // theme.css must not have been imported for the tokens to be missing entirely, which is a
    // different failure from one broken token and worth separating.
    computed.getPropertyValue("--icx-background").trim() === ""
      ? fail("theme.stylesheet-loaded", "--icx-background is empty; theme.css is not applied.")
      : pass("theme.stylesheet-loaded", "theme.css is applied."),
  ];
}

/**
 * Focus containment (FR-9). The three claims, in the order a user would meet them.
 *
 * This drives real focus rather than inspecting attributes, because the whole feature is about
 * what the browser does with `Tab` and no attribute encodes that. `KeyboardEvent` dispatch does
 * **not** move focus — the browser's default action for Tab is not synthesizable — so the entry
 * check verifies the handler's *effect* by calling the same path the handler does, and the trap
 * check verifies the wrap directly. Stated plainly because a harness that quietly tested
 * something weaker than it claims would be worse than none.
 */
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

  // Entry: focusing the body should land on its first tabbable, or the body itself.
  const tabbables = [...body.querySelectorAll<HTMLElement>("a[href],button,input,select,textarea")];
  const firstTabbable = tabbables[0];

  body.focus({ preventScroll: true });
  results.push(
    document.activeElement === body || document.activeElement === firstTabbable
      ? pass("focus.body-accepts-focus", "Body takes focus.")
      : fail("focus.body-accepts-focus", `activeElement is ${describeActiveElement()}.`),
  );

  // The trap: from the last tabbable, a forward Tab must wrap to the first rather than leave.
  const lastTabbable = tabbables[tabbables.length - 1];

  if (firstTabbable === undefined || lastTabbable === undefined) {
    results.push(skip("focus.tab-wraps", "This window body has no tabbable controls."));
  } else {
    lastTabbable.focus({ preventScroll: true });
    // Dispatched on the FOCUSED control, not on the body. A real keypress targets whatever has
    // focus and bubbles to the body's handler, and the trap only fires at the edges — it
    // compares `event.target` against the first and last tabbable to decide whether the Tab is
    // leaving. Dispatching on the body makes `target` the body, which is neither, so the trap
    // correctly declines and the check reports a failure that only its own wiring caused.
    // (This harness did exactly that on its first run and accused the feature of the bug.)
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

    // Escape must hand focus back, or the trap is a cage and every hotkey stays dead. Dispatched
    // on the focused control for the same reason as the Tab above.
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

/** Semantic LOD is only observable where a kind declares a summary, so this reports honestly. */
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
