import { expect, test } from "vite-plus/test";

import {
  DEFAULT_INFINITE_CANVAS_COMMAND_DESCRIPTORS,
  getAvailableInfiniteCanvasContextualCommands,
  getInfiniteCanvasContextualCommands,
} from "./commands";
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
