import { getSelectedWindowIds } from "./selection";
import { expect, test } from "vite-plus/test";

import { DEFAULT_INFINITE_CANVAS_SNAP_POLICY } from "./constants";
import { DEFAULT_INFINITE_CANVAS_GROUP_METRICS } from "./layout";
import { reduceInfiniteCanvasState } from "./operations";
import type { InfiniteCanvasSelectionTarget, InfiniteCanvasState } from "./types";

type TestWindowKind = "demo";

const baseState: InfiniteCanvasState<TestWindowKind> = {
  activeWindowId: "alpha",
  connections: [],
  camera: {
    center: {
      x: 0,
      y: 0,
    },
    zoom: 2,
  },
  activeWorkspaceId: null,
  groupMetrics: DEFAULT_INFINITE_CANVAS_GROUP_METRICS,
  groups: [],
  viewportOccluders: [],
  workspaces: [],
  interaction: null,
  selection: {
    anchorTarget: { type: "window" as const, id: "alpha" },
    targets: [{ type: "window" as const, id: "alpha" }],
  },
  snapPreview: null,
  viewport: {
    height: 600,
    width: 800,
  },
  viewportInsets: { bottom: 0, left: 0, right: 0, top: 0 },
  windows: [
    {
      id: "alpha",
      isPinned: false,
      kind: "demo",
      minSize: {
        height: 120,
        width: 160,
      },
      mode: "normal",
      rect: {
        height: 240,
        width: 320,
        x: 100,
        y: 120,
      },
      title: "Alpha",
      zIndex: 0,
    },
    {
      id: "bravo",
      isPinned: false,
      kind: "demo",
      minSize: {
        height: 120,
        width: 160,
      },
      mode: "normal",
      rect: {
        height: 240,
        width: 320,
        x: 500,
        y: 120,
      },
      title: "Bravo",
      zIndex: 1,
    },
  ],
};

const edgeSelectionTarget: InfiniteCanvasSelectionTarget = {
  id: "alpha-to-bravo",
  kind: "dependency",
  type: "edge",
};

test.each(["add", "toggle"] as const)(
  "%s marquee retains selected groups and external targets",
  (mode) => {
    const grouped = reduceInfiniteCanvasState(baseState, {
      type: "group.create",
      groupId: "collection",
      windowIds: ["bravo"],
      rect: { x: 500, y: 120, width: 320, height: 240 },
    });
    const targets: readonly InfiniteCanvasSelectionTarget[] = [
      { id: "collection", kind: "group", type: "group" },
      edgeSelectionTarget,
    ];
    const selected = reduceInfiniteCanvasState(grouped, { type: "selection.replace", targets });
    const started = reduceInfiniteCanvasState(selected, {
      type: "interaction.startMarquee",
      mode,
      pointerId: 1,
      point: { x: 580, y: 520 },
    });
    const stepped = reduceInfiniteCanvasState(started, {
      type: "interaction.step",
      pointerId: 1,
      point: { x: 660, y: 600 },
    });
    expect(getSelectedWindowIds(stepped.selection)).toEqual(["alpha"]);
    expect(stepped.selection.targets).toEqual([...targets, { type: "window", id: "alpha" }]);
    const repeated = reduceInfiniteCanvasState(stepped, {
      type: "interaction.step",
      pointerId: 1,
      point: { x: 660, y: 600 },
    });
    expect(repeated.selection).toEqual(stepped.selection);
    const withdrawn = reduceInfiniteCanvasState(repeated, {
      type: "interaction.step",
      pointerId: 1,
      point: { x: 582, y: 522 },
    });
    expect(withdrawn.selection).toEqual(selected.selection);
  },
);

test("window move interaction derives rects from captured origin state", () => {
  const started = reduceInfiniteCanvasState(baseState, {
    point: {
      x: 20,
      y: 30,
    },
    pointerId: 7,
    type: "interaction.startMove",
    target: { type: "window", id: "alpha" },
  });
  const moved = reduceInfiniteCanvasState(started, {
    point: {
      x: 80,
      y: -80,
    },
    pointerId: 7,
    type: "interaction.step",
  });
  const alpha = moved.windows.find((window) => window.id === "alpha");

  expect(alpha?.rect.x).toBe(130);
  expect(alpha?.rect.y).toBe(65);
  expect(moved.activeWindowId).toBe("alpha");
});

