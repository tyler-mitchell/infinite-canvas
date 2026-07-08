/**
 * Characterization tests for the persisted-state parsers.
 *
 * These were written against the original arktype implementation and pass
 * unchanged against the hand-rolled guards that replaced it, which is the
 * evidence that removing arktype (34% of the shipped bundle, on every
 * consumer's path via store -> persistence -> validation) changed no behavior.
 *
 * Semantics locked here, verified empirically against arktype:
 *  - `number.safe`      -> finite number with |value| <= Number.MAX_SAFE_INTEGER
 *  - `number.safe > 0`  -> the above, and strictly positive
 *  - `version: "1"`     -> the numeric literal 1 (the string "1" is invalid)
 *  - `"+": "delete"`    -> unknown keys are stripped from the result
 */
import { expect, test } from "vite-plus/test";

import {
  parseInfiniteCanvasCamera,
  parseInfiniteCanvasPoint,
  parseInfiniteCanvasRect,
  parseInfiniteCanvasSelection,
  parseInfiniteCanvasSerializedState,
  parseInfiniteCanvasSize,
  parseInfiniteCanvasWindow,
} from "./validation";

const UNSAFE = Number.MAX_SAFE_INTEGER + 1;

const validWindow = {
  id: "w1",
  isPinned: false,
  kind: "note",
  minSize: { height: 120, width: 160 },
  rect: { height: 180, width: 260, x: 20, y: 40 },
  title: "Demo",
  zIndex: 0,
};

test("point accepts finite safe numbers, including fractional and negative", () => {
  expect(parseInfiniteCanvasPoint({ x: -672.5, y: 0 })).toEqual({ x: -672.5, y: 0 });
  expect(parseInfiniteCanvasPoint({ x: Number.MAX_SAFE_INTEGER, y: 1 })).toEqual({
    x: Number.MAX_SAFE_INTEGER,
    y: 1,
  });
});

test("point rejects non-finite, unsafe, wrong-typed, and missing values", () => {
  expect(parseInfiniteCanvasPoint({ x: Number.NaN, y: 0 })).toBeNull();
  expect(parseInfiniteCanvasPoint({ x: Number.POSITIVE_INFINITY, y: 0 })).toBeNull();
  expect(parseInfiniteCanvasPoint({ x: Number.NEGATIVE_INFINITY, y: 0 })).toBeNull();
  expect(parseInfiniteCanvasPoint({ x: UNSAFE, y: 0 })).toBeNull();
  expect(parseInfiniteCanvasPoint({ x: 1e308, y: 0 })).toBeNull();
  expect(parseInfiniteCanvasPoint({ x: "5", y: 0 })).toBeNull();
  expect(parseInfiniteCanvasPoint({ x: 0 })).toBeNull();
  expect(parseInfiniteCanvasPoint(null)).toBeNull();
  expect(parseInfiniteCanvasPoint([0, 0])).toBeNull();
  expect(parseInfiniteCanvasPoint("nope")).toBeNull();
});

test("point strips unknown keys", () => {
  expect(parseInfiniteCanvasPoint({ extra: "gone", x: 1, y: 2 })).toEqual({ x: 1, y: 2 });
});

test("size and rect require strictly positive dimensions", () => {
  expect(parseInfiniteCanvasSize({ height: 0.5, width: 1 })).toEqual({ height: 0.5, width: 1 });
  expect(parseInfiniteCanvasSize({ height: 0, width: 1 })).toBeNull();
  expect(parseInfiniteCanvasSize({ height: -1, width: 1 })).toBeNull();
  expect(parseInfiniteCanvasRect({ height: 1, width: 0, x: 0, y: 0 })).toBeNull();
  expect(parseInfiniteCanvasRect({ height: 1, width: 1, x: -5.5, y: 5.5 })).toEqual({
    height: 1,
    width: 1,
    x: -5.5,
    y: 5.5,
  });
});

test("camera validates its nested point and positive zoom", () => {
  expect(parseInfiniteCanvasCamera({ center: { x: 1, y: 2 }, zoom: 0.5 })).toEqual({
    center: { x: 1, y: 2 },
    zoom: 0.5,
  });
  expect(parseInfiniteCanvasCamera({ center: { x: 1, y: 2 }, zoom: 0 })).toBeNull();
  expect(
    parseInfiniteCanvasCamera({ center: { x: Number.POSITIVE_INFINITY, y: 2 }, zoom: 1 }),
  ).toBeNull();
  expect(parseInfiniteCanvasCamera({ center: { extra: 1, x: 1, y: 2 }, zoom: 1 })).toEqual({
    center: { x: 1, y: 2 },
    zoom: 1,
  });
});

test("selection normalizes a missing anchor to null and omits absent targets", () => {
  expect(parseInfiniteCanvasSelection({ windowIds: ["a", "b"] })).toEqual({
    anchorWindowId: null,
    windowIds: ["a", "b"],
  });
  expect(parseInfiniteCanvasSelection({ anchorWindowId: null, windowIds: [] })).toEqual({
    anchorWindowId: null,
    windowIds: [],
  });
});

test("selection preserves valid targets and rejects invalid ones", () => {
  expect(
    parseInfiniteCanvasSelection({
      anchorWindowId: "a",
      targets: [{ id: "e1", kind: "link", type: "edge" }],
      windowIds: ["a"],
    }),
  ).toEqual({
    anchorWindowId: "a",
    targets: [{ id: "e1", kind: "link", type: "edge" }],
    windowIds: ["a"],
  });

  expect(
    parseInfiniteCanvasSelection({
      targets: [{ id: "e1", kind: "link", type: "not-a-target-type" }],
      windowIds: [],
    }),
  ).toBeNull();
  expect(parseInfiniteCanvasSelection({ windowIds: "a" })).toBeNull();
  expect(parseInfiniteCanvasSelection({ windowIds: [1] })).toBeNull();
});

