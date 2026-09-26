import { act } from "react";
import { createRoot } from "react-dom/client";
import { afterEach, beforeEach, expect, test, vi } from "vite-plus/test";
import { Card } from "./card.tsx";

const measurements = new Map<Element, ResizeObserverCallback>();
const host = document.createElement("div");
const root = createRoot(host);

beforeEach(() => {
  document.body.append(host);
  vi.stubGlobal("IS_REACT_ACT_ENVIRONMENT", true);
  vi.stubGlobal(
    "ResizeObserver",
    class {
      constructor(readonly callback: ResizeObserverCallback) {}
      observe(target: Element) {
        measurements.set(target, this.callback);
      }
      unobserve(target: Element) {
        measurements.delete(target);
      }
      disconnect() {
        measurements.forEach((callback, target) => {
          if (callback === this.callback) measurements.delete(target);
        });
      }
    },
  );
});

afterEach(() => {
  act(() => root.render(null));
  host.remove();
  measurements.clear();
  vi.unstubAllGlobals();
});

function Content({ onContentHeightChange }: { onContentHeightChange?: (height: number) => void }) {
  return (
    <Card.Body
      onContentHeightChange={onContentHeightChange}
      style={{ padding: 10, border: "2px solid", rowGap: 12 }}
    >
      <Card.Header>Heading</Card.Header>
      <Card.Content>Content</Card.Content>
      <Card.Footer>Footer</Card.Footer>
    </Card.Body>
  );
}

test("cards without height reporting do not observe their layout", () => {
  act(() => root.render(<Content />));
  expect(measurements.size).toBe(0);
});

test("height reporting measures content and spacing, then disconnects when disabled", () => {
  const onContentHeightChange = vi.fn();
  act(() => root.render(<Content onContentHeightChange={onContentHeightChange} />));
  expect(measurements.size).toBe(4);
  act(() => {
    measurements.forEach((callback, target) => {
      callback(
        [
          {
            target,
            borderBoxSize: [{ inlineSize: 300, blockSize: 40 }],
          } as ResizeObserverEntry,
        ],
        {} as ResizeObserver,
      );
    });
  });
  expect(onContentHeightChange).toHaveBeenLastCalledWith(168);
  act(() => root.render(<Content />));
  expect(measurements.size).toBe(0);
});