test("dragging one selected window moves the whole selection as one group", () => {
  const multiSelected = reduceInfiniteCanvasState(baseState, {
    type: "selection.add",
    targets: [{ type: "window" as const, id: "bravo" }],
  });
  const started = reduceInfiniteCanvasState(multiSelected, {
    point: {
      x: 20,
      y: 30,
    },
    pointerId: 17,
    type: "interaction.startMove",
    target: { type: "window", id: "alpha" },
  });
  const moved = reduceInfiniteCanvasState(started, {
    point: {
      x: 80,
      y: -80,
    },
    pointerId: 17,
    type: "interaction.step",
  });
  const alpha = moved.windows.find((window) => window.id === "alpha");
  const bravo = moved.windows.find((window) => window.id === "bravo");

  expect(alpha?.rect.x).toBe(130);
  expect(alpha?.rect.y).toBe(65);
  expect(bravo?.rect.x).toBe(530);
  expect(bravo?.rect.y).toBe(65);
  expect(moved.selection).toEqual({
    anchorTarget: { type: "window" as const, id: "alpha" },
    targets: [
      { type: "window" as const, id: "alpha" },
      { type: "window" as const, id: "bravo" },
    ],
  });
  expect(moved.activeWindowId).toBe("alpha");
});

test("dragging an unselected window replaces selection and moves only that window", () => {
  const started = reduceInfiniteCanvasState(baseState, {
    point: {
      x: 20,
      y: 30,
    },
    pointerId: 18,
    type: "interaction.startMove",
    target: { type: "window", id: "bravo" },
  });
  const moved = reduceInfiniteCanvasState(started, {
    point: {
      x: 80,
      y: -80,
    },
    pointerId: 18,
    type: "interaction.step",
  });
  const alpha = moved.windows.find((window) => window.id === "alpha");
  const bravo = moved.windows.find((window) => window.id === "bravo");

  expect(alpha?.rect).toEqual(baseState.windows[0]?.rect);
  expect(bravo?.rect.x).toBe(530);
  expect(bravo?.rect.y).toBe(65);
  expect(moved.selection).toEqual({
    anchorTarget: { type: "window" as const, id: "bravo" },
    targets: [{ type: "window" as const, id: "bravo" }],
  });
});

test("resize interaction respects minimum size", () => {
  const started = reduceInfiniteCanvasState(baseState, {
    handle: "west",
    point: {
      x: 0,
      y: 0,
    },
    pointerId: 9,
    type: "interaction.startResize",
    windowId: "alpha",
  });
  const resized = reduceInfiniteCanvasState(started, {
    point: {
      x: 500,
      y: 0,
    },
    pointerId: 9,
    type: "interaction.step",
  });
  const alpha = resized.windows.find((window) => window.id === "alpha");

  expect(alpha?.rect.width).toBe(160);
  expect(alpha?.rect.x).toBe(260);
});

test("pan interaction moves the camera from the captured origin", () => {
  const started = reduceInfiniteCanvasState(baseState, {
    point: {
      x: 120,
      y: 80,
    },
    pointerId: 10,
    type: "interaction.startPan",
  });
  const panned = reduceInfiniteCanvasState(started, {
    point: {
      x: 180,
      y: 20,
    },
    pointerId: 10,
    type: "interaction.step",
  });

  expect(panned.camera.center).toEqual({
    x: -30,
    y: 30,
  });
});

test("screen-delta pan moves the camera like a scrollable surface", () => {
  const panned = reduceInfiniteCanvasState(baseState, {
    delta: {
      x: 40,
      y: -20,
    },
    type: "camera.panBy",
  });

  expect(panned.camera.center).toEqual({
    x: 20,
    y: -10,
  });
  expect(panned.selection).toEqual(baseState.selection);
});

test("pan interaction preserves selection because marquee owns empty-canvas selection", () => {
  const started = reduceInfiniteCanvasState(baseState, {
    point: {
      x: 120,
      y: 80,
    },
    pointerId: 11,
    type: "interaction.startPan",
  });

  expect(started.activeWindowId).toBe("alpha");
  expect(started.selection).toEqual(baseState.selection);
  expect(started.interaction?.kind).toBe("pan");
});

