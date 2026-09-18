import { observable, syncState, when } from "@legendapp/state";
import { syncObservable } from "@legendapp/state/sync";
import { type } from "arktype";
import { expect, expectTypeOf, test } from "vite-plus/test";
import type { Result } from "./model";
import { createCanvasState } from "./state";

function createState() {
  const canvas = createCanvasState({
    windowDefinitions: { note: { minSize: { width: 100, height: 50 } } },
    viewport: { width: 1000, height: 800 },
    document: {
      content: {
        windows: {
          a: {
            id: "a",
            kind: "note",
            title: "Note",
            mode: "normal",
            isPinned: false,
            heightMode: "manual",
            rect: { x: 10, y: 20, width: 200, height: 100 },
          },
          b: {
            id: "b",
            kind: "note",
            title: "Other",
            mode: "minimized",
            isPinned: false,
            heightMode: "manual",
            rect: { x: 300, y: 20, width: 200, height: 100 },
          },
          c: {
            id: "c",
            kind: "note",
            title: "Pinned",
            mode: "normal",
            isPinned: true,
            heightMode: "manual",
            rect: { x: 600, y: 20, width: 200, height: 100 },
          },
        },
      },
      canvasView: {
        activeWindowId: "a",
        camera: { center: { x: 0, y: 0 }, zoom: 2 },
        selection: {
          targets: { "window:a": { type: "window", id: "a" }, "edge:a": { type: "edge", id: "a" } },
          anchor: "window:a",
        },
        stackingOrder: ["window:a", "window:b", "window:c"],
      },
    },
  });
  canvas.state.input.pointer.set({
    pointerId: 1,
    point: { x: 500, y: 400 },
    altKey: false,
    ctrlKey: false,
    metaKey: false,
    shiftKey: false,
  });
  return canvas;
}

test("camera fitting uses content insets and leaves document history unchanged", async () => {
  const canvas = createState();
  canvas.state.input.viewportInsets.set({ top: 80, right: 120, bottom: 40, left: 20 });
  const result = await canvas.camera.navigate({
    target: { type: "window", windowId: "a" },
    behavior: { type: "fit", padding: 0 },
    reducedMotion: "always",
  });
  expect(result).toEqual({ status: "completed" });
  expect(canvas.computed.camera.peek()).toEqual({ zoom: 4, center: { x: 122.5, y: 65 } });
  expect(canvas.history.undos$.peek()).toBe(0);
});

test("camera refusal preserves the current view", async () => {
  const canvas = createState();
  const initial = canvas.computed.camera.peek();
  expect(await canvas.camera.navigate({ target: { type: "window", windowId: "missing" } })).toEqual(
    { status: "unavailable" },
  );
  expect(canvas.computed.camera.peek()).toEqual(initial);
});

test("undo removes view references to a container that no longer exists", () => {
  const canvas = createState();
  canvas.actions.groupWindows.run({ id: "stack", windows: ["a", "c"], layout: { type: "tabs" } });
  canvas.actions.activateChild.run({ container: "stack", child: "c" });
  canvas.actions.undo.run({});
  expect(canvas.state.document.content.windows.stack.peek()).toBeUndefined();
  expect(canvas.computed.view.activeChildren.stack.peek()).toBeUndefined();
  expect(canvas.computed.view.stackingOrder.peek()).not.toContain("window:stack");
  expect(canvas.computed.selection.targets["window:stack"].peek()).toBeUndefined();
});

test("a selection of a container and a window moves and cancels through one gesture", () => {
  const canvas = createState();
  canvas.actions.groupWindows.run({ id: "box", windows: ["a"], layout: { type: "tabs" } });
  canvas.actions.selectTargets.run({
    targets: [
      { type: "window", id: "box" },
      { type: "window", id: "c" },
    ],
  });
  const pointer = canvas.state.input.pointer.peek()!;
  canvas.actions.pressMove.run({ window: "box", pointer, threshold: 0 });
  canvas.actions.updatePointer.run({ ...pointer, point: { x: 540, y: 420 } });
  expect(canvas.computed.windowRect.box.peek()?.x).toBe(30);
  expect(canvas.computed.windowRect.a.peek()?.x).toBe(30);
  expect(canvas.computed.windowRect.c.peek()?.x).toBe(620);
  expect(canvas.state.document.content.windows.box.rect.x.peek()).toBe(10);
  expect(canvas.state.document.content.windows.c.rect.x.peek()).toBe(600);
  canvas.state.document.content.windows.box.title.set("Changed");
  canvas.actions.cancelPointer.run({ pointerId: pointer.pointerId });
  expect(canvas.computed.windowRect.box.peek()?.x).toBe(10);
  expect(canvas.computed.windowRect.c.peek()?.x).toBe(600);
  expect(canvas.state.document.content.windows.box.title.peek()).toBe("Changed");
  canvas.actions.selectTargets.run({
    targets: [
      { type: "window", id: "box" },
      { type: "window", id: "c" },
    ],
  });
  canvas.actions.pressMove.run({ window: "a", pointer, threshold: 0 });
  canvas.actions.updatePointer.run({ ...pointer, point: { x: 540, y: 420 } });
  canvas.actions.releasePointer.run({ pointerId: pointer.pointerId });
  expect(canvas.state.document.content.windows.box.rect.x.peek()).toBe(30);
  canvas.actions.undo.run({});
  expect(canvas.state.document.content.windows.box.rect.x.peek()).toBe(10);
  expect(canvas.state.document.content.windows.box.title.peek()).toBe("Changed");
});

