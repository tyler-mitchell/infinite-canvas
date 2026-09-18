import { expect, test } from "vite-plus/test";

import { DEFAULT_INFINITE_CANVAS_COMMAND_DESCRIPTORS } from "./operations";
import type { InfiniteCanvasAction, InfiniteCanvasCommandId } from "./types";

type ChromelessReason = "indirection" | "lifecycle" | "parameterized" | "pointer";

const ACTION_COMMAND_COVERAGE: Readonly<
  Record<InfiniteCanvasAction<"demo">["type"], ChromelessReason | InfiniteCanvasCommandId>
> = {
  "selection.set": "parameterized",
  "component.action": "parameterized",
  "interaction.startGroupReorder": "pointer",
  "selection.group": "selection.group",
  "activeWindow.close": "activeWindow.close",
  "activeWindow.minimize": "activeWindow.minimize",
  "activeWindow.toggleMaximized": "activeWindow.toggleMaximized",
  "activeWindow.togglePinned": "activeWindow.togglePinned",
  "desktop.cancel": "desktop.cancel",
  "group.dissolve": "group.dissolve",
  "group.fitContents": "group.fitContents",
  "group.setBounds": "parameterized",
  "group.flipAxis": "group.flipAxis",
  "group.moveChild": "group.moveChild.end",
  "group.resizePane": "group.growPane",
  "group.setLayout": "group.setLayout.tabs",
  "history.redo": "history.redo",
  "history.undo": "history.undo",
  "selection.close": "selection.close",
  "selection.extendDirection": "selection.extend.left",
  "selection.minimize": "selection.minimize",
  "selection.removeActive": "selection.removeActive",
  "selection.togglePinned": "selection.togglePinned",
  "view.fitAll": "view.fitAll",
  "view.fitSelection": "view.fitSelection",
  "view.pan": "view.pan.right",
  "view.resetZoom": "view.resetZoom",
  "view.zoomBy": "view.zoomIn",
  "window.align": "window.align.left",
  "window.distribute": "window.distribute.horizontal",
  "window.dockDirection": "window.dock.right",
  "window.focusDirection": "window.focus.left",
  "window.nudge": "window.nudge.left",
  "window.pack": "window.pack",
  "window.place": "window.place.left",
  "window.resize": "window.resize.right",
  "window.reveal": "parameterized",
  "window.swap": "window.swap",
  "window.undock": "window.undock",
  "workspace.cycle": "workspace.cycle.next",
  "workspace.enter": "parameterized",
  "workspace.moveActiveWindow": "workspace.moveActiveWindow",
  "workspace.removeActiveWindow": "workspace.removeActiveWindow",
  "workspace.showAll": "workspace.showAll",
  "camera.navigate": "view.fitAll",
  "camera.panBy": "view.pan.right",
  "camera.zoomAt": "view.zoomIn",
  // A consumer supplies the edge and its ids, so no chrome control can stand for these.
  "connection.close": "parameterized",
  "connection.open": "parameterized",
  "connection.update": "parameterized",
  "desktop.hydrate": "lifecycle",
  "desktop.reset": "desktop.reset",
  "group.close": "group.dissolve",
  "group.create": "parameterized",
  "group.dockWindow": "window.dock.right",
  "group.equalizeChildren": "group.equalizeChildren",
  "group.reorderChild": "group.moveChild.end",
  "group.setActiveChild": "parameterized",
  "group.setAxis": "group.flipAxis",
  "group.setChildLayouts": "parameterized",
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
  "window.setRect": "parameterized",
  "window.setContentHeight": "parameterized",
  "window.setData": "parameterized",
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
