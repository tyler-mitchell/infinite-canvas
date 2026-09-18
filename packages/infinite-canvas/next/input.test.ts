import { expect, test, vi } from "vite-plus/test";
import { defaultHotkeys, getHotkeyDefinitions } from "./input";
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