test("selection target keeps opaque data when present", () => {
  const parsed = parseInfiniteCanvasSelection({
    targets: [{ data: { any: "payload" }, id: "e1", kind: "link", type: "scene-object" }],
    windowIds: [],
  });

  expect(parsed?.targets?.[0]).toEqual({
    data: { any: "payload" },
    id: "e1",
    kind: "link",
    type: "scene-object",
  });
});

test("window defaults an absent mode to normal and strips unknown keys", () => {
  expect(parseInfiniteCanvasWindow({ ...validWindow, extra: "gone" })).toEqual({
    ...validWindow,
    mode: "normal",
  });
});

test("window honours an explicit valid mode and rejects an invalid one", () => {
  expect(parseInfiniteCanvasWindow({ ...validWindow, mode: "maximized" })?.mode).toBe("maximized");
  expect(parseInfiniteCanvasWindow({ ...validWindow, mode: "fullscreen" })).toBeNull();
});

test("window validates optional restoreRect and rejects a malformed one", () => {
  const restoreRect = { height: 10, width: 10, x: 0, y: 0 };

  expect(parseInfiniteCanvasWindow({ ...validWindow, restoreRect })?.restoreRect).toEqual(
    restoreRect,
  );
  expect(
    parseInfiniteCanvasWindow({ ...validWindow, restoreRect: { height: 0, width: 1, x: 0, y: 0 } }),
  ).toBeNull();
});

test("window rejects wrong-typed required fields", () => {
  expect(parseInfiniteCanvasWindow({ ...validWindow, isPinned: "false" })).toBeNull();
  expect(parseInfiniteCanvasWindow({ ...validWindow, title: 5 })).toBeNull();
  expect(parseInfiniteCanvasWindow({ ...validWindow, zIndex: UNSAFE })).toBeNull();
  expect(parseInfiniteCanvasWindow({ ...validWindow, minSize: { height: 1 } })).toBeNull();
});

test("serialized state requires the numeric literal version 1", () => {
  const base = {
    activeWindowId: null,
    camera: { center: { x: 0, y: 0 }, zoom: 1 },
    windows: [],
  };

  expect(parseInfiniteCanvasSerializedState({ ...base, version: 1 })).not.toBeNull();
  expect(parseInfiniteCanvasSerializedState({ ...base, version: "1" })).toBeNull();
  expect(parseInfiniteCanvasSerializedState({ ...base, version: 2 })).toBeNull();
  expect(parseInfiniteCanvasSerializedState(base)).toBeNull();
});

test("serialized state strips unknown keys and defaults each window mode", () => {
  const parsed = parseInfiniteCanvasSerializedState({
    activeWindowId: "w1",
    camera: { center: { x: 0, y: 0 }, zoom: 1 },
    extraPersistedField: "deleted",
    version: 1,
    windows: [{ ...validWindow, extraWindowField: "deleted" }],
  });

  expect(parsed).toEqual({
    activeWindowId: "w1",
    camera: { center: { x: 0, y: 0 }, zoom: 1 },
    selection: undefined,
    version: 1,
    windows: [{ ...validWindow, mode: "normal" }],
  });
});

test("serialized state rejects unsafe geometry anywhere in the tree", () => {
  const withBadCamera = {
    activeWindowId: null,
    camera: { center: { x: Number.POSITIVE_INFINITY, y: 0 }, zoom: 1 },
    version: 1,
    windows: [],
  };
  const withBadWindow = {
    activeWindowId: null,
    camera: { center: { x: 0, y: 0 }, zoom: 1 },
    version: 1,
    windows: [{ ...validWindow, rect: { height: 1, width: 1, x: Number.NaN, y: 0 } }],
  };

  expect(parseInfiniteCanvasSerializedState(withBadCamera)).toBeNull();
  expect(parseInfiniteCanvasSerializedState(withBadWindow)).toBeNull();
});

test("serialized state normalizes a nested selection", () => {
  const parsed = parseInfiniteCanvasSerializedState({
    activeWindowId: null,
    camera: { center: { x: 0, y: 0 }, zoom: 1 },
    selection: { windowIds: ["w1"] },
    version: 1,
    windows: [],
  });

  expect(parsed?.selection).toEqual({ anchorWindowId: null, windowIds: ["w1"] });
});

test("serialized state requires activeWindowId to be a string or null", () => {
  const base = { camera: { center: { x: 0, y: 0 }, zoom: 1 }, version: 1, windows: [] };

  expect(parseInfiniteCanvasSerializedState({ ...base, activeWindowId: null })).not.toBeNull();
  expect(parseInfiniteCanvasSerializedState({ ...base, activeWindowId: "w1" })).not.toBeNull();
  expect(parseInfiniteCanvasSerializedState({ ...base, activeWindowId: 5 })).toBeNull();
  expect(parseInfiniteCanvasSerializedState(base)).toBeNull();
});

test("serialized state rejects a non-array windows field", () => {
  expect(
    parseInfiniteCanvasSerializedState({
      activeWindowId: null,
      camera: { center: { x: 0, y: 0 }, zoom: 1 },
      version: 1,
      windows: {},
    }),
  ).toBeNull();
});
