"use client";

import { useLayoutEffect, useRef, type CSSProperties } from "react";

import { DEFAULT_INFINITE_CANVAS_STACK_BANDS } from "./constants";
import { INFINITE_CANVAS_SLOTS } from "./data-attributes";
import { getConstrainedZoom } from "./geometry";
import { useInfiniteCanvasIcons } from "./icons";
import { getSelectableWindowIds } from "./selection";
import { useInfiniteCanvasActions, useInfiniteCanvasState } from "./store";
import type {
  InfiniteCanvasHudPolicy,
  InfiniteCanvasHudPolicyInput,
  InfiniteCanvasPointerMode,
  InfiniteCanvasZoomPolicy,
} from "./types";
import { isInfiniteCanvasWindowInActiveWorkspace } from "./workspace-membership";

const DEFAULT_INFINITE_CANVAS_HUD_POLICY: InfiniteCanvasHudPolicy = {
  cameraControls: true,
  minimizedDock: true,
  pointerModeControls: true,
  statusCard: true,
  zoomControls: true,
};

const HIDDEN_INFINITE_CANVAS_HUD_POLICY: InfiniteCanvasHudPolicy = {
  cameraControls: false,
  minimizedDock: false,
  pointerModeControls: false,
  statusCard: false,
  zoomControls: false,
};

function resolveInfiniteCanvasHudPolicy(
  input?: InfiniteCanvasHudPolicyInput,
): InfiniteCanvasHudPolicy {
  if (input === undefined) {
    return DEFAULT_INFINITE_CANVAS_HUD_POLICY;
  }

  if (typeof input === "boolean") {
    return input ? DEFAULT_INFINITE_CANVAS_HUD_POLICY : HIDDEN_INFINITE_CANVAS_HUD_POLICY;
  }

  return {
    ...DEFAULT_INFINITE_CANVAS_HUD_POLICY,
    ...input,
  };
}

// Screen-reader-only treatment for the live announcer (Tailwind sr-only).
const VISUALLY_HIDDEN_STYLE = {
  borderWidth: 0,
  clip: "rect(0, 0, 0, 0)",
  height: "1px",
  margin: "-1px",
  overflow: "hidden",
  padding: 0,
  position: "absolute",
  whiteSpace: "nowrap",
  width: "1px",
} satisfies CSSProperties;

const HUD_ICON_BUTTON_STYLE = {
  alignItems: "center",
  display: "flex",
  height: "40px",
  justifyContent: "center",
  width: "40px",
} satisfies CSSProperties;

const HUD_GROUP_STYLE = {
  alignItems: "center",
  display: "flex",
  overflow: "hidden",
  pointerEvents: "auto",
} satisfies CSSProperties;

/**
 * The bottom edge is one row, not two corners.
 *
 * The dock and the controls used to be separate absolutely-positioned children, one pinned left and
 * one pinned right, each allowed to grow to `calc(100% - 2rem)`. Nothing kept them apart: minimize
 * two windows in an app with a left inset and the dock slides straight under the zoom controls.
 * Widths cannot be tuned out of this — the dock's width is however many windows the user minimized.
 *
 * As a flex row they cannot overlap at all. The dock shrinks and wraps within its own share, the
 * controls hold their intrinsic size, and `marginLeft: auto` keeps the controls right even when
 * there is no dock beside them — which `justify-content: space-between` would get wrong.
 */
/**
 * How far the HUD's own chrome reaches in from an edge, published for the consumer to read.
 *
 * `viewportInsets` runs consumer → canvas: here is what my chrome covers, aim around it. Nothing
 * ran the other way, so an app wanting the bottom-right corner — where this HUD puts its dock and
 * its zoom controls — had to guess where they end. Polkadot guessed 64px against an actual 114 and
 * spent weeks with 37% of its minimap under a rail that swallowed the clicks.
 *
 * A consumer cannot compute this. The rails are placed against an inset the consumer supplied, so
 * the answer depends on the consumer's own input; and observing it from outside means racing a
 * layout this component performs — mounting after the consumer's surfaces, moving when insets
 * apply, and doing neither in a way the platform reports. Four attempts at that are recorded in
 * Polkadot's `hud-clearance.ts`; each shipped a wrong number that typechecked.
 *
 * Written where it renders, which is the one moment the answer is known for certain. A consumer
 * then writes `bottom: calc(var(--icx-hud-extent-bottom, 0px) + 8px)` and is done — no observers,
 * no timing, and the fallback covers a canvas whose HUD is turned off.
 *
 * Measured from the viewport's edge rather than from the inset, because that is the box a
 * consumer's own absolutely-positioned chrome resolves against.
 */