test("pan interaction can opt into clearing selection for drag-to-pan input policies", () => {
  const started = reduceInfiniteCanvasState(baseState, {
    clearSelection: true,
    point: {
      x: 120,
      y: 80,
    },
    pointerId: 12,
    type: "interaction.startPan",
  });

  expect(started.activeWindowId).toBe(null);
  expect(started.selection).toEqual({ anchorTarget: null, targets: [] });
  expect(started.interaction?.kind).toBe("pan");
});

test("marquee replace clears selection on press and selects intersecting windows while dragging", () => {
  const started = reduceInfiniteCanvasState(baseState, {
    mode: "replace",
    point: {
      x: 580,
      y: 520,
    },
    pointerId: 19,
    type: "interaction.startMarquee",
  });
  const dragged = reduceInfiniteCanvasState(started, {
    point: {
      x: 900,
      y: 720,
    },
    pointerId: 19,
    type: "interaction.step",
  });

  expect(started.selection).toEqual({ anchorTarget: null, targets: [] });
  expect(dragged.selection).toEqual({
    anchorTarget: { type: "window" as const, id: "alpha" },
    targets: [{ type: "window" as const, id: "alpha" }],
  });
  expect(dragged.interaction?.kind).toBe("marquee");
});

test("marquee add and toggle derive selection from the original selection snapshot", () => {
  const added = reduceInfiniteCanvasState(
    reduceInfiniteCanvasState(baseState, {
      mode: "add",
      point: {
        x: 1380,
        y: 520,
      },
      pointerId: 20,
      type: "interaction.startMarquee",
    }),
    {
      point: {
        x: 1800,
        y: 900,
      },
      pointerId: 20,
      type: "interaction.step",
    },
  );
  const toggledOff = reduceInfiniteCanvasState(
    reduceInfiniteCanvasState(baseState, {
      mode: "toggle",
      point: {
        x: 580,
        y: 520,
      },
      pointerId: 21,
      type: "interaction.startMarquee",
    }),
    {
      point: {
        x: 900,
        y: 720,
      },
      pointerId: 21,
      type: "interaction.step",
    },
  );

  expect(added.selection).toEqual({
    anchorTarget: { type: "window" as const, id: "bravo" },
    targets: [
      { type: "window" as const, id: "alpha" },
      { type: "window" as const, id: "bravo" },
    ],
  });
  expect(toggledOff.selection).toEqual({ anchorTarget: null, targets: [] });
});

test("selection actions normalize visible known window ids", () => {
  const minimized = reduceInfiniteCanvasState(baseState, {
    type: "window.minimize",
    windowId: "bravo",
  });
  const selected = reduceInfiniteCanvasState(minimized, {
    type: "selection.replace",
    targets: [
      { type: "window" as const, id: "missing" },
      { type: "window" as const, id: "alpha" },
      { type: "window" as const, id: "alpha" },
      { type: "window" as const, id: "bravo" },
    ],
  });

  expect(selected.selection).toEqual({
    anchorTarget: { type: "window" as const, id: "alpha" },
    targets: [{ type: "window" as const, id: "alpha" }],
  });
  expect(selected.activeWindowId).toBe("alpha");
});

test("selection add remove toggle and clear stay aligned with active window", () => {
  const added = reduceInfiniteCanvasState(baseState, {
    type: "selection.add",
    targets: [{ type: "window" as const, id: "bravo" }],
  });
  const toggled = reduceInfiniteCanvasState(added, {
    type: "selection.toggle",
    targets: [{ type: "window" as const, id: "alpha" }],
  });
  const cleared = reduceInfiniteCanvasState(toggled, {
    type: "selection.clear",
  });

  expect(added.selection).toEqual({
    anchorTarget: { type: "window" as const, id: "bravo" },
    targets: [
      { type: "window" as const, id: "alpha" },
      { type: "window" as const, id: "bravo" },
    ],
  });
  expect(added.activeWindowId).toBe("bravo");
  expect(toggled.selection).toEqual({
    anchorTarget: { type: "window" as const, id: "bravo" },
    targets: [{ type: "window" as const, id: "bravo" }],
  });
  expect(toggled.activeWindowId).toBe("bravo");
  expect(getSelectedWindowIds(cleared.selection)).toEqual([]);
  expect(cleared.activeWindowId).toBe(null);
});