test("docking on an edge of a split child divides its share, and a window cannot dock into itself", () => {
  const canvas = createState();
  canvas.actions.restoreWindow.run({ window: "b" });
  canvas.actions.groupWindows.run({ id: "row", windows: ["a", "c"] });
  expect(canvas.actions.dockWindow.canRun({ window: "row", target: "a", edge: "east" })).toBe(
    false,
  );
  expect(
    canvas.actions.dockWindow.canRun({ window: "b", target: "a", edge: "east", wrapperId: "c" }),
  ).toBe(false);
  expect(canvas.actions.dockWindow.run({ window: "b", target: "a", edge: "east" })).toBeUndefined();
  expect(canvas.state.document.content.windows.row.children.peek()).toEqual(["a", "b", "c"]);
  expect(canvas.state.document.content.windows.a.item.peek()).toEqual({ factor: 0.5 });
  expect(canvas.state.document.content.windows.b.item.peek()).toEqual({ factor: 0.5 });
  expect(canvas.computed.windowParent.b.peek()).toBe("row");
  canvas.actions.undo.run({});
  expect(canvas.computed.windowParent.b.peek()).toBeUndefined();
  expect(canvas.computed.windowParent.a.peek()).toBe("row");
});

test("center docking on a floating window wraps both in tabs, and undocking dissolves nothing that has content", () => {
  const canvas = createState();
  expect(
    canvas.actions.dockWindow.run({ window: "c", target: "a", edge: "center", wrapperId: "stack" }),
  ).toBeUndefined();
  expect(canvas.state.document.content.windows.stack.peek()).toMatchObject({
    layout: { type: "tabs" },
    children: ["a", "c"],
    rect: { x: 10, y: 20, width: 200, height: 100 },
  });
  expect(canvas.computed.view.stackingOrder.peek()).toContain("window:stack");
  expect(canvas.computed.view.stackingOrder.peek()).not.toContain("window:a");
  expect(canvas.computed.windowVisible.c.peek()).toBe(true);
  expect(canvas.computed.windowVisible.a.peek()).toBe(false);
  canvas.actions.undockWindow.run({ window: "c" });
  expect(canvas.computed.windowParent.c.peek()).toBeUndefined();
  expect(canvas.state.document.content.windows.stack.children.peek()).toEqual(["a"]);
});

test("native sync restores saved content and views without input or undo entries", async () => {
  const source = createState();
  source.actions.renameWindow.run({ window: "a", title: "Saved title" });
  source.actions.createWorkspace.run({ id: "research", title: "Research", windows: ["a"] });
  source.computed.view.camera.center.x.set(123);
  const saved = source.state.document.peek();
  const target = createState();
  const viewport = target.state.input.viewport.peek();
  syncObservable(target.state.document, { get: async () => saved });
  target.state.document.get();
  await when(syncState(target.state.document).isLoaded);
  expect(target.state.document.content.windows.a.title.peek()).toBe("Saved title");
  expect(target.state.document.activeWorkspaceId.peek()).toBe("research");
  expect(target.computed.camera.center.x.peek()).toBe(123);
  expect(target.state.input.viewport.peek()).toEqual(viewport);
  expect(target.history.undos$.peek()).toBe(0);
});

