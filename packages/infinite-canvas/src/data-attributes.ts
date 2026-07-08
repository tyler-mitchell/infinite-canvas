/**
 * Public STYLING selector contract for the headless distribution.
 *
 * Every structural element the framework renders is tagged with
 * `data-slot="<slot>"` using the vocabulary below. Theme stylesheets
 * (theme.css and the future styled distribution) target these attributes
 * instead of utility classNames. This contract is purely presentational;
 * the `data-infinite-canvas-*` attributes are a separate behavioral
 * contract and must not be used for styling.
 *
 * Boolean window states are emitted as separate attributes
 * (`data-active`, `data-selected`, `data-pinned`) rather than a single
 * enum because window states co-occur.
 */
const INFINITE_CANVAS_SLOTS = {
  dockRegion: "dock-region",
  grid: "grid",
  groupAccordionHeader: "group-accordion-header",
  groupGutter: "group-gutter",
  groupResizeHandle: "group-resize-handle",
  groupShell: "group-shell",
  groupTab: "group-tab",
  groupTabStrip: "group-tab-strip",
  hud: "hud",
  hudButton: "hud-button",
  hudDock: "hud-dock",
  hudDockItem: "hud-dock-item",
  hudGroup: "hud-group",
  hudStatus: "hud-status",
  hudSubtitle: "hud-subtitle",
  hudTitle: "hud-title",
  hudZoomReadout: "hud-zoom-readout",
  marquee: "marquee",
  portalRoot: "portal-root",
  resizeHandle: "resize-handle",
  selectionBounds: "selection-bounds",
  snapGuide: "snap-guide",
  snapPreview: "snap-preview",
  viewport: "viewport",
  window: "window",
  windowBody: "window-body",
  windowControl: "window-control",
  windowControls: "window-controls",
  windowCorner: "window-corner",
  windowCorners: "window-corners",
  windowHeader: "window-header",
  windowHostChrome: "window-host-chrome",
  windowPortalRoot: "window-portal-root",
  windowSurface: "window-surface",
  windowTitle: "window-title",
} as const;

type InfiniteCanvasSlot = (typeof INFINITE_CANVAS_SLOTS)[keyof typeof INFINITE_CANVAS_SLOTS];

/**
 * Window state attributes for the styling contract. Present states render
 * as empty-string valued attributes (`data-active=""`); absent states are
 * `undefined`, which React omits from the DOM.
 */
function getInfiniteCanvasWindowStateAttributes({
  isActive,
  isPinned,
  isSelected,
}: Readonly<{
  isActive: boolean;
  isPinned: boolean;
  isSelected: boolean;
}>): Record<string, "" | undefined> {
  return {
    "data-active": isActive ? "" : undefined,
    "data-pinned": isPinned ? "" : undefined,
    "data-selected": isSelected ? "" : undefined,
  };
}

export { INFINITE_CANVAS_SLOTS, getInfiniteCanvasWindowStateAttributes };
export type { InfiniteCanvasSlot };