test("selection target actions support scene-object and edge selection", () => {
  const selectedEdge = reduceInfiniteCanvasState(baseState, {
    targets: [edgeSelectionTarget],
    type: "selection.replace",
  });
  const addedWindow = reduceInfiniteCanvasState(selectedEdge, {
    type: "selection.add",
    targets: [{ type: "window" as const, id: "bravo" }],
  });
  const toggledEdge = reduceInfiniteCanvasState(addedWindow, {
    targets: [edgeSelectionTarget],
    type: "selection.toggle",
  });
  const cleared = reduceInfiniteCanvasState(addedWindow, {
    type: "selection.clear",
  });

  expect(selectedEdge.selection).toEqual({
    anchorTarget: edgeSelectionTarget,
    targets: [edgeSelectionTarget],
  });
  expect(selectedEdge.activeWindowId).toBe(null);
  expect(addedWindow.selection).toEqual({
    anchorTarget: { type: "window", id: "bravo" },
    targets: [edgeSelectionTarget, { type: "window", id: "bravo" }],
  });
  expect(addedWindow.activeWindowId).toBe("bravo");
  expect(toggledEdge.selection).toEqual({
    anchorTarget: { type: "window" as const, id: "bravo" },
    targets: [{ type: "window" as const, id: "bravo" }],
  });
  expect(cleared.selection).toEqual({ anchorTarget: null, targets: [] });
});

test("selection distinguishes object types with the same id", () => {
  const window = { type: "window", id: "alpha" } as const;
  const edge = { type: "edge", kind: "dependency", id: "alpha" } as const;
  const selected = reduceInfiniteCanvasState(baseState, {
    type: "selection.set",
    selection: { anchorTarget: window, targets: [window, edge, window] },
  });
  expect(selected.selection.targets).toEqual([window, edge]);
  expect(selected.activeWindowId).toBe("alpha");
  const closed = reduceInfiniteCanvasState(selected, { type: "window.close", windowId: "alpha" });
  expect(closed.selection).toEqual({ anchorTarget: edge, targets: [edge] });
  expect(closed.activeWindowId).toBeNull();
});

test("select all visible skips minimized windows", () => {
  const minimized = reduceInfiniteCanvasState(baseState, {
    type: "window.minimize",
    windowId: "bravo",
  });
  const selected = reduceInfiniteCanvasState(minimized, {
    type: "selection.selectAllVisible",
  });

  expect(selected.selection).toEqual({
    anchorTarget: { type: "window" as const, id: "alpha" },
    targets: [{ type: "window" as const, id: "alpha" }],
  });
});

test("pinning moves a window into the always-on-top band without hiding focus", () => {
  const next = reduceInfiniteCanvasState(baseState, {
    type: "window.togglePinned",
    windowId: "alpha",
  });
  const alpha = next.windows.find((window) => window.id === "alpha");

  expect(alpha?.isPinned).toBe(true);
  expect(alpha?.zIndex).toBe(0);
  expect(next.activeWindowId).toBe("alpha");
});

test("minimizing active window promotes the next visible stacked window", () => {
  const next = reduceInfiniteCanvasState(baseState, {
    type: "window.minimize",
    windowId: "alpha",
  });
  const alpha = next.windows.find((window) => window.id === "alpha");

  expect(alpha?.mode).toBe("minimized");
  expect(next.activeWindowId).toBe("bravo");
  expect(next.selection).toEqual({
    anchorTarget: { type: "window" as const, id: "bravo" },
    targets: [{ type: "window" as const, id: "bravo" }],
  });
});

test("maximize and restore preserve the original rect", () => {
  const maximized = reduceInfiniteCanvasState(baseState, {
    type: "window.maximize",
    windowId: "alpha",
  });
  const maximizedAlpha = maximized.windows.find((window) => window.id === "alpha");
  const restored = reduceInfiniteCanvasState(maximized, {
    type: "window.restore",
    windowId: "alpha",
  });
  const restoredAlpha = restored.windows.find((window) => window.id === "alpha");

  expect(maximizedAlpha?.mode).toBe("maximized");
  expect(maximizedAlpha?.restoreRect).toEqual(baseState.windows[0]?.rect);
  expect(restoredAlpha?.mode).toBe("normal");
  expect(restoredAlpha?.rect).toEqual(baseState.windows[0]?.rect);
});

