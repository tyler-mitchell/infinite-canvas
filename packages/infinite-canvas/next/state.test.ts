import { observable, syncState, when } from "@legendapp/state";
import { syncObservable } from "@legendapp/state/sync";
import { type } from "arktype";
import { expect, expectTypeOf, test } from "vite-plus/test";
import { getRunnableCommands } from "./commands";
import { bindComponentActions } from "./components";
import type { Result } from "./model";
import { getCameraTrack } from "@hyphened/math/cpu";
import { createCanvasState } from "./state";
import portfolio from "../../portfolio-board/portfolio/document.json";

test("career details open, remain visible, close, and reopen", async () => {
  const canvas = createCanvasState({
    viewport: { width: 2200, height: 1400 },
    windowDefinitions: {
      main: {},
      "career-detail": {
        size: { width: 360, height: 480 },
        navigable: false,
        schema: type({
          organization: "string > 0",
          role: "string > 0",
          summary: "string > 0",
          icon: "'paypal' | 'federato' | 'utsa'",
          period: "string > 0",
          sections: type({ title: "string > 0", body: "string > 0" }).array(),
          source: "string > 0",
        }),
      },
    },
    document: {
      content: {
        windows: {
          main: {
            kind: "main",
            title: "Portfolio",
            heightMode: "manual",
            rect: { x: 0, y: 80, width: 880, height: 2400 },
          },
        },
      },
      canvasView: { camera: { center: { x: 440, y: 700 }, zoom: 1 } },
    },
  });
  const camera = canvas.computed.camera.peek();
  for (const name of ["paypal", "federato", "utsa"] as const) {
    const entry = portfolio.content.windows[name].data;
    const result = await canvas.commands.openWindow.run({
      id: `${name}-detail`,
      kind: "career-detail",
      heightMode: "manual",
      title: entry.organization,
      data: { ...entry, source: "main" },
      placement: {
        relativeTo: "main",
        side: name === "utsa" ? "right" : "left",
        stack: true,
        gap: 24,
      },
    });
    expect(result.error).toBeNull();
    expect(canvas.state.document.content.windows[`${name}-detail`].heightMode.peek()).toBe(
      "manual",
    );
    expect(
      (
        await canvas.commands.revealWindow.run({
          window: `${name}-detail`,
          behavior: { type: "fit", maxZoom: 1 },
        })
      ).error,
    ).toBeNull();
    expect(canvas.computed.camera.peek()).toEqual(camera);
  }
  for (const name of ["paypal", "federato", "utsa"] as const) {
    expect((await canvas.commands.closeWindow.run({ window: `${name}-detail` })).error).toBeNull();
    expect(canvas.state.document.content.windows[`${name}-detail`].peek()).toBeUndefined();
  }
  expect(
    (
      await canvas.commands.openWindow.run({
        id: "utsa-detail",
        kind: "career-detail",
        title: portfolio.content.windows.utsa.data.organization,
        data: { ...portfolio.content.windows.utsa.data, source: "main" },
        placement: { relativeTo: "main", side: "right", stack: true, gap: 24 },
      })
    ).error,
  ).toBeNull();
});

test("observable dependencies preserve the canvas runtime and its observable members", () => {
  const canvas = createCanvasState({ windowDefinitions: {} });
  const computed = canvas.computed;
  const track = computed.cameraTrack;
  const dependencies = observable([canvas]);
  dependencies.get();
  dependencies.set([canvas]);
  dependencies.get();
  expect(canvas.computed).toBe(computed);
  expect(canvas.computed.cameraTrack).toBe(track);
  expect(track.get()).toBeNull();
});

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

test("revealing a visible window selects it without moving the camera", async () => {
  const canvas = createState();
  const camera = canvas.computed.camera.peek();
  const result = await canvas.commands.revealWindow.run({
    window: "a",
    behavior: { type: "fit", maxZoom: 1 },
  });
  expect(result.error).toBeNull();
  expect(canvas.computed.view.activeWindowId.peek()).toBe("a");
  expect(canvas.computed.camera.peek()).toEqual(camera);
});

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
  canvas.actions.previewCamera.run({ center: { x: 120, y: 80 }, zoom: 1 });
  const initial = canvas.computed.camera.peek();
  expect(await canvas.camera.navigate({ target: { type: "window", windowId: "missing" } })).toEqual(
    { status: "unavailable" },
  );
  expect(canvas.computed.camera.peek()).toEqual(initial);
});

