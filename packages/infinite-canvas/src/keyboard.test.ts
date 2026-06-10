import { expect, test } from "vite-plus/test";

import { shouldHandleInfiniteCanvasKeyboardEvent } from "./keyboard";

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
