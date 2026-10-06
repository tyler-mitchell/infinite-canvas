import { expect, test } from "vite-plus/test";

import { getInfiniteCanvasHotkeyBindings } from "./operations";
import { createInfiniteCanvasState } from "./factory";
import {
  resolveInfiniteCanvasHotkeys,
  shouldHandleInfiniteCanvasKeyboardEvent,
  type InfiniteCanvasHotkeyAction,
} from "./keyboard";
import type { InfiniteCanvasAction } from "./types";

class TestElement {
  parent: TestElement | null = null;

  constructor(private readonly excluded = false) {}

  append(...children: readonly TestElement[]) {
    children.forEach((child) => {
      child.parent = this;
    });
  }

  closest(_selector: string): TestElement | null {
    return this.excluded ? this : (this.parent?.closest(_selector) ?? null);
  }

  contains(target: unknown): boolean {
    return target === this || (target instanceof TestElement && this.contains(target.parent));
  }
}

function withTestElementConstructor(run: () => void) {
  const originalElement = globalThis.Element;

  globalThis.Element = TestElement as unknown as typeof Element;

  try {
    run();
  } finally {
    globalThis.Element = originalElement;
  }
}

function createKeyboardEvent(target: TestElement, init: Partial<KeyboardEvent> = {}) {
  return {
    defaultPrevented: false,
    isComposing: false,
    key: "A",
    ...init,
    target,
  } as unknown as KeyboardEvent;
}

test("keyboard guard accepts events on the canvas command surface", () => {
  withTestElementConstructor(() => {
    const surface = new TestElement();
    const event = createKeyboardEvent(surface);

    expect(shouldHandleInfiniteCanvasKeyboardEvent(event, surface as unknown as HTMLElement)).toBe(
      true,
    );
  });
});

test("keyboard guard rejects editable and window-body targets", () => {
  withTestElementConstructor(() => {
    const surface = new TestElement();
    const input = new TestElement(true);
    const body = new TestElement(true);

    surface.append(input, body);

    expect(
      shouldHandleInfiniteCanvasKeyboardEvent(
        createKeyboardEvent(input),
        surface as unknown as HTMLElement,
      ),
    ).toBe(false);
    expect(
      shouldHandleInfiniteCanvasKeyboardEvent(
        createKeyboardEvent(body),
        surface as unknown as HTMLElement,
      ),
    ).toBe(false);
  });
});

test("keyboard guard rejects composition events", () => {
  withTestElementConstructor(() => {
    const surface = new TestElement();
    const event = createKeyboardEvent(surface, {
      isComposing: true,
    });

    expect(shouldHandleInfiniteCanvasKeyboardEvent(event, surface as unknown as HTMLElement)).toBe(
      false,
    );
  });
});

const STATE = createInfiniteCanvasState<"note">({ windows: [] });

const cut = (
  run: () => void,
  isEnabled?: InfiniteCanvasHotkeyAction<"note">["isEnabled"],
): InfiniteCanvasHotkeyAction<"note"> => ({
  description: "Remove the selected connections.",
  hotkeys: ["Backspace", "Delete"],
  id: "connection.cut",
  isEnabled,
  label: "Cut Connection",
  run,
});

const noDispatch = (_action: InfiniteCanvasAction<"note">) => {
  throw new Error("no canvas command should run in these tests");
};

test("consumer actions are added to the canvas keymap, not swapped for it", () => {
  const resolved = resolveInfiniteCanvasHotkeys<"note">({
    hotkeyActions: [cut(() => undefined)],
    dispatch: noDispatch,
    isCommandEnabled: () => false,
  });
  const defaults = getInfiniteCanvasHotkeyBindings();

  expect(resolved).toHaveLength(defaults.length + 2);
  expect(resolved.slice(0, defaults.length).every((entry) => !entry.isEnabled(STATE))).toBe(true);
  expect(resolved.map((entry) => entry.hotkey)).toContain("Mod+Z");
  expect(resolved.filter((entry) => entry.label === "Cut Connection").map((e) => e.hotkey)).toEqual(
    ["Backspace", "Delete"],
  );
});

test("a consumer action runs its own verb, and is gated by its own enablement", () => {
  const ran: string[] = [];
  const resolved = resolveInfiniteCanvasHotkeys<"note">({
    hotkeyActions: [
      cut(() => {
        ran.push("cut");
      }),
    ],
    bindings: [],
    dispatch: noDispatch,
    isCommandEnabled: () => true,
  });

  resolved.forEach((entry) => {
    if (entry.isEnabled(STATE)) {
      entry.run(STATE);
    }
  });

  expect(ran).toEqual(["cut", "cut"]);
});

test("an action with nothing to act on is disabled, and the canvas still swallows its chord", () => {
  const resolved = resolveInfiniteCanvasHotkeys<"note">({
    hotkeyActions: [
      cut(
        () => {
          throw new Error("a disabled action must not run");
        },
        () => false,
      ),
    ],
    bindings: [],
    dispatch: noDispatch,
    isCommandEnabled: () => true,
  });

  expect(resolved).toHaveLength(2);
  resolved.forEach((entry) => {
    expect(entry.isEnabled(STATE)).toBe(false);
  });
});
