import { expect, test } from "vite-plus/test";

import { DEFAULT_INFINITE_CANVAS_INPUT_POLICY } from "#/experiments/infinite-canvas/constants";
import {
  getInfiniteCanvasIdleCursor,
  getInfiniteCanvasInteractionCursor,
  getInfiniteCanvasPointerMode,
  withInfiniteCanvasPointerMode,
} from "#/experiments/infinite-canvas/input-policy";
import type { InfiniteCanvasInputPolicy } from "#/experiments/infinite-canvas/types";

test("input policy derives the explicit toolbar pointer mode", () => {
  expect(getInfiniteCanvasPointerMode({ emptyCanvasDrag: "marquee" })).toBe("marquee");
  expect(getInfiniteCanvasPointerMode({ emptyCanvasDrag: "pan" })).toBe("pan");
  expect(getInfiniteCanvasPointerMode({ emptyCanvasDrag: "marqueeWhenSelectionExists" })).toBe(
    "marquee",
  );
});

test("input policy defaults the canvas to pan mode", () => {
  expect(getInfiniteCanvasPointerMode(DEFAULT_INFINITE_CANVAS_INPUT_POLICY)).toBe("pan");
});

test("input policy can be specialized by an explicit pointer mode", () => {
  const policy = {
    emptyCanvasDrag: "marqueeWhenSelectionExists",
  } satisfies InfiniteCanvasInputPolicy;

  expect(withInfiniteCanvasPointerMode(policy, "pan")).toEqual({
    emptyCanvasDrag: "pan",
  });
  expect(withInfiniteCanvasPointerMode(policy, "marquee")).toEqual({
    emptyCanvasDrag: "marquee",
  });
});

test("input policy defaults to a normal canvas cursor convention", () => {
  const policy = {
    emptyCanvasDrag: "marquee",
  } satisfies InfiniteCanvasInputPolicy;

  expect(getInfiniteCanvasIdleCursor(policy, "marquee")).toBe("default");
  expect(getInfiniteCanvasIdleCursor(policy, "pan")).toBe("default");
  expect(getInfiniteCanvasInteractionCursor(policy, "marquee")).toBe("default");
  expect(getInfiniteCanvasInteractionCursor(policy, "pan")).toBe("default");
  expect(getInfiniteCanvasInteractionCursor(policy, "move")).toBe("grabbing");
});

test("input policy accepts consumer cursor overrides", () => {
  const policy = {
    cursor: {
      idle: {
        marquee: "crosshair",
        pan: "grab",
      },
      interaction: {
        marquee: "crosshair",
        pan: "grabbing",
      },
    },
    emptyCanvasDrag: "marquee",
  } satisfies InfiniteCanvasInputPolicy;

  expect(getInfiniteCanvasIdleCursor(policy, "marquee")).toBe("crosshair");
  expect(getInfiniteCanvasIdleCursor(policy, "pan")).toBe("grab");
  expect(getInfiniteCanvasInteractionCursor(policy, "marquee")).toBe("crosshair");
  expect(getInfiniteCanvasInteractionCursor(policy, "pan")).toBe("grabbing");
  expect(getInfiniteCanvasInteractionCursor(policy, "move")).toBe("grabbing");
});