test("workspace transfers move the whole container and clear invalid view selection", () => {
  const canvas = createState();
  canvas.actions.groupWindows.run({ id: "row", windows: ["a", "c"] });
  canvas.actions.createWorkspace.run({ id: "source", title: "Source", windows: ["a"] });
  expect(canvas.state.document.content.workspaces.source.windowIds.peek()).toEqual(["row"]);
  canvas.actions.selectWindow.run({ window: "row" });
  canvas.actions.createWorkspace.run({ id: "destination", title: "Destination", activate: false });
  canvas.actions.moveWindowsToWorkspace.run({ workspace: "destination", windows: ["a"] });
  expect(canvas.state.document.content.workspaces.destination.windowIds.peek()).toEqual(["row"]);
  expect(canvas.state.document.content.workspaces.source.windowIds.peek()).toEqual([]);
  expect(canvas.computed.selection.targets.peek()).toEqual({});
  expect(canvas.computed.workspaceWindows.peek()).toEqual([]);
  canvas.actions.activateWorkspace.run({ workspaceId: "destination" });
  expect(canvas.computed.workspaceWindows.map((window) => window.id.peek()).toSorted()).toEqual([
    "a",
    "c",
    "row",
  ]);
  canvas.actions.closeWorkspace.run({ workspace: "destination" });
  expect(canvas.state.document.activeWorkspaceId.peek()).toBeNull();
  expect(canvas.state.document.content.windows.a.peek()).toBeDefined();
  canvas.actions.undo.run({});
  expect(canvas.state.document.content.workspaces.destination.peek()).toBeDefined();
});

test("nudge moves selected floating windows and the top-level container of a selected member once per undo", () => {
  const canvas = createState();
  expect(canvas.actions.nudgeSelection.run({ x: 5, y: -3 })).toBeUndefined();
  expect(canvas.state.document.content.windows.a.rect.peek()).toEqual({
    x: 15,
    y: 17,
    width: 200,
    height: 100,
  });
  expect(canvas.state.document.content.windows.c.rect.x.peek()).toBe(600);
  canvas.actions.undo.run({});
  expect(canvas.state.document.content.windows.a.rect.x.peek()).toBe(10);
  canvas.actions.groupWindows.run({ id: "row", windows: ["a", "c"] });
  canvas.actions.selectWindow.run({ window: "c" });
  const before = canvas.state.document.content.windows.row.rect.x.peek();
  canvas.actions.nudgeSelection.run({ x: 10, y: 0 });
  expect(canvas.state.document.content.windows.row.rect.x.peek()).toBe(before + 10);
  canvas.actions.clearSelection.run({});
  expect(canvas.actions.nudgeSelection.canRun({ x: 1, y: 0 })).toBe(false);
  canvas.actions.selectWindow.run({ window: "c" });
  canvas.actions.beginPan.run(canvas.state.input.pointer.peek()!);
  expect(canvas.actions.nudgeSelection.canRun({ x: 1, y: 0 })).toBe(false);
});

test("directional focus selects the nearest visible window and refuses when none lies that way", async () => {
  const canvas = createState();
  expect(await canvas.actions.focusDirection.run({ direction: "right" })).toEqual({
    status: "completed",
  });
  expect(canvas.computed.view.activeWindowId.peek()).toBe("c");
  expect(canvas.computed.camera.center.x.peek()).toBe(700);
  expect(canvas.actions.focusDirection.canRun({ direction: "right" })).toBe(false);
  canvas.actions.restoreWindow.run({ window: "b" });
  canvas.actions.selectWindow.run({ window: "c" });
  canvas.actions.focusDirection.run({ direction: "left" });
  expect(canvas.computed.view.activeWindowId.peek()).toBe("b");
  expect(canvas.actions.focusDirection.canRun({ direction: "up" })).toBe(false);
});

test("a relative resize changes the active window by config steps and keeps its minimum size", () => {
  const canvas = createState();
  expect(
    canvas.actions.resizeWindow.run({ by: { x: 1, y: -1, unit: "largeStep" } }),
  ).toBeUndefined();
  expect(canvas.state.document.content.windows.a.rect.peek()).toEqual({
    x: 10,
    y: 20,
    width: 210,
    height: 90,
  });
  canvas.actions.resizeWindow.run({ by: { x: -500, y: 0 } });
  expect(canvas.state.document.content.windows.a.rect.width.peek()).toBe(100);
  canvas.computed.view.activeWindowId.set(null);
  expect(canvas.actions.resizeWindow.canRun({ by: { x: 1, y: 0 } })).toBe(false);
});

