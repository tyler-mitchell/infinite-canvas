import { expect, test } from "vite-plus/test";

import {
  DEFAULT_INFINITE_CANVAS_COMMAND_DESCRIPTORS,
  executeInfiniteCanvasCommand,
  getAvailableInfiniteCanvasContextualCommands,
  getInfiniteCanvasContextualCommands,
  isInfiniteCanvasCommandEnabled,
} from "./commands";
import { DEFAULT_INFINITE_CANVAS_ZOOM } from "./constants";
import type { InfiniteCanvasState } from "./types";

type CommandTestWindowKind = "demo";

const commandState: InfiniteCanvasState<CommandTestWindowKind> = {
  activeWindowId: "alpha",
  camera: {
    center: {
      x: 0,
      y: 0,
    },
    zoom: 1,
  },
  groups: [],
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

/**
 * Default-chord safety, as machine checks rather than as a rule people remember.
 *
 * This project has shipped a chord collision twice. `Mod+Alt+Arrow` switches browser tabs on
 * macOS and is not page-cancellable, so binding it would have switched the tab *and* moved the
 * window; `Mod+0` is the browser's zoom reset, so it reset the page zoom *and* the canvas. Both
 * were caught by audit, one of them only after shipping.
 *
 * The rule they taught — a default chord that shadows a browser shortcut is theft, not a
 * nuisance, because `registerInfiniteCanvasHotkeys` `preventDefault()`s every chord it owns — was
 * written into a comment above the descriptors. A comment does not fail a build.
 */

const defaultChords = () =>
  DEFAULT_INFINITE_CANVAS_COMMAND_DESCRIPTORS.flatMap((descriptor) =>
    descriptor.hotkeys.map((hotkey) => ({
      chord: typeof hotkey === "string" ? hotkey : JSON.stringify(hotkey),
      id: descriptor.id,
    })),
  );

test("no two default descriptors bind the same chord", () => {
  // A collision means one command is unreachable and which one wins is registration order — the
  // kind of thing that is invisible until a user reports that a shortcut "stopped working".
  const byChord = new Map<string, string[]>();

  for (const { chord, id } of defaultChords()) {
    byChord.set(chord, [...(byChord.get(chord) ?? []), id]);
  }

  expect([...byChord].filter(([, ids]) => ids.length > 1)).toEqual([]);
});

test("no default chord shadows a browser shortcut the page cannot cancel", () => {
  // The two families that actually bit, encoded so a third cannot be introduced silently.
  // `Mod` with a digit is the browser's zoom family (reset / in / out); `Mod+Alt+Arrow` is tab
  // switching on macOS. Neither is cancellable from the page, so owning them is theft.
  const reserved = defaultChords().filter(({ chord }) => {
    const isModDigit = /^Mod\+[0-9]$/.test(chord);
    const isModAltArrow = chord.startsWith("Mod+Alt+Arrow");

    return isModDigit || isModAltArrow;
  });

  expect(reserved).toEqual([]);
});

test("every declared command reaches the palette, with a group and a unique id", () => {
  // A descriptor whose command type no longer exists is a dead key: the canvas swallows the
  // chord — it owns it — and then does nothing, which reads as a broken shortcut rather than an
  // absent one.
  //
  // This test was tautological until 2026-08-12: it built its `executable` set *from* the same
  // descriptor list it then checked against, so it passed for any descriptor whatsoever and
  // asserted nothing about reachability. Adding `window.swap` proved the gap — the function
  // was absent from the barrel and every test still passed. What follows crosses the boundary
  // instead, asking the surface a consumer actually reads.
  const surfaced = new Map(
    getInfiniteCanvasContextualCommands(commandState).map((command) => [command.id, command]),
  );

  expect(surfaced.size).toBe(DEFAULT_INFINITE_CANVAS_COMMAND_DESCRIPTORS.length);

  for (const descriptor of DEFAULT_INFINITE_CANVAS_COMMAND_DESCRIPTORS) {
    const command = surfaced.get(descriptor.id);

    // An unsurfaced command is unreachable from the palette however well its reducer case works.
    expect(command).toBeDefined();
    // `getInfiniteCanvasCommandGroup` is an exhaustive switch, so a missing group means a new
    // command type slipped past it and the palette would render it under no heading.
    expect(command?.group.length ?? 0).toBeGreaterThan(0);
    expect(descriptor.label.length).toBeGreaterThan(0);
    expect(descriptor.description.length).toBeGreaterThan(0);
  }
});

/**
 * Lifecycle verbs, executed rather than merely declared.
 *
 * `command-coverage.test.ts` asserts these exist in the registry; that is a different claim
 * from their doing anything. The toggles are the interesting half — the maximize/restore
 * rule used to live inside the chrome button in `frame-slots.tsx`, where no consumer
 * replacing the header could reuse it.
 */

test("closing and minimizing the active window act on it, and nothing else", () => {
  const closed = executeInfiniteCanvasCommand(commandState, { type: "activeWindow.close" });

  expect(closed.windows).toEqual([]);

  const minimized = executeInfiniteCanvasCommand(commandState, { type: "activeWindow.minimize" });

  expect(minimized.windows[0]?.mode).toBe("minimized");
  // Minimizing hands the active id to the next visible window, and there is none here. That
  // is precisely why no `activeWindow.restore` exists: it could never be enabled.
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

  // The rule the chrome button encoded inline: maximized restores, anything else maximizes.
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

/**
 * Camera reach by keyboard — the substance of the FR-9 gap.
 *
 * Until 2026-08-12 the camera had exactly three commands: fit-all, fit-selection, and
 * reset-zoom. A keyboard user could jump the view but could not move or scale it, which on
 * an infinite canvas withholds the primary interaction.
 */

test("panning moves the view in the direction named, at any zoom", () => {
  const panned = executeInfiniteCanvasCommand(commandState, {
    amountPx: 200,
    direction: "right",
    type: "view.pan",
  });

  // Right means the viewport travels right across the canvas, revealing what was off that
  // edge — the same sense `window.nudge` gives the word, because both read the delta from
  // `getDirectionalScreenDelta`.
  expect(panned.camera.center.x).toBeGreaterThan(commandState.camera.center.x);
  expect(panned.camera.center.y).toBe(commandState.camera.center.y);

  // Up is decreasing y: the world grows downward like the DOM.
  expect(
    executeInfiniteCanvasCommand(commandState, { amountPx: 200, direction: "up", type: "view.pan" })
      .camera.center.y,
  ).toBeLessThan(commandState.camera.center.y);
});

test("a pan covers the same world distance per screen pixel at any zoom", () => {
  // The whole point of expressing the amount in screen pixels: panning must feel identical
  // zoomed in and zoomed out, which means the world delta scales with zoom.
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
  // There is no pointer to anchor on, so what the user is looking at must stay put while the
  // scale changes around it. Anchoring at the origin instead would slide the canvas away.
  // Deliberately not at zoom 1, where a multiplicative step and an absolute one are
  // indistinguishable. The first draft of this test used the default zoom of 1 and passed
  // while the command set the zoom *to* the factor rather than multiplying by it.
  const near = { ...commandState, camera: { ...commandState.camera, zoom: 2 } };
  const zoomed = executeInfiniteCanvasCommand(near, { factor: 1.25, type: "view.zoomBy" });

  expect(zoomed.camera.zoom).toBeCloseTo(2.5, 5);
  expect(zoomed.camera.center).toEqual(near.camera.center);
});

test("a zoom step is not offered once the policy's limit is reached", () => {
  // Offering a step that clamps to the zoom you already have is a command that visibly does
  // nothing, which is the rule every other verb added today follows.
  const floored = { ...commandState, camera: { ...commandState.camera, zoom: 0.12 } };

  expect(isInfiniteCanvasCommandEnabled(floored, { factor: 0.8, type: "view.zoomBy" })).toBe(false);
  expect(isInfiniteCanvasCommandEnabled(floored, { factor: 1.25, type: "view.zoomBy" })).toBe(true);
});

test("enablement reads the zoom policy it is given, not the default", () => {
  // Enablement and execution must agree about the floor. A consumer with a custom policy
  // whose commands were greyed out by the default's limits would be told a working step is
  // unavailable.
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
