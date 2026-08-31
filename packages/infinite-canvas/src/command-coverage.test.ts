import { expect, test } from "vite-plus/test";

import { DEFAULT_INFINITE_CANVAS_COMMAND_DESCRIPTORS } from "./commands";
import type { InfiniteCanvasAction, InfiniteCanvasCommandId } from "./types";

type ChromelessReason = "indirection" | "lifecycle" | "parameterized" | "pointer";

const ACTION_COMMAND_COVERAGE: Readonly<
  Record<InfiniteCanvasAction<"demo">["type"], ChromelessReason | InfiniteCanvasCommandId>
> = {
  "camera.navigate": "view.fitAll",
  "camera.panBy": "view.pan.right",
  "camera.zoomAt": "view.zoomIn",
  "command.execute": "indirection",
  "desktop.hydrate": "lifecycle",
  "desktop.reset": "lifecycle",
  "group.close": "group.dissolve",
  "group.create": "parameterized",
  "group.dockWindow": "window.dock.right",
  "group.equalizeChildren": "group.equalizeChildren",
  "group.reorderChild": "group.moveChild.end",
  "group.setActiveChild": "parameterized",
  "group.setAxis": "group.flipAxis",
  "group.setChildWeights": "group.growPane",
  "group.setLayoutMode": "group.setLayout.tabs",
  "group.setRect": "pointer",
  "group.undockWindow": "window.undock",
  "interaction.finish": "pointer",
  "interaction.startGroupGutter": "pointer",
  "interaction.startGroupResize": "pointer",
  "interaction.startMarquee": "pointer",
  "interaction.startMove": "pointer",
  "interaction.startPan": "pointer",
  "interaction.startResize": "pointer",
  "interaction.step": "pointer",
  "recipe.apply": "parameterized",
  "selection.add": "parameterized",
  "selection.clear": "selection.clear",
  "selection.remove": "selection.removeActive",
  "selection.replace": "parameterized",
  "selection.selectAllVisible": "selection.selectAllVisible",
  "selection.targets.add": "parameterized",
  "selection.targets.remove": "parameterized",
  "selection.targets.replace": "parameterized",
  "selection.targets.toggle": "parameterized",
  "selection.toggle": "parameterized",
  "viewport.set": "lifecycle",
  "viewportInsets.set": "lifecycle",
  "viewportOccluders.set": "lifecycle",
  "groupMetrics.set": "lifecycle",
  "workspace.activate": "workspace.cycle.next",
  "workspace.close": "parameterized",
  "workspace.create": "parameterized",
  "workspace.addWindow": "parameterized",
  "workspace.moveWindows": "workspace.moveActiveWindow",
  "workspace.removeWindow": "workspace.removeActiveWindow",
  "workspace.reorder": "parameterized",
  "workspace.setWindows": "parameterized",
  "window.close": "activeWindow.close",
  "window.focus": "window.focus.left",
  "window.maximize": "activeWindow.toggleMaximized",
  "window.minimize": "activeWindow.minimize",
  "window.open": "parameterized",
  "window.restore": "parameterized",
  "window.togglePinned": "activeWindow.togglePinned",
  "window.setTitle": "parameterized",
  "group.setTitle": "parameterized",
  "workspace.setTitle": "parameterized",
};

const CHROMELESS_REASONS = new Set<string>([
  "indirection",
  "lifecycle",
  "parameterized",
  "pointer",
]);

test("every action names a real command or declares why it has none", () => {
  const declared = new Set<string>(
    DEFAULT_INFINITE_CANVAS_COMMAND_DESCRIPTORS.map((descriptor) => descriptor.id),
  );

  for (const [action, coverage] of Object.entries(ACTION_COMMAND_COVERAGE)) {
    if (CHROMELESS_REASONS.has(coverage)) {
      continue;
    }

    expect(
      declared.has(coverage),
      `${action} names a command that does not exist: ${coverage}`,
    ).toBe(true);
  }
});

test("the window lifecycle is reachable as commands, not only as chrome buttons", () => {
  const declared = new Set(DEFAULT_INFINITE_CANVAS_COMMAND_DESCRIPTORS.map(({ id }) => id));

  for (const id of [
    "activeWindow.close",
    "activeWindow.minimize",
    "activeWindow.toggleMaximized",
    "activeWindow.togglePinned",
  ]) {
    expect(declared.has(id as InfiniteCanvasCommandId)).toBe(true);
  }
});

test("no command id is declared twice", () => {
  const ids = DEFAULT_INFINITE_CANVAS_COMMAND_DESCRIPTORS.map((descriptor) => descriptor.id);

  expect(ids.length).toBe(new Set(ids).size);
});