test("placement fills a region of the view with the active window and is undone once", () => {
  const canvas = createState();
  expect(canvas.actions.placeWindow.run({ region: "left", padding: 0 })).toBeUndefined();
  expect(canvas.state.document.content.windows.a.rect.peek()).toEqual({
    x: -250,
    y: -200,
    width: 250,
    height: 400,
  });
  canvas.actions.placeWindow.run({ region: "fill", padding: 20, window: "c" });
  expect(canvas.state.document.content.windows.c.rect.peek()).toEqual({
    x: -240,
    y: -190,
    width: 480,
    height: 380,
  });
  expect(canvas.computed.view.activeWindowId.peek()).toBe("c");
  canvas.actions.undo.run({});
  expect(canvas.state.document.content.windows.c.rect.x.peek()).toBe(600);
  canvas.actions.groupWindows.run({ id: "row", windows: ["a", "c"] });
  expect(canvas.actions.placeWindow.canRun({ region: "left", window: "a" })).toBe(false);
  expect(canvas.actions.placeWindow.canRun({ region: "left", window: "row" })).toBe(true);
  expect(canvas.actions.placeWindow.canRun({ region: "left", window: "b" })).toBe(false);
});

test("camera stops step in order, stop at the ends unless wrapped, and capture the current view", async () => {
  const canvas = createCanvasState({
    windowDefinitions: { note: {} },
    viewport: { width: 1000, height: 800 },
    document: {
      content: {
        windows: {
          a: { kind: "note", title: "A", rect: { x: 1000, y: 0, width: 200, height: 100 } },
        },
        cameraStops: [
          { id: "intro", navigation: { target: { type: "point", point: { x: 0, y: 0 } } } },
          {
            id: "work",
            navigation: {
              target: { type: "window", windowId: "a" },
              behavior: { type: "centerAtZoom", zoom: 2 },
            },
          },
        ],
      },
    },
  });
  expect(canvas.actions.stepCameraStop.canRun({ by: -1 })).toBe(true);
  expect(await canvas.actions.stepCameraStop.run({ by: 1 })).toEqual({ status: "completed" });
  expect(canvas.computed.view.cameraStopId.peek()).toBe("intro");
  await canvas.actions.stepCameraStop.run({ by: 1 });
  expect(canvas.computed.camera.peek()).toEqual({ center: { x: 1100, y: 50 }, zoom: 2 });
  expect(canvas.actions.stepCameraStop.canRun({ by: 1 })).toBe(false);
  await canvas.actions.stepCameraStop.run({ by: 1, wrap: true });
  expect(canvas.computed.view.cameraStopId.peek()).toBe("intro");
  expect(canvas.actions.addCameraStop.run({ id: "here" })).toBeUndefined();
  expect(canvas.state.document.content.cameraStops[2].navigation.peek()).toEqual({
    target: { type: "point", point: { x: 0, y: 0 } },
    behavior: { type: "centerAtZoom", zoom: 2 },
  });
  expect(canvas.actions.addCameraStop.canRun({ id: "here" })).toBe(false);
  canvas.actions.removeCameraStop.run({ stop: "here" });
  expect(canvas.computed.view.cameraStopId.peek()).toBeNull();
  expect(canvas.state.document.content.cameraStops.peek().map((stop) => stop.id)).toEqual([
    "intro",
    "work",
  ]);
});

test("floating windows have no parent and are their own root", () => {
  const canvas = createState();
  expect(canvas.computed.parents.get()).toEqual({});
  expect(canvas.computed.windowParent.a.get()).toBeUndefined();
  expect(canvas.computed.windowRoot.a.get()).toBe("a");
});

test("an empty canvas exposes inactive gestures and no content bounds", () => {
  const canvas = createCanvasState({ windowDefinitions: {} });
  expect(canvas.computed.capturedPointerId.get()).toBeNull();
  expect(canvas.computed.pointerWorld.get()).toBeNull();
  expect(canvas.computed.marqueeRect.get()).toBeNull();
  expect(canvas.computed.windowDrag.get()).toBeNull();
  expect(canvas.computed.dragDisplacement.get()).toBeNull();
  expect(canvas.computed.contentBounds.get()).toBeNull();
  expectTypeOf(canvas.computed.capturedPointerId.get()).toEqualTypeOf<number | null>();
});

test("a model command updates its state and computed view", async () => {
  const canvas = createState();
  expect(canvas.computed.activeWindow.get()?.title).toBe("Note");
  const result = await canvas.commands.renameWindow.run({ window: "a", title: " Updated " });
  expectTypeOf(result).toEqualTypeOf<Result<null>>();
  expect(result).toEqual({ data: null, error: null });
  expect(canvas.state.document.content.windows.a.title.get()).toBe("Updated");
  expect(canvas.computed.activeWindow.get()?.title).toBe("Updated");
});

test("a reusable live guard controls availability and execution", async () => {
  const canvas = createState();
  const available$ = observable(() => canvas.commands.focusWindow.canRun({ window: "a" }));
  expect(available$.get()).toBe(true);
  canvas.state.document.content.windows.a.delete();
  const result = await canvas.commands.focusWindow.run({ window: "a" });
  expect(result.data).toBeNull();
  expect(result.error).toBeInstanceOf(type.errors);
  if (result.error instanceof type.errors) {
    expect(result.error[0]?.path.toString()).toBe("window");
  }
  expect(available$.get()).toBe(false);
  expect(canvas.computed.activeWindow.get()).toBeUndefined();
});