test("opening and closing windows updates focus through the lifecycle API", () => {
  const opened = reduceInfiniteCanvasState(baseState, {
    type: "window.open",
    window: {
      id: "charlie",
      isPinned: false,
      kind: "demo",
      minSize: {
        height: 120,
        width: 160,
      },
      mode: "normal",
      rect: {
        height: 200,
        width: 260,
        x: 0,
        y: 0,
      },
      title: "Charlie",
      zIndex: 0,
    },
  });
  const closed = reduceInfiniteCanvasState(opened, {
    type: "window.close",
    windowId: "charlie",
  });

  expect(opened.activeWindowId).toBe("charlie");
  expect(opened.selection).toEqual({
    anchorTarget: { type: "window" as const, id: "charlie" },
    targets: [{ type: "window" as const, id: "charlie" }],
  });
  expect(opened.windows).toHaveLength(3);
  expect(closed.activeWindowId).toBe("bravo");
  expect(closed.selection).toEqual({
    anchorTarget: { type: "window" as const, id: "bravo" },
    targets: [{ type: "window" as const, id: "bravo" }],
  });
  expect(closed.windows).toHaveLength(2);
});

test("reset restores a fresh baseline while preserving the measured viewport", () => {
  const closed = reduceInfiniteCanvasState(baseState, {
    type: "window.close",
    windowId: "alpha",
  });
  const reset = reduceInfiniteCanvasState(
    closed,
    {
      type: "desktop.reset",
    },
    { initialState: baseState },
  );

  expect(reset).not.toBe(baseState);
  expect(reset.windows).not.toBe(baseState.windows);
  expect(reset.windows).toEqual(baseState.windows);
  expect(reset.viewport).toEqual(baseState.viewport);
  expect(reset.selection).toEqual(baseState.selection);
});

test("command execution nudges the current selection through screen-pixel deltas", () => {
  const multiSelected = reduceInfiniteCanvasState(baseState, {
    type: "selection.add",
    targets: [{ type: "window" as const, id: "bravo" }],
  });
  const nudged = reduceInfiniteCanvasState(multiSelected, {
    amountPx: 10,
    direction: "right",
    type: "window.nudge",
  });

  expect(nudged.windows.find((window) => window.id === "alpha")?.rect.x).toBe(105);
  expect(nudged.windows.find((window) => window.id === "bravo")?.rect.x).toBe(505);
});

test("fit selection centers and scales the camera around selected bounds", () => {
  const fitted = reduceInfiniteCanvasState(baseState, { type: "view.fitSelection" });

  expect(fitted.camera.center).toEqual({
    x: 260,
    y: 240,
  });
  expect(fitted.camera.zoom).toBeCloseTo(11 / 6);
});

test("fit all centers and scales the camera around visible window bounds", () => {
  const fitted = reduceInfiniteCanvasState(baseState, { type: "view.fitAll" });

  expect(fitted.camera.center).toEqual({
    x: 460,
    y: 240,
  });
  expect(fitted.camera.zoom).toBeCloseTo(8 / 9);
});

test("camera navigation centers a target window while preserving zoom", () => {
  const navigated = reduceInfiniteCanvasState(baseState, {
    request: {
      target: {
        type: "window",
        windowId: "bravo",
      },
    },
    type: "camera.navigate",
  });

  expect(navigated.camera.center).toEqual({
    x: 660,
    y: 240,
  });
  expect(navigated.camera.zoom).toBe(2);
});

test("view navigation can center a target window at an explicit zoom", () => {
  const navigated = reduceInfiniteCanvasState(baseState, {
    request: {
      behavior: {
        type: "centerAtZoom",
        zoom: 1.25,
      },
      target: {
        type: "window",
        windowId: "bravo",
      },
    },
    type: "camera.navigate",
  });

  expect(navigated.camera.center).toEqual({
    x: 660,
    y: 240,
  });
  expect(navigated.camera.zoom).toBe(1.25);
});

test("view navigation can target an explicit world rect", () => {
  const navigated = reduceInfiniteCanvasState(baseState, {
    request: {
      behavior: {
        type: "centerAtZoom",
        zoom: 0.5,
      },
      target: {
        rect: {
          height: 100,
          width: 200,
          x: -100,
          y: 20,
        },
        type: "rect",
      },
    },
    type: "camera.navigate",
  });

  expect(navigated.camera.center).toEqual({
    x: 0,
    y: 70,
  });
  expect(navigated.camera.zoom).toBe(0.5);
});

