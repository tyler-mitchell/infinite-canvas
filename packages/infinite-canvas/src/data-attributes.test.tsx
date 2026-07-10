/**
 * Contract test for the public styling selector API.
 *
 * The `data-slot` vocabulary asserted here is the headless styling
 * contract consumed by theme.css and the styled distribution. Rendering
 * uses react-dom/server's renderToStaticMarkup (no DOM required); the
 * heavy viewport shell (R3F/WebGPU) is exercised indirectly through its
 * pure subtrees: window frames, frame slots, overlays, and the HUD.
 */
import { renderToStaticMarkup } from "react-dom/server";
import type { ReactNode } from "react";
import { expect, test } from "vite-plus/test";

import { InfiniteCanvasHud } from "./canvas-hud";
import {
  InfiniteCanvasMarqueeOverlay,
  InfiniteCanvasSelectionBoundsOverlay,
  InfiniteCanvasSnapOverlay,
} from "./canvas-overlays";
import {
  DEFAULT_INFINITE_CANVAS_CHROME,
  DEFAULT_INFINITE_CANVAS_STACK_BANDS,
  DEFAULT_INFINITE_CANVAS_THEME,
  resolveInfiniteCanvasZoomPolicy,
} from "./constants";
import { INFINITE_CANVAS_SLOTS, getInfiniteCanvasWindowStateAttributes } from "./data-attributes";
import {
  createInfiniteCanvasState,
  createInfiniteCanvasWindow,
  defineInfiniteCanvasWindowRegistry,
} from "./factory";
import { InfiniteCanvasGridBackdrop } from "./grid-backdrop";
import { InfiniteCanvasProvider } from "./store";
import { InfiniteCanvasWindowFrame } from "./window-frame";
import type { InfiniteCanvasState } from "./types";

type ContractWindowKind = "host-note" | "note";

const windowRegistry = defineInfiniteCanvasWindowRegistry<ContractWindowKind>({
  "host-note": {
    frameChrome: "scene",
    kind: "host-note",
    renderBody: () => "host body",
  },
  note: {
    kind: "note",
    renderBody: () => "note body",
  },
});

const noteWindow = createInfiniteCanvasWindow<ContractWindowKind>({
  id: "note-1",
  isPinned: true,
  kind: "note",
  rect: {
    height: 180,
    width: 260,
    x: 40,
    y: 40,
  },
  title: "Note",
});

const hostWindow = createInfiniteCanvasWindow<ContractWindowKind>({
  id: "host-1",
  kind: "host-note",
  mode: "maximized",
  rect: {
    height: 200,
    width: 280,
    x: 360,
    y: 80,
  },
  title: "Host note",
});

const minimizedWindow = createInfiniteCanvasWindow<ContractWindowKind>({
  id: "min-1",
  kind: "note",
  mode: "minimized",
  rect: {
    height: 120,
    width: 200,
    x: 700,
    y: 40,
  },
  title: "Tucked away",
});

const baseState = createInfiniteCanvasState<ContractWindowKind>({
  selection: [noteWindow.id, hostWindow.id],
  viewport: {
    height: 600,
    width: 800,
  },
  windows: [noteWindow, hostWindow, minimizedWindow],
});

function renderWithStore(state: InfiniteCanvasState<ContractWindowKind>, children: ReactNode) {
  return renderToStaticMarkup(
    <InfiniteCanvasProvider initialState={state}>{children}</InfiniteCanvasProvider>,
  );
}

function countOccurrences(markup: string, needle: string) {
  return markup.split(needle).length - 1;
}

test("INFINITE_CANVAS_SLOTS is the complete slot vocabulary", () => {
  expect(INFINITE_CANVAS_SLOTS).toEqual({
    dockRegion: "dock-region",
    grid: "grid",
    groupAccordionHeader: "group-accordion-header",
    groupGutter: "group-gutter",
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
  });
});

test("window state attributes are independent boolean data attributes", () => {
  for (const isActive of [false, true]) {
    for (const isPinned of [false, true]) {
      for (const isSelected of [false, true]) {
        expect(getInfiniteCanvasWindowStateAttributes({ isActive, isPinned, isSelected })).toEqual({
          "data-active": isActive ? "" : undefined,
          "data-pinned": isPinned ? "" : undefined,
          "data-selected": isSelected ? "" : undefined,
        });
      }
    }
  }
});

