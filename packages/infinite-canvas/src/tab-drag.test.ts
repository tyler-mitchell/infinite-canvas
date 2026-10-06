import { expect, test } from "vite-plus/test";
import { createCanvasState } from "./state";

function createState() {
  const canvas = createCanvasState({
    windowDefinitions: { card: {} },
    viewport: { width: 1000, height: 800 },
  });
  ["a", "b", "c"].forEach((id, index) =>
    canvas.actions.openWindow.run({
      id,
      kind: "card",
      title: id,
      rect: { x: index * 220, y: 0, width: 200, height: 100 },
    }),
  );
  canvas.actions.groupWindows.run({
    id: "stack",
    windows: ["a", "b", "c"],
    layout: { type: "tabs" },
    rect: { x: 0, y: 0, width: 600, height: 240 },
  });
  return canvas;
}

const pointer = {
  pointerId: 1,
  point: { x: 550, y: 415 },
  altKey: false,
  ctrlKey: false,
  metaKey: false,
  shiftKey: false,
};
const target = { container: "stack", child: "a" };
const strip = (canvas: ReturnType<typeof createState>) =>
  canvas.computed.arrangement.stack.controls.stack
    .peek()
    ?.find((control) => control.type === "tabs");

test("tab order previews without document writes and commits once", () => {
  const canvas = createState();
  expect(canvas.actions.beginTabDrag.run({ target, pointer })).toBeUndefined();
  canvas.actions.updatePointer.run({ ...pointer, point: { x: 750, y: 415 } });
  canvas.actions.targetTab.run({ child: "c", after: true });
  const preview = strip(canvas);
  expect(preview?.type === "tabs" && preview.children).toEqual(["b", "c", "a"]);
  expect(canvas.state.document.content.windows.stack.children.peek()).toEqual(["a", "b", "c"]);
  canvas.actions.renameWindow.run({ window: "b", title: "Saved during reorder" });
  canvas.actions.releasePointer.run({ pointerId: 1 });
  expect(canvas.state.session.tabDrag.peek()).toBeNull();
  expect(canvas.state.document.content.windows.stack.children.peek()).toEqual(["b", "c", "a"]);
  canvas.actions.undo.run({});
  expect(canvas.state.document.content.windows.stack.children.peek()).toEqual(["a", "b", "c"]);
  expect(canvas.state.document.content.windows.b.title.peek()).toBe("Saved during reorder");
});

test("tab tear-out keeps pointer ownership and can be cancelled", () => {
  const canvas = createState();
  canvas.actions.beginTabDrag.run({ target, pointer });
  canvas.actions.updatePointer.run({ ...pointer, point: { x: 550, y: 480 } });
  expect(canvas.state.session.tabDrag.peek()).toBeNull();
  expect(canvas.computed.capturedPointerId.peek()).toBe(1);
  expect(canvas.computed.detachedRects.a.peek()).toBeDefined();
  expect(canvas.computed.windowParent.a.peek()).toBe("stack");
  canvas.actions.cancelPointer.run({ pointerId: 1 });
  expect(canvas.computed.detachedRects.a.peek()).toBeUndefined();
  expect(canvas.computed.windowVisible.a.peek()).toBe(true);
  expect(canvas.computed.windowParent.a.peek()).toBe("stack");
});