test("view navigation can target an explicit world point", () => {
  const navigated = reduceInfiniteCanvasState(baseState, {
    request: {
      behavior: {
        type: "centerAtZoom",
        zoom: 1.4,
      },
      target: {
        point: {
          x: 120,
          y: -60,
        },
        type: "point",
      },
    },
    type: "camera.navigate",
  });

  expect(navigated.camera.center).toEqual({
    x: 120,
    y: -60,
  });
  expect(navigated.camera.zoom).toBe(1.4);
});

test("view navigation can fit a target window", () => {
  const navigated = reduceInfiniteCanvasState(baseState, {
    request: {
      behavior: {
        type: "fit",
      },
      target: {
        type: "window",
        windowId: "bravo",
      },
    },
    type: "camera.navigate",
  });

  expect(navigated.camera.center).toEqual({
    x: 660,
    y: 240,
  });
  expect(navigated.camera.zoom).toBeCloseTo(11 / 6);
});

test("camera navigation ignores minimized target windows", () => {
  const minimizedState: InfiniteCanvasState<TestWindowKind> = {
    ...baseState,
    windows: baseState.windows.map((window) =>
      window.id === "bravo"
        ? {
            ...window,
            mode: "minimized",
          }
        : window,
    ),
  };
  const navigated = reduceInfiniteCanvasState(minimizedState, {
    request: {
      target: {
        type: "window",
        windowId: "bravo",
      },
    },
    type: "camera.navigate",
  });

  expect(navigated).toBe(minimizedState);
});

test("desktop cancel clears interaction before clearing selection", () => {
  const started = reduceInfiniteCanvasState(baseState, {
    point: {
      x: 20,
      y: 30,
    },
    pointerId: 27,
    type: "interaction.startMove",
    target: { type: "window", id: "alpha" },
  });
  const canceledInteraction = reduceInfiniteCanvasState(started, { type: "desktop.cancel" });
  const canceledSelection = reduceInfiniteCanvasState(canceledInteraction, {
    type: "desktop.cancel",
  });

  expect(canceledInteraction.interaction).toBe(null);
  expect(getSelectedWindowIds(canceledInteraction.selection)).toEqual(["alpha"]);
  expect(getSelectedWindowIds(canceledSelection.selection)).toEqual([]);
  expect(canceledSelection.activeWindowId).toBe(null);
});

test("desktop cancel clears non-window selection targets", () => {
  const selectedEdge = reduceInfiniteCanvasState(baseState, {
    targets: [edgeSelectionTarget],
    type: "selection.replace",
  });
  const canceledSelection = reduceInfiniteCanvasState(selectedEdge, { type: "desktop.cancel" });

  expect(canceledSelection.selection).toEqual({ anchorTarget: null, targets: [] });
});

test("move interaction snaps to nearby window edges and exposes a preview", () => {
  const started = reduceInfiniteCanvasState(baseState, {
    point: {
      x: 0,
      y: 0,
    },
    pointerId: 12,
    type: "interaction.startMove",
    target: { type: "window", id: "alpha" },
  });
  const moved = reduceInfiniteCanvasState(started, {
    point: {
      x: 160,
      y: 0,
    },
    pointerId: 12,
    type: "interaction.step",
  });
  const alpha = moved.windows.find((window) => window.id === "alpha");
  const alphaRight = alpha === undefined ? null : alpha.rect.x + alpha.rect.width;

  expect(alpha?.rect.x).toBe(180);
  expect(alphaRight).toBe(500);
  expect(moved.snapPreview?.target).toEqual({ type: "window", id: "alpha" });
  expect(moved.snapPreview?.guides[0]?.from).toBe("window");
  expect(moved.snapPreview?.guides[0]?.windowIds).toEqual(["bravo"]);
  const closed = reduceInfiniteCanvasState(moved, { type: "window.close", windowId: "bravo" });
  expect(closed.snapPreview).toBeNull();
  expect(closed.interaction?.kind).toBe("move");
});