test("grid backdrop is tagged data-slot=grid", () => {
  const markup = renderWithStore(baseState, <InfiniteCanvasGridBackdrop />);

  expect(markup).toContain('data-slot="grid"');
});

test("dom window frame emits window slot, identity enums, states, and frame anatomy", () => {
  const markup = renderWithStore(
    baseState,
    <InfiniteCanvasWindowFrame
      camera={baseState.camera}
      canvasInstanceId="test-canvas"
      chrome={DEFAULT_INFINITE_CANVAS_CHROME}
      devicePixelRatio={1}
      isActive={true}
      isGrouped={false}
      isSelected={true}
      stackBands={DEFAULT_INFINITE_CANVAS_STACK_BANDS}
      theme={DEFAULT_INFINITE_CANVAS_THEME}
      viewport={baseState.viewport}
      window={noteWindow}
      windowDefinitions={windowRegistry}
    />,
  );

  expect(markup).toContain('data-slot="window"');
  expect(markup).toContain('data-kind="note"');
  expect(markup).toContain('data-mode="normal"');
  expect(markup).toContain('data-frame-chrome="dom"');
  expect(markup).toContain('data-active=""');
  expect(markup).toContain('data-selected=""');
  expect(markup).toContain('data-pinned=""');

  expect(markup).toContain('data-slot="window-surface"');
  expect(markup).toContain('data-slot="window-header"');
  expect(markup).toContain('data-slot="window-title"');
  expect(markup).toContain('data-slot="window-body"');
  expect(markup).toContain('data-slot="window-controls"');

  expect(markup).toContain('data-action="pin"');
  expect(markup).toContain('data-action="minimize"');
  expect(markup).toContain('data-action="maximize"');
  expect(markup).toContain('data-action="close"');
  expect(countOccurrences(markup, 'data-slot="window-control"')).toBe(4);

  expect(markup).toContain('data-slot="window-corners"');
  expect(countOccurrences(markup, 'data-slot="window-corner"')).toBe(4);
  expect(markup).toContain('data-corner="top-left"');
  expect(markup).toContain('data-corner="top-right"');
  expect(markup).toContain('data-corner="bottom-left"');
  expect(markup).toContain('data-corner="bottom-right"');

  expect(countOccurrences(markup, 'data-slot="resize-handle"')).toBe(8);
  for (const handle of [
    "east",
    "north",
    "north-east",
    "north-west",
    "south",
    "south-east",
    "south-west",
    "west",
  ]) {
    expect(markup).toContain(`data-handle="${handle}"`);
  }
});

test("host-chrome window frame normalizes scene->host and emits chrome layers", () => {
  const markup = renderWithStore(
    baseState,
    <InfiniteCanvasWindowFrame
      camera={baseState.camera}
      canvasInstanceId="test-canvas"
      chrome={DEFAULT_INFINITE_CANVAS_CHROME}
      devicePixelRatio={1}
      isActive={false}
      isGrouped={false}
      isSelected={false}
      stackBands={DEFAULT_INFINITE_CANVAS_STACK_BANDS}
      theme={DEFAULT_INFINITE_CANVAS_THEME}
      viewport={baseState.viewport}
      window={hostWindow}
      windowDefinitions={windowRegistry}
    />,
  );

  expect(markup).toContain('data-frame-chrome="host"');
  expect(markup).toContain('data-kind="host-note"');
  expect(markup).toContain('data-mode="maximized"');
  expect(markup).not.toContain('data-active=""');
  expect(markup).not.toContain('data-selected=""');
  expect(markup).not.toContain('data-pinned=""');

  expect(markup).toContain('data-slot="window-host-chrome"');
  for (const layer of ["accent", "fill", "frame", "header", "inner-frame"]) {
    expect(markup).toContain(`data-layer="${layer}"`);
  }

  // Maximized windows offer "restore" from the maximize control position.
  expect(markup).toContain('data-action="restore"');
  expect(markup).not.toContain('data-action="maximize"');
});

