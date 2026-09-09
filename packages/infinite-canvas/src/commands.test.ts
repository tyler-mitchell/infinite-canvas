import { expect, test } from "vite-plus/test";

import {
  DEFAULT_INFINITE_CANVAS_COMMAND_DESCRIPTORS,
  executeInfiniteCanvasCommand,
  getAvailableInfiniteCanvasContextualCommands,
  getInfiniteCanvasContextualCommands,
  isInfiniteCanvasCommandEnabled,
} from "./commands";
import { DEFAULT_INFINITE_CANVAS_ZOOM } from "./constants";
import { DEFAULT_INFINITE_CANVAS_GROUP_METRICS } from "./group-layout";
import type { InfiniteCanvasState } from "./types";

type CommandTestWindowKind = "demo";

const commandState: InfiniteCanvasState<CommandTestWindowKind> = {
  activeWindowId: "alpha",
  connections: [],
  camera: {
    center: {
      x: 0,
      y: 0,
    },
    zoom: 1,
  },
  activeWorkspaceId: null,
  viewportOccluders: [],
  groupMetrics: DEFAULT_INFINITE_CANVAS_GROUP_METRICS,
  groups: [],
  workspaces: [],
  history: { future: [], past: [] },
  interaction: null,
  selection: {
    anchorWindowId: "alpha",
    windowIds: ["alpha"],
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
        height: 220,
        width: 320,
        x: 100,
        y: 100,
      },
      title: "Alpha",
      zIndex: 1,
    },
  ],
};

test("contextual commands expose enabled state and command groups", () => {
  const commands = getInfiniteCanvasContextualCommands(commandState);
  const commandById = new Map(commands.map((command) => [command.id, command]));

  expect(commandById.get("selection.clear")).toMatchObject({
    enabled: true,
    group: "selection",
    label: "Clear Selection",
  });
  expect(commandById.get("view.fitAll")).toMatchObject({
    enabled: true,
    group: "view",
  });
  expect(commandById.get("window.nudge.left")).toMatchObject({
    enabled: true,
    group: "window",
  });
});

test("contextual commands treat non-window targets as selection", () => {
  const targetSelectedState: InfiniteCanvasState<CommandTestWindowKind> = {
    ...commandState,
    activeWindowId: null,
    selection: {
      anchorTarget: {
        id: "edge-1",
        kind: "dependency",
        type: "edge",
      },
      anchorWindowId: null,
      targets: [
        {
          id: "edge-1",
          kind: "dependency",
          type: "edge",
        },
      ],
      windowIds: [],
    },
  };
  const availableCommandIds = getAvailableInfiniteCanvasContextualCommands(targetSelectedState).map(
    (command) => command.id,
  );

  expect(availableCommandIds).toContain("desktop.cancel");
  expect(availableCommandIds).toContain("selection.clear");
  expect(availableCommandIds).not.toContain("window.nudge.left");
  expect(availableCommandIds).not.toContain("view.fitSelection");
});

const defaultChords = () =>
  DEFAULT_INFINITE_CANVAS_COMMAND_DESCRIPTORS.flatMap((descriptor) =>
    descriptor.hotkeys.map((hotkey) => ({
      chord: typeof hotkey === "string" ? hotkey : JSON.stringify(hotkey),
      id: descriptor.id,
    })),
  );

test("no two default descriptors bind the same chord", () => {
  const byChord = new Map<string, string[]>();

  for (const { chord, id } of defaultChords()) {
    byChord.set(chord, [...(byChord.get(chord) ?? []), id]);
  }

  expect([...byChord].filter(([, ids]) => ids.length > 1)).toEqual([]);
});

test("no default chord shadows a browser shortcut the page cannot cancel", () => {
  const reserved = defaultChords().filter(({ chord }) => {
    const isModDigit = /^Mod\+[0-9]$/.test(chord);
    const isModAltArrow = chord.startsWith("Mod+Alt+Arrow");

    return isModDigit || isModAltArrow;
  });

  expect(reserved).toEqual([]);
});

test("every declared command reaches the palette, with a group and a unique id", () => {
  const surfaced = new Map(
    getInfiniteCanvasContextualCommands(commandState).map((command) => [command.id, command]),
  );

  expect(surfaced.size).toBe(DEFAULT_INFINITE_CANVAS_COMMAND_DESCRIPTORS.length);

  for (const descriptor of DEFAULT_INFINITE_CANVAS_COMMAND_DESCRIPTORS) {
    const command = surfaced.get(descriptor.id);

    expect(command).toBeDefined();
    expect(command?.group.length ?? 0).toBeGreaterThan(0);
    expect(descriptor.label.length).toBeGreaterThan(0);
    expect(descriptor.description.length).toBeGreaterThan(0);
  }
});