test("camera navigation starts from the displayed zoom", async () => {
  const canvas = createState();
  canvas.actions.previewCamera.run({ center: { x: 120, y: 80 }, zoom: 1 });
  await canvas.camera.navigate({
    target: { type: "point", point: { x: 200, y: 300 } },
    behavior: { type: "center" },
    reducedMotion: "always",
  });
  expect(canvas.computed.camera.peek()).toEqual({ center: { x: 200, y: 300 }, zoom: 1 });
  expect(canvas.state.session.camera.peek()).toBeNull();
});

test("pan and zoom commit the displayed camera and clear its preview", () => {
  const canvas = createState();
  canvas.actions.previewCamera.run({ center: { x: 120, y: 80 }, zoom: 1 });
  canvas.actions.panCamera.run({ x: 30, y: 40 });
  expect(canvas.computed.camera.peek()).toEqual({ center: { x: 150, y: 120 }, zoom: 1 });
  expect(canvas.state.session.camera.peek()).toBeNull();

  canvas.actions.previewCamera.run({ center: { x: 120, y: 80 }, zoom: 1 });
  canvas.actions.zoomCamera.run({ factor: 2, point: { x: 500, y: 400 } });
  expect(canvas.computed.camera.peek()).toEqual({ center: { x: 120, y: 80 }, zoom: 2 });
  expect(canvas.computed.view.camera.peek()).toEqual(canvas.computed.camera.peek());
  expect(canvas.state.session.camera.peek()).toBeNull();
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
  expect(canvas.state.document.content.windows.row.title.peek()).toBe("");
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
  expect(canvas.computed.parents.c.peek()).toBe("stack");
  expect(canvas.computed.view.activeChildren.stack.peek()).toBe("c");
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

test("a window whose width follows the viewport is as wide as the viewport until it is resized", () => {
  const canvas = createCanvasState({
    windowDefinitions: { note: {} },
    viewport: { width: 1000, height: 800 },
    viewportInsets: { left: 40 },
    document: {
      content: {
        windows: {
          board: {
            title: "Board",
            widthMode: "viewport",
            rect: { x: 0, y: 0, width: 1200, height: 400 },
            layout: { type: "grid", columns: 12, rowHeight: 40 },
            children: ["a"],
          },
          a: { kind: "note", title: "A", rect: { x: 0, y: 0, width: 200, height: 100 } },
          b: {
            kind: "note",
            title: "B",
            widthMode: "viewport",
            rect: { x: 0, y: 500, width: 200, height: 100 },
          },
        },
      },
    },
  });
  expect(canvas.computed.windowRect.board.width.peek()).toBe(960);
  expect(canvas.computed.windowRect.b.width.peek()).toBe(960);
  canvas.state.input.viewport.width.set(500);
  expect(canvas.computed.windowRect.board.width.peek()).toBe(460);
  canvas.actions.resizeWindow.run({ window: "b", width: 300, height: 100 });
  expect(canvas.state.document.content.windows.b.widthMode.peek()).toBe("manual");
  expect(canvas.computed.windowRect.b.width.peek()).toBe(300);
  canvas.actions.setWindowSizeMode.run({ window: "b", widthMode: "viewport" });
  expect(canvas.computed.windowRect.b.width.peek()).toBe(460);
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

test("the selection's component actions are the runnable ones for a single kind", () => {
  const schema = type({ done: "boolean = false" });
  const canvas = createCanvasState({
    viewport: { width: 1000, height: 800 },
    windowDefinitions: {
      task: {
        schema,
        actions: bindComponentActions({
          schema,
          actions: {
            complete: { label: "Complete", set: { done: true }, enabled: (props) => !props.done },
            reopen: { label: "Reopen", multiple: true, set: { done: false } },
          },
        }),
      },
      label: { schema: type({ text: "string = ''" }) },
    },
    document: {
      content: {
        windows: {
          a: {
            id: "a",
            kind: "task",
            title: "A",
            mode: "normal",
            isPinned: false,
            heightMode: "manual",
            rect: { x: 0, y: 0, width: 200, height: 100 },
            data: { done: false },
          },
          b: {
            id: "b",
            kind: "task",
            title: "B",
            mode: "normal",
            isPinned: false,
            heightMode: "manual",
            rect: { x: 300, y: 0, width: 200, height: 100 },
            data: { done: true },
          },
          c: {
            id: "c",
            kind: "label",
            title: "C",
            mode: "normal",
            isPinned: false,
            heightMode: "manual",
            rect: { x: 600, y: 0, width: 200, height: 100 },
            data: { text: "" },
          },
        },
      },
    },
  });
  const componentActions = () =>
    getRunnableCommands(canvas)
      .filter((command) => command.ready && command.name.startsWith("runComponentAction:"))
      .map(({ label, icon, input }) => ({
        label,
        icon,
        input: type({ action: "string", windows: "string[]" }).assert(input),
      }));
  expect(componentActions()).toEqual([]);
  canvas.actions.selectWindow.run({ window: "b" });
  expect(componentActions()).toEqual([
    { label: "Reopen", icon: "edit", input: { action: "reopen", windows: ["b"] } },
  ]);
  canvas.actions.selectTargets.run({ targets: [{ type: "window", id: "a" }], mode: "add" });
  expect(componentActions().map((entry) => entry.input.action)).toEqual(["reopen"]);
  canvas.actions.selectTargets.run({ targets: [{ type: "window", id: "c" }], mode: "add" });
  expect(componentActions()).toEqual([]);
  canvas.actions.selectWindow.run({ window: "a" });
  const [entry] = componentActions();
  expect(entry?.input).toEqual({ action: "complete", windows: ["a"] });
  expect(canvas.commands.runComponentAction.canRun(entry!.input)).toBe(true);
  canvas.actions.runComponentAction.run(entry!.input);
  expect(canvas.state.document.content.windows.a.data.get()).toEqual({ done: true });
  expect(componentActions().map((item) => item.input.action)).toEqual(["reopen"]);
});

function createReadingState() {
  return createCanvasState({
    windowDefinitions: { note: {} },
    viewport: { width: 1000, height: 800 },
    document: {
      content: {
        windows: {
          p: {
            id: "p",
            kind: "note",
            heightMode: "manual",
            rect: { x: 0, y: 200, width: 100, height: 100 },
          },
          q: {
            id: "q",
            kind: "note",
            heightMode: "manual",
            rect: { x: 400, y: 0, width: 100, height: 100 },
          },
        },
      },
    },
  });
}

test("the document carries the reading axis and the reading order follows it", () => {
  const canvas = createReadingState();
  expect(canvas.state.document.content.presentation.get()).toEqual({
    axis: "vertical",
    maxZoom: 1,
  });
  expect(canvas.computed.route.get().map((section) => section.id)).toEqual(["q", "p"]);
  canvas.actions.setPresentation.run({ axis: "horizontal" });
  expect(canvas.computed.route.get().map((section) => section.id)).toEqual(["p", "q"]);
  expect(canvas.state.document.content.presentation.maxZoom.get()).toBe(1);
});

test("an empty presentation change is rejected and a bad maximum zoom never lands", () => {
  const canvas = createReadingState();
  expect(canvas.actions.setPresentation.canRun({})).toBe(false);
  expect(canvas.actions.setPresentation.run({ maxZoom: 0 })).toBeInstanceOf(type.errors);
  expect(canvas.state.document.content.presentation.maxZoom.get()).toBe(1);
});

test("a window that fits its content keeps the measured height until its width changes, then waits for a new measurement", () => {
  const canvas = createCanvasState({
    windowDefinitions: { card: {} },
    viewport: { width: 1200, height: 800 },
    document: {
      content: {
        windows: {
          main: {
            id: "main",
            children: ["card"],
            layout: { type: "grid", columns: 1, rowHeight: 1, gap: 0, compact: true },
            rect: { x: 0, y: 0, width: 600, height: 600 },
          },
          card: {
            id: "card",
            kind: "card",
            heightMode: "content",
            rect: { x: 0, y: 0, width: 600, height: 380 },
          },
        },
      },
    },
  });
  const height = () => canvas.computed.windowRect.card.height.get();
  const width = () => canvas.computed.windowRect.card.width.get() ?? 0;
  expect(height()).toBe(380);
  canvas.actions.setContentSize.run({ windowId: "card", size: { width: width(), height: 120 } });
  expect(height()).toBe(120);
  canvas.actions.resizeWindow.run({ window: "main", width: 375 });
  expect(width()).toBe(375);
  expect(height()).toBe(380);
  canvas.actions.setContentSize.run({ windowId: "card", size: { width: 375, height: 210 } });
  expect(height()).toBe(210);
});

test("a window that follows the viewport stops at its own maximum width", () => {
  const canvas = createCanvasState({
    windowDefinitions: { page: {} },
    viewport: { width: 1440, height: 900 },
    document: {
      content: {
        windows: {
          page: {
            id: "page",
            kind: "page",
            widthMode: "viewport",
            heightMode: "manual",
            rect: { x: 0, y: 0, width: 600, height: 400 },
          },
        },
      },
    },
  });
  const width = () => canvas.computed.windowRect.page.width.get();
  expect(width()).toBe(1440);
  canvas.actions.setWindowSizeMode.run({ window: "page", maxSize: { width: 960 } });
  expect(width()).toBe(960);
  canvas.actions.setWindowSizeMode.run({ window: "page", maxSize: {} });
  expect(width()).toBe(1440);
  canvas.actions.setViewportInsets.run({ left: 700, right: 500 });
  expect(width()).toBe(240);
});

test("a container that follows the viewport stops at its maximum width and follows a resize", () => {
  const canvas = createCanvasState({
    windowDefinitions: { note: {} },
    snapping: { enabled: false },
    viewport: { width: 1000, height: 800 },
    document: {
      content: {
        windows: {
          board: {
            title: "Board",
            widthMode: "viewport",
            maxSize: { width: 880 },
            rect: { x: 0, y: 0, width: 400, height: 300 },
            layout: { type: "grid", columns: 4, rowHeight: 40, gap: 10 },
            children: ["a"],
          },
          a: { kind: "note", title: "A", rect: { x: 0, y: 0, width: 200, height: 100 } },
        },
      },
    },
  });
  const width = () => canvas.computed.windowRect.board.width.peek();
  const pointer = {
    pointerId: 1,
    point: { x: 500, y: 400 },
    altKey: false,
    ctrlKey: false,
    metaKey: false,
    shiftKey: false,
  };
  expect(width()).toBe(880);
  canvas.actions.pressResize.run({ window: "board", pointer, handle: "south", threshold: 0 });
  canvas.actions.updatePointer.run({ ...pointer, point: { x: 500, y: 600 } });
  canvas.actions.releasePointer.run({ pointerId: 1 });
  expect(canvas.state.document.content.windows.board.widthMode.peek()).toBe("viewport");
  canvas.actions.pressResize.run({ window: "board", pointer, handle: "east", threshold: 0 });
  canvas.actions.updatePointer.run({ ...pointer, point: { x: 300, y: 400 } });
  expect(width()).toBe(680);
  canvas.actions.releasePointer.run({ pointerId: 1 });
  expect(canvas.state.document.content.windows.board.rect.width.peek()).toBe(680);
  expect(canvas.state.document.content.windows.board.widthMode.peek()).toBe("manual");
  expect(width()).toBe(680);
});

test("vertical lane resizing preserves the displayed height after release", () => {
  const canvas = createCanvasState({
    windowDefinitions: { note: { minSize: { width: 50, height: 50 } } },
    snapping: { enabled: false },
    viewport: { width: 1000, height: 800 },
    document: {
      content: {
        windows: {
          board: {
            title: "Board",
            rect: { x: 0, y: 0, width: 600, height: 210 },
            layout: { type: "lanes", columns: 3, gap: 0 },
            children: ["a", "b", "c"],
          },
          ...Object.fromEntries(
            ["a", "b", "c"].map((id) => [
              id,
              {
                kind: "note",
                title: id,
                heightMode: "manual" as const,
                rect: { x: 0, y: 0, width: 200, height: 210 },
              },
            ]),
          ),
        },
      },
    },
  });
  const pointer = {
    pointerId: 1,
    point: { x: 500, y: 400 },
    altKey: false,
    ctrlKey: false,
    metaKey: false,
    shiftKey: false,
  };
  expect(canvas.computed.windowRect.c.height.peek()).toBe(210);
  canvas.actions.pressResize.run({ window: "c", pointer, handle: "south", threshold: 0 });
  canvas.actions.updatePointer.run({ ...pointer, point: { x: 500, y: 460 } });
  expect(canvas.computed.windowRect.c.height.peek()).toBe(270);
  canvas.actions.releasePointer.run({ pointerId: 1 });
  expect(canvas.state.document.content.windows.c.rect.height.peek()).toBe(270);
  expect(canvas.computed.windowRect.c.height.peek()).toBe(270);
  expect(canvas.computed.windowRect.a.height.peek()).toBe(210);
  expect(canvas.computed.windowRect.b.height.peek()).toBe(210);
});

test("a window docked into a container that follows the viewport takes the cell it was dropped on", () => {
  const canvas = createCanvasState({
    windowDefinitions: { card: { size: { width: 100, height: 100 } } },
    viewport: { width: 400, height: 800 },
    document: {
      content: {
        windows: {
          board: {
            title: "Board",
            widthMode: "viewport",
            rect: { x: 0, y: 0, width: 800, height: 400 },
            layout: { type: "grid", columns: 4, rowHeight: 100, gap: 0 },
            children: ["a"],
          },
          a: {
            kind: "card",
            title: "A",
            rect: { x: 0, y: 0, width: 100, height: 100 },
            item: { column: 0, row: 0, columnSpan: 1 },
          },
          c: { kind: "card", title: "C", rect: { x: 300, y: 0, width: 100, height: 100 } },
        },
      },
    },
  });
  expect(canvas.computed.windowRect.board.width.peek()).toBe(400);
  expect(canvas.actions.dockWindow.run({ window: "c", target: "board" })).toBeUndefined();
  expect(canvas.state.document.content.windows.c.item.column.peek()).toBe(3);
  expect(canvas.computed.windowRect.c.x.peek()).toBe(300);
});

test("a root that follows the viewport is read with the camera padding as its margin", () => {
  const canvas = createCanvasState({
    windowDefinitions: { note: {} },
    viewport: { width: 375, height: 812 },
    document: {
      content: {
        windows: {
          board: {
            title: "Board",
            widthMode: "viewport",
            rect: { x: 0, y: 0, width: 1200, height: 400 },
            layout: { type: "grid", columns: 1, rowHeight: 40 },
            children: ["a"],
          },
          a: { kind: "note", title: "A", rect: { x: 0, y: 0, width: 200, height: 100 } },
        },
      },
    },
  });
  const track = getCameraTrack({
    sections: canvas.computed.route.get(),
    viewport: canvas.state.input.viewport.get(),
    insets: canvas.computed.viewportInsets.get(),
    limits: canvas.state.config.camera.get(),
    maxZoom: canvas.state.document.content.presentation.maxZoom.get(),
  });
  expect(canvas.computed.windowRect.board.width.peek()).toBe(375);
  expect(track?.zoom).toBeCloseTo((375 - 72) / 375, 5);
});

test("snapping and the camera limits are settable, and disordered zoom limits are refused", () => {
  const canvas = createReadingState();
  expect(canvas.state.config.snapping.enabled.get()).toBe(true);
  canvas.actions.setSnapping.run({ enabled: false, threshold: 12 });
  expect(canvas.state.config.snapping.get()).toEqual({
    enabled: false,
    threshold: 12,
    edges: true,
    centers: true,
  });
  expect(canvas.actions.setSnapping.canRun({})).toBe(false);
  canvas.actions.setCameraLimits.run({ maxZoom: 2 });
  expect(canvas.state.config.camera.maxZoom.get()).toBe(2);
  expect(canvas.actions.setCameraLimits.run({ maxZoom: 0.05 })).toBeInstanceOf(type.errors);
  expect(canvas.state.config.camera.maxZoom.get()).toBe(2);
});

test("a window takes its kind's place in the reading order until the author overrides it", () => {
  const canvas = createCanvasState({
    windowDefinitions: { note: {}, mark: { navigable: false } },
    viewport: { width: 1000, height: 800 },
    document: {
      content: {
        windows: {
          p: {
            id: "p",
            kind: "note",
            heightMode: "manual",
            rect: { x: 0, y: 200, width: 100, height: 100 },
          },
          q: {
            id: "q",
            kind: "mark",
            heightMode: "manual",
            rect: { x: 400, y: 0, width: 100, height: 100 },
          },
        },
      },
    },
  });
  const order = () => canvas.computed.route.get().map((section) => section.id);
  expect(order()).toEqual(["p"]);
  canvas.actions.setWindowNavigable.run({ window: "q", navigable: true });
  expect(order()).toEqual(["q", "p"]);
  canvas.actions.setWindowNavigable.run({ window: "q" });
  expect(order()).toEqual(["p"]);
});

test("a panel that hugs one edge insets the camera by its extent, and a floating one does not", () => {
  const canvas = createReadingState();
  const insets = () => canvas.computed.viewportInsets.get();
  expect(insets()).toEqual({ top: 0, right: 0, bottom: 0, left: 0 });
  canvas.actions.setViewportOccluder.run({
    source: "palette",
    rect: { x: 804, y: 0, width: 196, height: 800 },
  });
  expect(insets()).toEqual({ top: 0, right: 196, bottom: 0, left: 0 });
  canvas.actions.setViewportOccluder.run({
    source: "rail",
    rect: { x: 0, y: 744, width: 1000, height: 56 },
  });
  expect(insets()).toEqual({ top: 0, right: 196, bottom: 56, left: 0 });
  canvas.actions.setViewportOccluder.run({
    source: "pill",
    rect: { x: 400, y: 700, width: 200, height: 40 },
  });
  expect(insets()).toEqual({ top: 0, right: 196, bottom: 56, left: 0 });
  canvas.actions.setViewportOccluder.run({ source: "palette" });
  expect(insets()).toEqual({ top: 0, right: 0, bottom: 56, left: 0 });
});

test("every command's input converts to JSON Schema, so listing them for an agent never throws", () => {
  const canvas = createReadingState();
  const commands: Record<string, { input: type.Any }> = canvas.commands;
  const converted = Object.entries(commands).map(([name, command]) => [
    name,
    typeof command.input.toJsonSchema({ fallback: { default: (context) => context.base } }),
  ]);
  expect(converted.every(([, kind]) => kind === "object")).toBe(true);
  expect(converted.length).toBeGreaterThan(20);
});

test("check gives the reason canRun refused, so an agent hears what the launcher shows", () => {
  const canvas = createReadingState();
  const commands: Record<
    string,
    { check(input: unknown): string | null; canRun(input: unknown): boolean }
  > = canvas.commands;
  const probes: unknown[] = [{}, { window: "p", windows: ["p"] }, { axis: "horizontal" }];
  const disagreed = Object.entries(commands).flatMap(([name, command]) =>
    probes.flatMap((probe) =>
      command.canRun(probe) === (command.check(probe) === null)
        ? []
        : [`${name} ${JSON.stringify(probe)}`],
    ),
  );
  expect(disagreed).toEqual([]);
  expect(canvas.commands.setPresentation.check({})).toContain("axis");
  expect(canvas.commands.setPresentation.check({ axis: "horizontal" })).toBeNull();
});

test("the presentation input renders as a form", () => {
  const canvas = createReadingState();
  const json = canvas.commands.setPresentation.input.toJsonSchema({
    dialect: null,
    fallback: { predicate: (context) => context.base },
  });
  expect(json).toMatchObject({
    type: "object",
    properties: {
      axis: { enum: ["horizontal", "vertical"] },
      maxZoom: { type: "number", exclusiveMinimum: 0 },
    },
  });
});