test("move snapping uses screen-pixel thresholds across zoom levels", () => {
  const highZoomState: InfiniteCanvasState<TestWindowKind> = {
    ...baseState,
    camera: {
      ...baseState.camera,
      zoom: 4,
    },
    windows: baseState.windows.map((window) =>
      window.id === "bravo"
        ? {
            ...window,
            rect: {
              ...window.rect,
              y: 420,
            },
          }
        : window,
    ),
  };
  const started = reduceInfiniteCanvasState(highZoomState, {
    point: {
      x: 0,
      y: 0,
    },
    pointerId: 13,
    type: "interaction.startMove",
    target: { type: "window", id: "alpha" },
  });
  const outsideThreshold = reduceInfiniteCanvasState(started, {
    point: {
      x: 288,
      y: 0,
    },
    pointerId: 13,
    type: "interaction.step",
  });
  const insideThreshold = reduceInfiniteCanvasState(started, {
    point: {
      x: 312,
      y: 0,
    },
    pointerId: 13,
    type: "interaction.step",
  });
  const outsideAlpha = outsideThreshold.windows.find((window) => window.id === "alpha");
  const insideAlpha = insideThreshold.windows.find((window) => window.id === "alpha");

  expect(outsideAlpha?.rect.x).toBe(172);
  expect(outsideThreshold.snapPreview).toBe(null);
  expect(insideAlpha?.rect.x).toBe(180);
  expect(insideThreshold.snapPreview?.guides[0]?.kind).toBe("edge");
});

test("viewport snapping is opt-in because the viewport frame is not a world object", () => {
  const singleWindowState: InfiniteCanvasState<TestWindowKind> = {
    ...baseState,
    camera: {
      ...baseState.camera,
      zoom: 1,
    },
    windows: [baseState.windows[0]!],
  };
  const started = reduceInfiniteCanvasState(singleWindowState, {
    point: {
      x: 0,
      y: 0,
    },
    pointerId: 19,
    type: "interaction.startMove",
    target: { type: "window", id: "alpha" },
  });
  const defaultMoved = reduceInfiniteCanvasState(started, {
    point: {
      x: -51,
      y: 0,
    },
    pointerId: 19,
    type: "interaction.step",
  });
  const optInMoved = reduceInfiniteCanvasState(started, {
    point: {
      x: -51,
      y: 0,
    },
    pointerId: 19,
    snapPolicy: {
      ...DEFAULT_INFINITE_CANVAS_SNAP_POLICY,
      snapToViewport: true,
    },
    type: "interaction.step",
  });

  expect(defaultMoved.windows.find((window) => window.id === "alpha")?.rect.x).toBe(49);
  expect(defaultMoved.snapPreview).toBe(null);
  expect(optInMoved.windows.find((window) => window.id === "alpha")?.rect.x).toBe(48);
  expect(optInMoved.snapPreview?.guides[0]?.from).toBe("viewport");
});

test("move snapping can align window centers without edge snapping", () => {
  const centerState: InfiniteCanvasState<TestWindowKind> = {
    ...baseState,
    windows: baseState.windows.map((window) =>
      window.id === "bravo"
        ? {
            ...window,
            rect: {
              height: 220,
              width: 200,
              x: 900,
              y: 420,
            },
          }
        : window,
    ),
  };
  const started = reduceInfiniteCanvasState(centerState, {
    point: {
      x: 0,
      y: 0,
    },
    pointerId: 14,
    type: "interaction.startMove",
    target: { type: "window", id: "alpha" },
  });
  const moved = reduceInfiniteCanvasState(started, {
    point: {
      x: 1474,
      y: 0,
    },
    pointerId: 14,
    type: "interaction.step",
  });
  const alpha = moved.windows.find((window) => window.id === "alpha");

  expect(alpha?.rect.x).toBe(840);
  expect(moved.snapPreview?.guides.some((guide) => guide.kind === "center")).toBe(true);
});