test("closing and minimizing the active window act on it, and nothing else", () => {
  const closed = executeInfiniteCanvasCommand(commandState, { type: "activeWindow.close" });

  expect(closed.windows).toEqual([]);

  const minimized = executeInfiniteCanvasCommand(commandState, { type: "activeWindow.minimize" });

  expect(minimized.windows[0]?.mode).toBe("minimized");
  expect(minimized.activeWindowId).toBeNull();
});

test("maximize toggles back to the size the window had before", () => {
  const originalRect = commandState.windows[0]!.rect;
  const maximized = executeInfiniteCanvasCommand(commandState, {
    type: "activeWindow.toggleMaximized",
  });

  expect(maximized.windows[0]?.mode).toBe("maximized");
  expect(maximized.windows[0]?.rect).not.toEqual(originalRect);

  const restored = executeInfiniteCanvasCommand(maximized, {
    type: "activeWindow.toggleMaximized",
  });

  expect(restored.windows[0]?.mode).toBe("normal");
  expect(restored.windows[0]?.rect).toEqual(originalRect);
});

test("pinning toggles both ways", () => {
  const pinned = executeInfiniteCanvasCommand(commandState, {
    type: "activeWindow.togglePinned",
  });

  expect(pinned.windows[0]?.isPinned).toBe(true);
  expect(
    executeInfiniteCanvasCommand(pinned, { type: "activeWindow.togglePinned" }).windows[0]
      ?.isPinned,
  ).toBe(false);
});

test("a lifecycle verb is offered only when a window is active", () => {
  const empty = { ...commandState, activeWindowId: null };

  for (const type of [
    "activeWindow.close",
    "activeWindow.minimize",
    "activeWindow.toggleMaximized",
    "activeWindow.togglePinned",
  ] as const) {
    expect(isInfiniteCanvasCommandEnabled(commandState, { type })).toBe(true);
    expect(isInfiniteCanvasCommandEnabled(empty, { type })).toBe(false);
  }
});

test("panning moves the view in the direction named, at any zoom", () => {
  const panned = executeInfiniteCanvasCommand(commandState, {
    amountPx: 200,
    direction: "right",
    type: "view.pan",
  });

  expect(panned.camera.center.x).toBeGreaterThan(commandState.camera.center.x);
  expect(panned.camera.center.y).toBe(commandState.camera.center.y);

  expect(
    executeInfiniteCanvasCommand(commandState, { amountPx: 200, direction: "up", type: "view.pan" })
      .camera.center.y,
  ).toBeLessThan(commandState.camera.center.y);
});

test("a pan covers the same world distance per screen pixel at any zoom", () => {
  const near = executeInfiniteCanvasCommand(
    { ...commandState, camera: { ...commandState.camera, zoom: 2 } },
    { amountPx: 200, direction: "right", type: "view.pan" },
  );
  const far = executeInfiniteCanvasCommand(
    { ...commandState, camera: { ...commandState.camera, zoom: 0.5 } },
    { amountPx: 200, direction: "right", type: "view.pan" },
  );

  expect(near.camera.center.x - commandState.camera.center.x).toBe(100);
  expect(far.camera.center.x - commandState.camera.center.x).toBe(400);
});

test("zooming holds the centre of the viewport still", () => {
  const near = { ...commandState, camera: { ...commandState.camera, zoom: 2 } };
  const zoomed = executeInfiniteCanvasCommand(near, { factor: 1.25, type: "view.zoomBy" });

  expect(zoomed.camera.zoom).toBeCloseTo(2.5, 5);
  expect(zoomed.camera.center).toEqual(near.camera.center);
});

test("a zoom step is not offered once the policy's limit is reached", () => {
  const floored = { ...commandState, camera: { ...commandState.camera, zoom: 0.12 } };

  expect(isInfiniteCanvasCommandEnabled(floored, { factor: 0.8, type: "view.zoomBy" })).toBe(false);
  expect(isInfiniteCanvasCommandEnabled(floored, { factor: 1.25, type: "view.zoomBy" })).toBe(true);
});

test("enablement reads the zoom policy it is given, not the default", () => {
  const floored = { ...commandState, camera: { ...commandState.camera, zoom: 0.12 } };
  const deeper = { ...DEFAULT_INFINITE_CANVAS_ZOOM, minZoom: 0.01 };

  expect(isInfiniteCanvasCommandEnabled(floored, { factor: 0.8, type: "view.zoomBy" })).toBe(false);
  expect(
    isInfiniteCanvasCommandEnabled(floored, { factor: 0.8, type: "view.zoomBy" }, deeper),
  ).toBe(true);
});

test("the camera cannot be moved before the viewport has been measured", () => {
  const unmeasured = { ...commandState, viewport: { height: 0, width: 0 } };

  expect(
    isInfiniteCanvasCommandEnabled(unmeasured, {
      amountPx: 200,
      direction: "up",
      type: "view.pan",
    }),
  ).toBe(false);
  expect(isInfiniteCanvasCommandEnabled(unmeasured, { factor: 1.25, type: "view.zoomBy" })).toBe(
    false,
  );
});
