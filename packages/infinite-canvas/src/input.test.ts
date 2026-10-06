import { expect, test, vi } from "vite-plus/test";
import { capturePointer, defaultHotkeys, getHotkeyDefinitions } from "./input";
import { createCanvasState } from "./state";

const press = {
  defaultPrevented: false,
  isComposing: false,
  key: "",
  target: null,
  preventDefault: () => {},
  stopPropagation: () => {},
} as unknown as KeyboardEvent;

vi.stubGlobal("Element", class {});

test("failed pointer capture cancels the gesture without committing its camera preview", () => {
  const canvas = createCanvasState({ windowDefinitions: { note: {} } });
  const camera = canvas.computed.camera.peek();
  const pointer = {
    pointerId: 7,
    point: { x: 10, y: 10 },
    altKey: false,
    ctrlKey: false,
    metaKey: false,
    shiftKey: false,
  };
  canvas.actions.beginPan.run(pointer);
  canvas.actions.updatePointer.run({ ...pointer, point: { x: 50, y: 30 } });
  expect(canvas.computed.camera.peek()).not.toEqual(camera);
  const error = new Error("Pointer is no longer active");
  const warning = vi.spyOn(console, "warn").mockImplementation(() => {});
  try {
    capturePointer({
      canvas,
      pointerId: 7,
      element: {
        setPointerCapture: () => {
          throw error;
        },
      },
    });
    expect(canvas.computed.capturedPointerId.peek()).toBeNull();
    expect(canvas.computed.camera.peek()).toEqual(camera);
    expect(warning).toHaveBeenCalledWith("Pointer capture failed; gesture cancelled.", error);
  } finally {
    warning.mockRestore();
  }
});

test("hotkey bindings run commands with their input, accept custom actions, and drop removed keys", () => {
  const canvas = createCanvasState({
    windowDefinitions: { note: {} },
    nudge: { step: 2, largeStep: 20 },
    document: {
      content: {
        windows: { a: { kind: "note", title: "A", rect: { x: 0, y: 0, width: 100, height: 80 } } },
      },
    },
  });
  canvas.actions.selectWindow.run({ window: "a" });
  const run = vi.fn();
  const definitions = getHotkeyDefinitions({
    canvas,
    hotkeys: {
      ...defaultHotkeys,
      "Mod+A": null,
      "Mod+D": { label: "Duplicate", run },
    },
  });
  const byKey = Object.fromEntries(
    definitions.map((definition) => [definition.hotkey, definition]),
  );
  expect(byKey["Mod+A"]).toBeUndefined();
  byKey["Shift+ArrowRight"].callback(press);
  byKey.ArrowUp.callback(press);
  expect(canvas.state.document.content.windows.a.rect.peek()).toMatchObject({ x: 20, y: -2 });
  byKey["Mod+D"].callback(press);
  expect(run).toHaveBeenCalledTimes(1);
  expect(byKey["Mod+Z"].options.meta.name).toBe("Undo");
});