test("move snapping shows both horizontal rails for equal-width edge alignment", () => {
  const equalWidthState: InfiniteCanvasState<TestWindowKind> = {
    ...baseState,
    windows: baseState.windows.map((window) =>
      window.id === "bravo"
        ? {
            ...window,
            rect: {
              ...window.rect,
              y: 420,
            },
          }
        : window,
    ),
  };
  const started = reduceInfiniteCanvasState(equalWidthState, {
    point: {
      x: 0,
      y: 0,
    },
    pointerId: 17,
    type: "interaction.startMove",
    target: { type: "window", id: "alpha" },
  });
  const moved = reduceInfiniteCanvasState(started, {
    point: {
      x: 800,
      y: 0,
    },
    pointerId: 17,
    type: "interaction.step",
  });
  const xGuides =
    moved.snapPreview?.guides.filter((guide) => guide.axis === "x" && guide.kind === "edge") ?? [];

  expect(moved.windows.find((window) => window.id === "alpha")?.rect.x).toBe(500);
  expect(xGuides.map((guide) => guide.sourceAnchor)).toEqual(["left", "right"]);
});

test("move snapping shows both vertical rails for equal-height edge alignment", () => {
  const equalHeightState: InfiniteCanvasState<TestWindowKind> = {
    ...baseState,
    windows: baseState.windows.map((window) =>
      window.id === "bravo"
        ? {
            ...window,
            rect: {
              ...window.rect,
              x: 800,
              y: 400,
            },
          }
        : window,
    ),
  };
  const started = reduceInfiniteCanvasState(equalHeightState, {
    point: {
      x: 0,
      y: 0,
    },
    pointerId: 18,
    type: "interaction.startMove",
    target: { type: "window", id: "alpha" },
  });
  const moved = reduceInfiniteCanvasState(started, {
    point: {
      x: 0,
      y: 560,
    },
    pointerId: 18,
    type: "interaction.step",
  });
  const yGuides =
    moved.snapPreview?.guides.filter((guide) => guide.axis === "y" && guide.kind === "edge") ?? [];

  expect(moved.windows.find((window) => window.id === "alpha")?.rect.y).toBe(400);
  expect(yGuides.map((guide) => guide.sourceAnchor)).toEqual(["top", "bottom"]);
});

test("move snapping can align equal gaps between neighboring windows", () => {
  const gapState: InfiniteCanvasState<TestWindowKind> = {
    ...baseState,
    activeWindowId: "alpha",
    windows: [
      {
        ...baseState.windows[0]!,
        id: "left",
        rect: {
          height: 100,
          width: 100,
          x: 0,
          y: 0,
        },
        title: "Left",
      },
      {
        ...baseState.windows[0]!,
        id: "alpha",
        rect: {
          height: 100,
          width: 100,
          x: 120,
          y: 0,
        },
        title: "Alpha",
      },
      {
        ...baseState.windows[1]!,
        id: "right",
        rect: {
          height: 100,
          width: 100,
          x: 300,
          y: 0,
        },
        title: "Right",
      },
    ],
  };
  const started = reduceInfiniteCanvasState(gapState, {
    point: {
      x: 0,
      y: 0,
    },
    pointerId: 15,
    type: "interaction.startMove",
    target: { type: "window", id: "alpha" },
  });
  const moved = reduceInfiniteCanvasState(started, {
    point: {
      x: 52,
      y: 0,
    },
    pointerId: 15,
    type: "interaction.step",
  });
  const alpha = moved.windows.find((window) => window.id === "alpha");

  expect(alpha?.rect.x).toBe(150);
  expect(moved.snapPreview?.guides.some((guide) => guide.kind === "gap")).toBe(true);
  const guide = moved.snapPreview?.guides.find((guide) => guide.kind === "gap");
  expect(guide?.windowIds).toHaveLength(2);
  const closed = reduceInfiniteCanvasState(moved, {
    type: "window.close",
    windowId: guide!.windowIds[0]!,
  });
  expect(closed.snapPreview).toBeNull();
});

test("resize snapping only adjusts the active edge", () => {
  const started = reduceInfiniteCanvasState(baseState, {
    handle: "east",
    point: {
      x: 0,
      y: 0,
    },
    pointerId: 16,
    type: "interaction.startResize",
    windowId: "alpha",
  });
  const resized = reduceInfiniteCanvasState(started, {
    point: {
      x: 152,
      y: 0,
    },
    pointerId: 16,
    type: "interaction.step",
  });
  const alpha = resized.windows.find((window) => window.id === "alpha");

  expect(alpha?.rect.x).toBe(100);
  expect(alpha?.rect.width).toBe(400);
  expect(resized.snapPreview?.guides[0]?.sourceAnchor).toBe("right");
});
