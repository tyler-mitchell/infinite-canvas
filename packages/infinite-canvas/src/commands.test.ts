import { expect, test } from "vite-plus/test";

import {
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