test("focus updates selection, stacking, and mode in one notification", async () => {
  const canvas = createState();
  const changes: string[] = [];
  const dispose = canvas.state.onChange(() => {
    changes.push(canvas.computed.view.activeWindowId.peek() ?? "none");
    expect(canvas.state.document.content.windows.b.mode.peek()).toBe("normal");
    expect(canvas.computed.windowZIndex.b.peek()).toBeGreaterThan(
      canvas.computed.windowZIndex.a.peek(),
    );
    expect(canvas.computed.view.selection.peek()).toEqual({
      targets: { "window:b": { type: "window", id: "b" } },
      anchor: "window:b",
    });
  });
  expect(await canvas.commands.focusWindow.run({ window: "b" })).toEqual({
    data: null,
    error: null,
  });
  expect(changes).toEqual(["b"]);
  dispose();
});

test("input handlers can focus without replacing a mixed selection", () => {
  const canvas = createState();
  canvas.computed.view.activeWindowId.set("c");
  canvas.actions.focusWindow.run({ window: "a" });
  expect(canvas.computed.view.activeWindowId.get()).toBe("a");
  expect(canvas.computed.view.selection.targets.get()).toEqual({
    "window:a": { type: "window", id: "a" },
    "edge:a": { type: "edge", id: "a" },
  });
  expect(canvas.computed.windowZIndex.a.get()).toBeGreaterThan(
    canvas.computed.windowZIndex.b.get(),
  );
});

test("restore shares focus behavior and clears maximized mode", async () => {
  const canvas = createState();
  canvas.state.document.content.windows.b.mode.set("maximized");
  const result = await canvas.commands.restoreWindow.run({ window: "b" });
  expect(result).toEqual({ data: null, error: null });
  expect(canvas.state.document.content.windows.b.mode.get()).toBe("normal");
  expect(canvas.computed.view.activeWindowId.get()).toBe("b");
  expect(canvas.computed.view.selection.anchor.get()).toBe("window:b");
  expect(canvas.commands.restoreWindow.icon).toBe("restore");
});

test("input-only constraints reject invalid writes", async () => {
  const canvas = createState();
  const result = await canvas.commands.renameWindow.run({ window: "a", title: " " });
  expect(result.data).toBeNull();
  expect(result.error).not.toBeNull();
  expect(canvas.state.document.content.windows.a.title.get()).toBe("Note");
});

test("pointer and camera state derive a move without document writes", () => {
  const canvas = createState();
  const documentChanges: unknown[] = [];
  canvas.state.session.drag.set({
    kind: "move",
    alignmentTargets: [],
    containers: {},
    detached: {},
    target: "a",
    pointerId: 1,
    startPoint: { x: 0, y: 0 },
    startRects: { a: canvas.state.document.content.windows.a.rect.get() },
  });
  const dispose = canvas.state.document.content.onChange(({ value }) =>
    documentChanges.push(value),
  );
  canvas.state.input.pointer.point.set({ x: 580, y: 440 });
  expect(canvas.computed.windowRect.a.get()).toEqual({ x: 50, y: 40, width: 200, height: 100 });
  canvas.computed.view.camera.center.x.set(30);
  expect(canvas.computed.windowRect.a.get()?.x).toBe(80);
  canvas.state.input.viewport.width.set(1200);
  expect(canvas.computed.windowRect.a.get()?.x).toBe(30);
  expect(canvas.state.document.content.windows.a.rect.get()).toEqual({
    x: 10,
    y: 20,
    width: 200,
    height: 100,
  });
  expect(documentChanges).toEqual([]);
  dispose();
});

test("clearing a drag preview preserves document edits", async () => {
  const canvas = createState();
  canvas.state.session.drag.set({
    kind: "move",
    alignmentTargets: [],
    containers: {},
    detached: {},
    target: "a",
    pointerId: 1,
    startPoint: { x: 0, y: 0 },
    startRects: { a: canvas.state.document.content.windows.a.rect.get() },
  });
  canvas.state.input.pointer.point.x.set(600);
  expect(canvas.computed.windowRect.a.get()?.x).toBe(60);
  canvas.state.document.content.windows.b.data.set({ text: "Saved during drag" });
  await canvas.commands.renameWindow.run({ window: "a", title: "Renamed during drag" });
  canvas.actions.cancelDrag.run({});
  expect(canvas.computed.windowRect.a.get()?.x).toBe(10);
  expect(canvas.state.document.content.windows.a.title.get()).toBe("Renamed during drag");
  expect(canvas.state.document.content.windows.b.data.get()).toEqual({ text: "Saved during drag" });
  expect(canvas.state.session.drag.get()).toBeNull();
});

