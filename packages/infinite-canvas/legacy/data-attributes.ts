/** Public `data-slot` names for styling. Behavioral attributes use a separate contract. */
const INFINITE_CANVAS_SLOTS = {
  dockRegion: "dock-region",
  grid: "grid",
  groupAccordionHeader: "group-accordion-header",
  groupGutter: "group-gutter",
  groupLabel: "group-label",
  groupResizeHandle: "group-resize-handle",
  groupShell: "group-shell",
  groupTab: "group-tab",
  groupTabStrip: "group-tab-strip",
  hud: "hud",
  /** Bottom row that contains the dock and controls. */
  hudBand: "hud-band",
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
  /** The region an undo or redo restored, while it fades. */
  revealedChange: "revealed-change",
  selectionBounds: "selection-bounds",
  snapGuide: "snap-guide",
  snapPreview: "snap-preview",
  underlay: "underlay",
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

/** Creates a canvas-scoped frame id for tab `aria-controls`. */
function getInfiniteCanvasWindowFrameElementId(canvasInstanceId: string, windowId: string): string {
  return `${canvasInstanceId}-window-${windowId}`;
}

/** Returns empty attributes for active states and `undefined` for absent states. */
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

export {
  INFINITE_CANVAS_SLOTS,
  getInfiniteCanvasWindowFrameElementId,
  getInfiniteCanvasWindowStateAttributes,
};
export type { InfiniteCanvasSlot };