const HUD_EXTENT_BOTTOM_PROPERTY = "--icx-hud-extent-bottom";
const HUD_EXTENT_TOP_PROPERTY = "--icx-hud-extent-top";

const HUD_BOTTOM_BAND_STYLE = {
  alignItems: "flex-end",
  bottom: "16px",
  display: "flex",
  gap: "8px",
  left: "16px",
  position: "absolute",
  right: "16px",
} satisfies CSSProperties;

const HUD_DOCK_STYLE = {
  alignItems: "center",
  display: "flex",
  flexWrap: "wrap",
  gap: "8px",
  // Below its content, so a long dock wraps instead of pushing the controls off the edge.
  minWidth: 0,
} satisfies CSSProperties;

const HUD_CONTROLS_STYLE = {
  alignItems: "center",
  display: "flex",
  flexShrink: 0,
  flexWrap: "wrap",
  gap: "8px",
  justifyContent: "flex-end",
  marginLeft: "auto",
} satisfies CSSProperties;

function InfiniteCanvasHud({
  onPointerModeChange,
  pointerMode = "marquee",
  policy,
  subtitle,
  title,
  zoomPolicy,
}: Readonly<{
  onPointerModeChange?: (pointerMode: InfiniteCanvasPointerMode) => void;
  pointerMode?: InfiniteCanvasPointerMode;
  policy?: InfiniteCanvasHudPolicyInput;
  subtitle: string;
  title: string;
  zoomPolicy: InfiniteCanvasZoomPolicy;
}>) {
  const state = useInfiniteCanvasState();
  const actions = useInfiniteCanvasActions();
  const { reset: ResetIcon } = useInfiniteCanvasIcons();
  const resolvedPolicy = resolveInfiniteCanvasHudPolicy(policy);
  const activeWindow = state.windows.find((window) => window.id === state.activeWindowId);
  /*
   * The dock holds what *this desktop* put away.
   *
   * Minimizing and workspace membership are orthogonal — a window minimized on one desktop stays a
   * member of it — so filtering on `mode` alone listed windows put away on desktops the user is not
   * standing on. Restoring one from there is worse than a stale row: the window returns to a
   * desktop this canvas is not drawing, so the dock item vanishes and nothing appears, which reads
   * exactly like the control being broken.
   *
   * `getSelectableWindowIds` has filtered this way since workspaces landed, and `window.reveal`,
   * the offscreen ring and the minimap have each since taken the same correction. This was the
   * fourth surface reading `mode` and stopping.
   */
  const minimizedWindows = state.windows.filter(
    (window) =>
      window.mode === "minimized" && isInfiniteCanvasWindowInActiveWorkspace(state, window.id),
  );
  const showControlsRow =
    resolvedPolicy.cameraControls ||
    resolvedPolicy.pointerModeControls ||
    resolvedPolicy.zoomControls;
  /*
   * Nothing minimized means no dock, not an empty one.
   *
   * A dock with no items in it is not a place — it is a container announcing a capability the user
   * is not currently using. Rendering it anyway pushed the decision onto consumers, who reached for
   * `:empty` to hide it; that only works while the framework happens to render no whitespace, and
   * every app has to discover it independently.
   */
  const showDock = resolvedPolicy.minimizedDock && minimizedWindows.length > 0;
  const rootRef = useRef<HTMLDivElement>(null);

  /*
   * Re-measured on every render, deliberately without a dependency array.
   *
   * What moves these rails is not any one value this component could depend on: the consumer's
   * insets, the dock gaining a window, the viewport resizing, a policy turning a control off. Every
   * one of them re-renders this component, so running after each render is both the cheapest
   * correct trigger and the only one that cannot go stale — and `useLayoutEffect` reads the box in
   * the same frame it was laid out in, so no consumer ever sees a value from the render before.
   *
   * Observers were the obvious alternative and are the wrong tool here: their delivery is tied to
   * rendering opportunities, which a hidden document does not have, so a canvas in a background tab
   * would publish nothing until it was looked at.
   */
  useLayoutEffect(() => {
    const root = rootRef.current;
    const viewport = root?.closest(`[data-slot="${INFINITE_CANVAS_SLOTS.viewport}"]`);

    if (root === null || !(viewport instanceof HTMLElement)) {
      return;
    }

    const bounds = viewport.getBoundingClientRect();
    const band = root.querySelector(`[data-slot="${INFINITE_CANVAS_SLOTS.hudBand}"]`);
    const status = root.querySelector(`[data-slot="${INFINITE_CANVAS_SLOTS.hudStatus}"]`);
    const reach = (edge: number) => `${String(Math.max(0, Math.round(edge)))}px`;

    viewport.style.setProperty(
      HUD_EXTENT_BOTTOM_PROPERTY,
      reach(band === null ? 0 : bounds.bottom - band.getBoundingClientRect().top),
    );
    viewport.style.setProperty(
      HUD_EXTENT_TOP_PROPERTY,
      reach(status === null ? 0 : status.getBoundingClientRect().bottom - bounds.top),
    );

    return () => {
      viewport.style.removeProperty(HUD_EXTENT_BOTTOM_PROPERTY);
      viewport.style.removeProperty(HUD_EXTENT_TOP_PROPERTY);
    };
  });

  if (!showControlsRow && !showDock && !resolvedPolicy.statusCard) {
    return null;
  }

  return (
    <div
      data-slot={INFINITE_CANVAS_SLOTS.hud}
      ref={rootRef}
      /*
       * Inset by whatever the consumer said its own chrome covers, rather than pinned to the
       * element's edges.
       *
       * `viewportInsets` exists because a canvas cannot see the panels an app floats over it, and
       * every camera verb was taught to respect them — `view.fit`, `view.fitSelection` and
       * `window.reveal` all aim at the region that is left. The HUD was not, so the framework's own
       * controls kept being placed in bands the consumer had already declared as covered.
       *
       * Found the moment a consumer turned the minimized dock on: it renders bottom-left, the app
       * has a library rail down the left edge, and the dock drew underneath it. The status card
       * (top-left) had the same problem waiting. Fixing it at the root fixes every control the HUD
       * places, now and later, instead of each one learning about insets separately.
       */
      style={{
        bottom: state.viewportInsets.bottom,
        left: state.viewportInsets.left,
        pointerEvents: "none",
        position: "absolute",
        right: state.viewportInsets.right,
        top: state.viewportInsets.top,
        zIndex: DEFAULT_INFINITE_CANVAS_STACK_BANDS.overlay,
      }}
    >
      <div aria-live="polite" style={VISUALLY_HIDDEN_STYLE}>
        Active window {activeWindow?.title ?? "none"}.
      </div>
      {resolvedPolicy.statusCard ? (
        <div
          data-slot={INFINITE_CANVAS_SLOTS.hudStatus}
          style={{
            left: "16px",
            maxWidth: "min(28rem, calc(100% - 2rem))",
            position: "absolute",
            top: "16px",
          }}
        >
          <div data-slot={INFINITE_CANVAS_SLOTS.hudTitle}>{title}</div>
          <div data-slot={INFINITE_CANVAS_SLOTS.hudSubtitle} style={{ marginTop: "8px" }}>
            {subtitle}
          </div>
        </div>
      ) : null}
      {showDock || showControlsRow ? (
        <div data-slot={INFINITE_CANVAS_SLOTS.hudBand} style={HUD_BOTTOM_BAND_STYLE}>
          {showDock ? (
            <div data-slot={INFINITE_CANVAS_SLOTS.hudDock} style={HUD_DOCK_STYLE}>
              {minimizedWindows.map((window) => (
                <button
                  /*
                   * The title alone is not a label. Every other HUD button names its action —
                   * "Fit selection", "Reset desktop" — while a dock item announced only "Untitled
                   * 2", which is also what a row in the consumer's own list announces. The visible
                   * text stays inside the name, so speaking the title still reaches this button.
                   */
                  aria-label={`Restore ${window.title}`}
                  data-slot={INFINITE_CANVAS_SLOTS.hudDockItem}
                  key={window.id}
                  onClick={() => {
                    actions.restoreWindow(window.id);
                  }}
                  style={{ pointerEvents: "auto" }}
                  /*
                   * A dock item is a title, and a title can be longer than a dock. Consumers
                   * truncate these — the theme leaves the width alone but nothing stops an app from
                   * clamping it — and a truncated title with no way to read the rest is a worse
                   * affordance than a wide dock. The button already knows the full string.
                   */
                  title={window.title}
                  type="button"
                >
                  {window.title}
                </button>
              ))}
            </div>
          ) : null}
          {showControlsRow ? (
            <div style={HUD_CONTROLS_STYLE}>
              {resolvedPolicy.pointerModeControls && onPointerModeChange !== undefined ? (
                <InfiniteCanvasPointerModeControls
                  onModeChange={onPointerModeChange}
                  pointerMode={pointerMode}
                />
              ) : null}
              {resolvedPolicy.cameraControls ? <InfiniteCanvasCameraNavigationControls /> : null}
              {resolvedPolicy.zoomControls ? (
                <InfiniteCanvasZoomControls zoomPolicy={zoomPolicy} />
              ) : null}
              {resolvedPolicy.cameraControls ? (
                <button
                  aria-label="Reset desktop"
                  data-action="reset"
                  data-slot={INFINITE_CANVAS_SLOTS.hudButton}
                  onClick={() => {
                    actions.reset();
                  }}
                  style={{
                    ...HUD_ICON_BUTTON_STYLE,
                    pointerEvents: "auto",
                  }}
                  type="button"
                >
                  <ResetIcon />
                </button>
              ) : null}
            </div>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}

function InfiniteCanvasCameraNavigationControls() {
  const state = useInfiniteCanvasState();
  const actions = useInfiniteCanvasActions();
  const {
    "center-active": CenterActiveIcon,
    "fit-all": FitAllIcon,
    "fit-selection": FitSelectionIcon,
  } = useInfiniteCanvasIcons();
  const activeWindow = state.windows.find(
    (window) =>
      window.id === state.activeWindowId &&
      window.mode !== "minimized" &&
      isInfiniteCanvasWindowInActiveWorkspace(state, window.id),
  );
  /*
   * Asked of the same set the verb acts on, which it was not.
   *
   * "Fit all visible windows" runs `view.fitAll`, which unions `getSelectableWindowIds` — and that
   * has excluded other desktops since workspaces landed. This asked only about `mode`, so on a
   * desktop holding nothing the button sat enabled because some *other* desktop had a window open,
   * and pressing it did nothing at all. A control whose enabled state and whose action disagree is
   * worse than a disabled one: the user concludes the feature is broken rather than that there is
   * nothing to fit.
   *
   * `getSelectableWindowIds` rather than a fourth hand-rolled filter, so the two cannot drift again.
   */
  const visibleWindowExists = getSelectableWindowIds(state).length > 0;
  const selectionExists = state.selection.windowIds.length > 0;

  return (
    <div
      aria-label="Camera navigation"
      data-group="camera"
      data-infinite-canvas-control="true"
      data-slot={INFINITE_CANVAS_SLOTS.hudGroup}
      role="group"
      style={HUD_GROUP_STYLE}
    >
      <button
        aria-label="Center active window"
        data-action="center-active"
        data-slot={INFINITE_CANVAS_SLOTS.hudButton}
        disabled={activeWindow === undefined}
        onClick={() => {
          if (activeWindow === undefined) {
            return;
          }

          actions.navigateView({
            target: {
              type: "window",
              windowId: activeWindow.id,
            },
          });
        }}
        style={HUD_ICON_BUTTON_STYLE}
        title="Center active window"
        type="button"
      >
        <CenterActiveIcon />
      </button>
      <button
        aria-label="Fit selection"
        data-action="fit-selection"
        data-slot={INFINITE_CANVAS_SLOTS.hudButton}
        disabled={!selectionExists}
        onClick={() => {
          actions.navigateView({
            behavior: {
              type: "fit",
            },
            target: {
              type: "selection",
            },
          });
        }}
        style={HUD_ICON_BUTTON_STYLE}
        title="Fit selection"
        type="button"
      >
        <FitSelectionIcon />
      </button>
      <button
        aria-label="Fit all visible windows"
        data-action="fit-all"
        data-slot={INFINITE_CANVAS_SLOTS.hudButton}
        disabled={!visibleWindowExists}
        onClick={() => {
          actions.navigateView({
            behavior: {
              type: "fit",
            },
            target: {
              type: "visibleWindows",
            },
          });
        }}
        style={HUD_ICON_BUTTON_STYLE}
        title="Fit all visible windows"
        type="button"
      >
        <FitAllIcon />
      </button>
    </div>
  );
}

function InfiniteCanvasPointerModeControls({
  onModeChange,
  pointerMode,
}: Readonly<{
  onModeChange: (pointerMode: InfiniteCanvasPointerMode) => void;
  pointerMode: InfiniteCanvasPointerMode;
}>) {
  const { "pointer-marquee": PointerMarqueeIcon, "pointer-pan": PointerPanIcon } =
    useInfiniteCanvasIcons();

  return (
    <div
      aria-label="Canvas interaction mode"
      data-group="pointer-mode"
      data-infinite-canvas-control="true"
      data-slot={INFINITE_CANVAS_SLOTS.hudGroup}
      role="group"
      style={HUD_GROUP_STYLE}
    >
      <button
        aria-label="Use marquee selection mode"
        aria-pressed={pointerMode === "marquee"}
        data-action="pointer-marquee"
        data-active={pointerMode === "marquee" ? "" : undefined}
        data-slot={INFINITE_CANVAS_SLOTS.hudButton}
        onClick={() => {
          onModeChange("marquee");
        }}
        style={HUD_ICON_BUTTON_STYLE}
        title="Marquee selection"
        type="button"
      >
        <PointerMarqueeIcon />
      </button>
      <button
        aria-label="Use pan mode"
        aria-pressed={pointerMode === "pan"}
        data-action="pointer-pan"
        data-active={pointerMode === "pan" ? "" : undefined}
        data-slot={INFINITE_CANVAS_SLOTS.hudButton}
        onClick={() => {
          onModeChange("pan");
        }}
        style={HUD_ICON_BUTTON_STYLE}
        title="Pan canvas"
        type="button"
      >
        <PointerPanIcon />
      </button>
    </div>
  );
}

function InfiniteCanvasZoomControls({
  zoomPolicy,
}: Readonly<{
  zoomPolicy: InfiniteCanvasZoomPolicy;
}>) {
  const state = useInfiniteCanvasState();
  const actions = useInfiniteCanvasActions();
  const { "zoom-in": ZoomInIcon, "zoom-out": ZoomOutIcon } = useInfiniteCanvasIcons();
  const minZoom = getConstrainedZoom(0, zoomPolicy);
  const zoomPercent = Math.round(state.camera.zoom * 100);
  const centerAnchor = {
    x: state.viewport.width / 2,
    y: state.viewport.height / 2,
  };

  return (
    <div data-group="zoom" data-slot={INFINITE_CANVAS_SLOTS.hudGroup} style={HUD_GROUP_STYLE}>
      <button
        aria-label="Zoom out"
        data-action="zoom-out"
        data-slot={INFINITE_CANVAS_SLOTS.hudButton}
        disabled={state.camera.zoom <= minZoom}
        onClick={() => {
          actions.zoomAt({
            anchor: centerAnchor,
            zoom: state.camera.zoom / zoomPolicy.step,
          });
        }}
        style={HUD_ICON_BUTTON_STYLE}
        type="button"
      >
        <ZoomOutIcon />
      </button>
      <button
        aria-label="Reset zoom to 100 percent"
        data-action="zoom-reset"
        data-slot={INFINITE_CANVAS_SLOTS.hudButton}
        onClick={() => {
          actions.zoomAt({
            anchor: centerAnchor,
            zoom: zoomPolicy.defaultZoom,
          });
        }}
        style={{
          minWidth: "86px",
          padding: "8px 12px",
        }}
        type="button"
      >
        <span data-slot={INFINITE_CANVAS_SLOTS.hudZoomReadout}>{zoomPercent}%</span>
      </button>
      <button
        aria-label="Zoom in"
        data-action="zoom-in"
        data-slot={INFINITE_CANVAS_SLOTS.hudButton}
        disabled={state.camera.zoom >= zoomPolicy.maxZoom}
        onClick={() => {
          actions.zoomAt({
            anchor: centerAnchor,
            zoom: state.camera.zoom * zoomPolicy.step,
          });
        }}
        style={HUD_ICON_BUTTON_STYLE}
        type="button"
      >
        <ZoomInIcon />
      </button>
    </div>
  );
}

export { DEFAULT_INFINITE_CANVAS_HUD_POLICY, InfiniteCanvasHud, resolveInfiniteCanvasHudPolicy };