test("the captured pointer owns movement and completion", () => {
  const canvas = createState();
  canvas.actions.pressMove.run({
    window: "a",
    pointer: canvas.state.input.pointer.peek()!,
    threshold: 0,
  });
  canvas.actions.updatePointer.run({
    pointerId: 2,
    point: { x: 900, y: 900 },
    altKey: false,
    ctrlKey: false,
    metaKey: false,
    shiftKey: false,
  });
  canvas.actions.releasePointer.run({ pointerId: 2 });
  expect(canvas.state.session.drag.get()).not.toBeNull();
  expect(canvas.computed.windowRect.a.get()?.x).toBe(10);
  canvas.actions.updatePointer.run({
    pointerId: 1,
    point: { x: 600, y: 420 },
    altKey: false,
    ctrlKey: false,
    metaKey: false,
    shiftKey: false,
  });
  canvas.actions.releasePointer.run({ pointerId: 1 });
  expect(canvas.state.document.content.windows.a.rect.get()).toEqual({
    x: 60,
    y: 30,
    width: 200,
    height: 100,
  });
  expect(canvas.computed.windowRect.a.get()).toEqual(
    canvas.state.document.content.windows.a.rect.get(),
  );
});

test("pointer changes leave unrelated window geometry subscriptions unchanged", () => {
  const canvas = createState();
  const changes: unknown[] = [];
  expect(canvas.computed.windowRect.c.get()).toEqual(
    canvas.state.document.content.windows.c.rect.get(),
  );
  const dispose = canvas.computed.windowRect.c.onChange(({ value }) => changes.push(value));
  expect(changes).toEqual([]);
  canvas.state.session.drag.set({
    kind: "move",
    alignmentTargets: [],
    containers: {},
    detached: {},
    target: "a",
    pointerId: 1,
    startPoint: { x: 0, y: 0 },
    startRects: { a: canvas.state.document.content.windows.a.rect.get() },
  });
  expect(changes).toEqual([]);
  canvas.state.input.pointer.point.x.set(700);
  expect(changes).toEqual([]);
  canvas.state.session.drag.set(null);
  expect(changes).toEqual([]);
  dispose();
});

test("finishing a move does not restore a deleted window", () => {
  const canvas = createState();
  canvas.actions.pressMove.run({
    window: "a",
    pointer: canvas.state.input.pointer.peek()!,
    threshold: 0,
  });
  canvas.state.input.pointer.point.x.set(700);
  canvas.state.document.content.windows.a.delete();
  canvas.actions.releasePointer.run({ pointerId: 1 });
  expect(canvas.state.document.content.windows.a.get()).toBeUndefined();
  expect(canvas.state.session.drag.get()).toBeNull();
});

test("selection actions keep equal IDs from different target types separate", () => {
  const canvas = createState();
  canvas.actions.selectTargets.run({ mode: "remove", targets: [{ type: "edge", id: "a" }] });
  expect(canvas.computed.view.selection.targets.get()).toEqual({
    "window:a": { type: "window", id: "a" },
  });
  canvas.actions.selectTargets.run({ mode: "toggle", targets: [{ type: "window", id: "a" }] });
  expect(canvas.computed.view.selection.get()).toEqual({ targets: {}, anchor: null });
  expect(canvas.computed.view.activeWindowId.get()).toBeNull();
});

test("the active view links to each workspace without copying view state", () => {
  const canvas = createState();
  canvas.state.document.content.workspaces.research.set({
    id: "research",
    title: "Research",
    windowIds: ["c"],
  });
  canvas.state.document.workspaceViews.research.set({
    activeWindowId: "c",
    cameraStopId: null,
    camera: { center: { x: 100, y: 200 }, zoom: 1 },
    selection: { targets: { "window:c": { type: "window", id: "c" } }, anchor: "window:c" },
    stackingOrder: ["window:c"],
    activeChildren: {},
  });
  canvas.state.document.activeWorkspaceId.set("research");
  expect(canvas.computed.pointerWorld.get()).toEqual({ x: 100, y: 200 });
  expect(canvas.computed.view.activeWindowId.get()).toBe("c");
  canvas.computed.view.camera.center.x.set(150);
  expect(canvas.state.document.workspaceViews.research.camera.center.x.get()).toBe(150);
  expect(canvas.state.document.canvasView.camera.center.x.get()).toBe(0);
  canvas.state.document.activeWorkspaceId.set(null);
  expect(canvas.computed.view.activeWindowId.get()).toBe("a");
  expect(canvas.computed.view.selection.anchor.get()).toBe("window:a");
  expect(canvas.computed.pointerWorld.get()).toEqual({ x: 0, y: 0 });
});

