import { expect, test } from "vite-plus/test";

import { createInfiniteCanvasState } from "./factory";
import { reduceInfiniteCanvasState } from "./reducer";
import type { InfiniteCanvasAction, InfiniteCanvasState } from "./types";

const STATE: InfiniteCanvasState<"note"> = createInfiniteCanvasState<"note">({
  viewport: { height: 800, width: 1200 },
  windows: [],
});

const unknownAction = (type: string) => ({ type }) as unknown as InfiniteCanvasAction<"note">;

test("an unknown action names itself rather than failing somewhere else", () => {
  expect(() => reduceInfiniteCanvasState(STATE, unknownAction("window.teleport"))).toThrow(
    /window\.teleport/,
  );
});

test("the failure says what kind of thing went wrong", () => {
  expect(() => reduceInfiniteCanvasState(STATE, unknownAction("nonsense"))).toThrow(
    /Unknown infinite canvas action type/,
  );
});

test("the failure does not blame an unrelated field", () => {
  expect(() => reduceInfiniteCanvasState(STATE, unknownAction("nonsense"))).not.toThrow(/groups/);
});

test("a plausible-looking action type is reported verbatim", () => {
  expect(() => reduceInfiniteCanvasState(STATE, unknownAction("view.zoomIn"))).toThrow(
    /view\.zoomIn/,
  );
});

test("a known action still reduces normally", () => {
  const panned = reduceInfiniteCanvasState(STATE, {
    delta: { x: 40, y: 0 },
    type: "camera.panBy",
  });

  expect(panned.camera.center).not.toEqual(STATE.camera.center);
});