test("selection bounds overlay is tagged data-slot=selection-bounds", () => {
  const markup = renderWithStore(
    baseState,
    <InfiniteCanvasSelectionBoundsOverlay devicePixelRatio={1} />,
  );

  expect(markup).toContain('data-slot="selection-bounds"');
});

test("snap overlay emits snap-preview and per-guide axis/kind attributes", () => {
  const snapState: InfiniteCanvasState<ContractWindowKind> = {
    ...baseState,
    groups: [],
    history: { future: [], past: [] },
    interaction: {
      dockPreview: null,
      kind: "move",
      originPointer: { x: 50, y: 50 },
      originRect: noteWindow.rect,
      originRects: [
        {
          rect: noteWindow.rect,
          windowId: noteWindow.id,
        },
      ],
      originCamera: baseState.camera,
      pointerId: 1,
      windowId: noteWindow.id,
    },
    snapPreview: {
      guides: [
        {
          axis: "x",
          from: "window",
          id: "guide-x",
          kind: "edge",
          position: 40,
          sourceAnchor: "left",
        },
        {
          axis: "y",
          from: "window",
          id: "guide-y",
          kind: "center",
          position: 130,
          sourceAnchor: "middle",
        },
      ],
      rect: noteWindow.rect,
      windowId: noteWindow.id,
    },
  };
  const markup = renderWithStore(snapState, <InfiniteCanvasSnapOverlay devicePixelRatio={1} />);

  expect(markup).toContain('data-slot="snap-preview"');
  expect(countOccurrences(markup, 'data-slot="snap-guide"')).toBe(2);
  expect(markup).toContain('data-axis="x"');
  expect(markup).toContain('data-axis="y"');
  expect(markup).toContain('data-kind="edge"');
  expect(markup).toContain('data-kind="center"');
});

test("marquee overlay emits data-slot=marquee with the interaction mode", () => {
  const marqueeState: InfiniteCanvasState<ContractWindowKind> = {
    ...baseState,
    groups: [],
    history: { future: [], past: [] },
    interaction: {
      currentPointer: { x: 220, y: 160 },
      kind: "marquee",
      mode: "toggle",
      originPointer: { x: 20, y: 20 },
      originSelectionIds: [],
      pointerId: 1,
    },
  };
  const markup = renderWithStore(marqueeState, <InfiniteCanvasMarqueeOverlay />);

  expect(markup).toContain('data-slot="marquee"');
  expect(markup).toContain('data-mode="toggle"');
});

test("hud emits status, dock, groups, buttons, and the zoom readout", () => {
  const markup = renderWithStore(
    baseState,
    <InfiniteCanvasHud
      onPointerModeChange={() => undefined}
      pointerMode="pan"
      subtitle="Contract subtitle"
      title="Contract title"
      zoomPolicy={resolveInfiniteCanvasZoomPolicy()}
    />,
  );

  expect(markup).toContain('data-slot="hud"');
  expect(markup).toContain('data-slot="hud-status"');
  expect(markup).toContain('data-slot="hud-title"');
  expect(markup).toContain('data-slot="hud-subtitle"');
  expect(markup).toContain('data-slot="hud-dock"');
  expect(countOccurrences(markup, 'data-slot="hud-dock-item"')).toBe(1);

  expect(countOccurrences(markup, 'data-slot="hud-group"')).toBe(3);
  for (const group of ["camera", "pointer-mode", "zoom"]) {
    expect(markup).toContain(`data-group="${group}"`);
  }

  for (const action of [
    "center-active",
    "fit-all",
    "fit-selection",
    "pointer-marquee",
    "pointer-pan",
    "reset",
    "zoom-in",
    "zoom-out",
    "zoom-reset",
  ]) {
    expect(markup).toContain(`data-action="${action}"`);
  }
  expect(countOccurrences(markup, 'data-slot="hud-button"')).toBe(9);
  expect(markup).toContain('data-slot="hud-zoom-readout"');

  // The active pointer mode button carries data-active="".
  expect(markup).toContain('data-action="pointer-pan" data-active=""');
  expect(markup).not.toContain('data-action="pointer-marquee" data-active=""');
});