test("the window list retains field links and drives stacking", () => {
  const canvas = createState();
  canvas.state.document.content.windows.a.title.set("Changed");
  expect(canvas.computed.windows[0].title.get()).toBe("Changed");
  canvas.actions.focusWindow.run({ window: "a" });
  expect(canvas.computed.windowZIndex.a.get()).toBeGreaterThan(
    canvas.computed.windowZIndex.b.get(),
  );
  expect(canvas.computed.windowZIndex.c.get()).toBeGreaterThan(
    canvas.computed.windowZIndex.a.get(),
  );
  canvas.actions.closeWindow.run({ window: "c" });
  expect(canvas.computed.windows.map((window) => window.id.get())).toEqual(["a", "b"]);
  expect(canvas.computed.view.stackingOrder.get()).toEqual(["window:b", "window:a"]);
});

test("resize previews use live window definitions without changing saved geometry", () => {
  const canvas = createState();
  canvas.state.session.drag.set({
    kind: "resize",
    containers: {},
    pointerId: 1,
    startPoint: { x: 0, y: 0 },
    startRects: { a: canvas.state.document.content.windows.a.rect.get() },
    handle: "south-east",
  });
  canvas.state.input.pointer.point.set({ x: 260, y: 260 });
  expect(canvas.computed.windowRect.a.get()).toEqual({ x: 10, y: 20, width: 100, height: 50 });
  canvas.state.config.windowDefinitions.note.minSize.set({ width: 160, height: 90 });
  expect(canvas.computed.windowRect.a.get()).toEqual({ x: 10, y: 20, width: 160, height: 90 });
  expect(canvas.state.document.content.windows.a.rect.get()).toEqual({
    x: 10,
    y: 20,
    width: 200,
    height: 100,
  });
});

test("container selection, activation, undocking, and deletion share one window tree", () => {
  const canvas = createState();
  expect(
    canvas.actions.groupWindows.run({
      id: "g",
      windows: ["a", "c"],
      rect: { x: 0, y: 0, width: 606, height: 240 },
    }),
  ).toBeUndefined();
  expect(canvas.computed.windowParent.a.get()).toBe("g");
  expect(canvas.computed.windowRect.a.get()).toEqual({ x: 0, y: 0, width: 300, height: 240 });
  expect(canvas.computed.selection.anchor.get()).toBe("window:g");
  expect(canvas.computed.windowZIndex.a.get()).toBeGreaterThan(
    canvas.computed.windowZIndex.g.get(),
  );
  expect(canvas.actions.setWindowLayout.canRun({ window: "g", layout: { type: "spiral" } })).toBe(
    false,
  );
  expect(
    canvas.actions.setWindowLayout.canRun({ window: "g", layout: { type: "split", gap: -1 } }),
  ).toBe(false);
  expect(
    canvas.actions.setWindowLayout.run({ window: "g", layout: { type: "tabs" } }),
  ).toBeUndefined();
  expect(canvas.computed.windowVisible.a.get()).toBe(true);
  expect(canvas.computed.windowVisible.c.get()).toBe(false);
  expect(canvas.actions.selectWindow.run({ window: "c" })).toBeUndefined();
  expect(canvas.computed.windowVisible.c.get()).toBe(true);
  expect(canvas.computed.windowVisible.a.get()).toBe(false);
  const rect = canvas.computed.windowRect.c.get();
  expect(canvas.actions.undockWindow.run({ window: "c" })).toBeUndefined();
  expect(canvas.computed.windowParent.c.get()).toBeUndefined();
  expect(canvas.state.document.content.windows.c.rect.get()).toEqual(rect);
  canvas.state.document.content.connections.edge.set({
    id: "edge",
    kind: "link",
    from: "a",
    to: "c",
  });
  canvas.state.document.content.workspaces.saved.set({
    id: "saved",
    title: "Saved",
    windowIds: ["g", "c"],
  });
  const dispose = canvas.computed.arrangement.g.onChange(() => {});
  expect(canvas.actions.closeWindow.run({ window: "a" })).toBeUndefined();
  expect(canvas.state.document.content.windows.g.get()).toBeUndefined();
  expect(canvas.computed.arrangement.g.get()).toBeUndefined();
  expect(canvas.state.document.content.connections.edge.get()).toBeUndefined();
  expect(canvas.state.document.content.workspaces.saved.windowIds.get()).toEqual(["c"]);
  expect(canvas.state.document.content.windows.c.get()).toBeDefined();
  dispose();
});

