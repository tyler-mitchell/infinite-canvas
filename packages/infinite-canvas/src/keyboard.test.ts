import { expect, test } from "vite-plus/test";

import { getInfiniteCanvasHotkeyBindings } from "./commands";
import { createInfiniteCanvasState } from "./factory";
import {
  resolveInfiniteCanvasHotkeys,
  shouldHandleInfiniteCanvasKeyboardEvent,
  type InfiniteCanvasHotkeyAction,
} from "./keyboard";
import type { InfiniteCanvasCommand } from "./types";

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

/**
 * Chords a consumer claims for verbs the canvas does not own.
 *
 * The first test is the whole point of the affordance and the one that fails against what shipped
 * before it. `hotkeyBindings` was documented as the way to claim an unclaimed chord — the arrange
 * and dock verbs ship with none and say so — but it is a *default parameter*, so a consumer taking
 * that advice silently traded every canvas shortcut for the one it wanted, with nothing to report
 * it. Actions are a separate input for that reason, and this asserts the union rather than the
 * replacement.
 */
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

const noCommands = (_command: InfiniteCanvasCommand) => {
  throw new Error("no canvas command should run in these tests");
};

test("consumer actions are added to the canvas keymap, not swapped for it", () => {
  const resolved = resolveInfiniteCanvasHotkeys<"note">({
    actions: [cut(() => undefined)],
    executeCommand: noCommands,
  });
  const defaults = getInfiniteCanvasHotkeyBindings();

  // Every default chord survives, and both of the consumer's arrive: one entry per chord, the way
  // a command descriptor's `hotkeys` flatten.
  expect(resolved).toHaveLength(defaults.length + 2);
  expect(resolved.map((entry) => entry.hotkey)).toContain("Mod+Z");
  expect(resolved.filter((entry) => entry.label === "Cut Connection").map((e) => e.hotkey)).toEqual(
    ["Backspace", "Delete"],
  );
});

test("a consumer action runs its own verb, and is gated by its own enablement", () => {
  const ran: string[] = [];
  const resolved = resolveInfiniteCanvasHotkeys<"note">({
    actions: [
      cut(() => {
        ran.push("cut");
      }),
    ],
    bindings: [],
    executeCommand: noCommands,
  });

  resolved.forEach((entry) => {
    if (entry.isEnabled(STATE)) {
      entry.run(STATE);
    }
  });

  // Two chords, one verb each — pressing either does the thing.
  expect(ran).toEqual(["cut", "cut"]);
});

test("an action with nothing to act on is disabled, and the canvas still swallows its chord", () => {
  const resolved = resolveInfiniteCanvasHotkeys<"note">({
    actions: [
      cut(
        () => {
          throw new Error("a disabled action must not run");
        },
        () => false,
      ),
    ],
    bindings: [],
    executeCommand: noCommands,
  });

  // Disabled means "does nothing", never "is not registered": the entry is still here, so the
  // handler still claims the keypress. A chord that fell through to the browser only while
  // unavailable would be the same trap `Alt+ArrowLeft` was.
  expect(resolved).toHaveLength(2);
  resolved.forEach((entry) => {
    expect(entry.isEnabled(STATE)).toBe(false);
  });
});