test("sash previews preserve edits, stop at a pane's minimum, and commit factors once", () => {
  const canvas = createState();
  canvas.actions.groupWindows.run({
    id: "g",
    windows: ["a", "c"],
    rect: { x: 0, y: 0, width: 606, height: 240 },
  });
  const target = { container: "g", index: 0 };
  const pointer = { ...canvas.state.input.pointer.peek()! };
  expect(
    canvas.actions.beginSashDrag.canRun({ target: { container: "g", index: 1 }, pointer }),
  ).toBe(false);
  expect(canvas.actions.beginSashDrag.run({ target, pointer })).toBeUndefined();
  canvas.actions.updatePointer.run({ ...pointer, point: { x: 600, y: 400 } });
  expect(canvas.computed.windowRect.a.get()?.width).toBe(350);
  expect(canvas.computed.windowRect.c.get()?.width).toBe(250);
  expect(canvas.state.document.content.windows.a.item.get()).toBeUndefined();
  canvas.actions.updatePointer.run({ ...pointer, point: { x: 2000, y: 400 } });
  expect(canvas.computed.windowRect.c.get()?.width).toBe(100);
  canvas.state.document.content.windows.g.title.set("Kept");
  canvas.actions.cancelDrag.run({});
  expect(canvas.computed.windowRect.a.get()?.width).toBe(300);
  expect(canvas.state.document.content.windows.g.title.get()).toBe("Kept");
  expect(canvas.actions.beginSashDrag.run({ target, pointer })).toBeUndefined();
  canvas.actions.updatePointer.run({ ...pointer, point: { x: 600, y: 400 } });
  expect(canvas.actions.releasePointer.run({ pointerId: 1 })).toBeUndefined();
  expect(canvas.computed.windowRect.a.get()?.width).toBe(350);
  expect(canvas.state.document.content.windows.a.item.get()).toEqual({ factor: 350 });
  canvas.actions.undo.run({});
  expect(canvas.computed.windowRect.a.get()?.width).toBe(300);
  expect(canvas.state.document.content.windows.g.title.get()).toBe("Kept");
});

test("a container move commits geometry once and undo preserves the selected view", () => {
  const canvas = createState();
  canvas.actions.groupWindows.run({
    id: "g",
    windows: ["a", "c"],
    rect: { x: 0, y: 0, width: 606, height: 240 },
  });
  expect(
    canvas.actions.pressMove.run({
      window: "g",
      pointer: canvas.state.input.pointer.peek()!,
      threshold: 0,
    }),
  ).toBeUndefined();
  canvas.actions.updatePointer.run({
    ...canvas.state.input.pointer.peek()!,
    point: { x: 600, y: 440 },
  });
  expect(canvas.computed.windowRect.a.get()).toEqual({ x: 50, y: 20, width: 300, height: 240 });
  expect(canvas.state.document.content.windows.g.rect.get().x).toBe(0);
  canvas.actions.releasePointer.run({ pointerId: 1 });
  expect(canvas.state.document.content.windows.g.rect.get().x).toBe(50);
  canvas.actions.undo.run({});
  expect(canvas.computed.windowRect.a.get()?.x).toBe(0);
  expect(canvas.computed.selection.anchor.get()).toBe("window:g");
  canvas.actions.redo.run({});
  expect(canvas.computed.windowRect.a.get()?.x).toBe(50);
});

test("resizing a container stops at the minimum size that its children need", () => {
  const canvas = createState();
  canvas.actions.groupWindows.run({
    id: "g",
    windows: ["a", "c"],
    rect: { x: 0, y: 0, width: 606, height: 240 },
  });
  expect(canvas.computed.minSize.g.get()).toEqual({ width: 206, height: 50 });
  const pointer = canvas.state.input.pointer.peek()!;
  expect(
    canvas.actions.pressResize.run({ window: "g", pointer, handle: "south-east", threshold: 0 }),
  ).toBeUndefined();
  canvas.actions.updatePointer.run({ ...pointer, point: { x: -2000, y: -2000 } });
  expect(canvas.computed.windowRect.g.get()).toEqual({ x: 0, y: 0, width: 206, height: 50 });
  expect(canvas.computed.windowRect.a.get()?.width).toBe(100);
  canvas.actions.releasePointer.run({ pointerId: 1 });
  expect(canvas.state.document.content.windows.g.rect.get()).toEqual({
    x: 0,
    y: 0,
    width: 206,
    height: 50,
  });
});
