import { expect, test } from "vite-plus/test";

import { createInfiniteCanvasState, createInfiniteCanvasWindow } from "./factory";
import { getInfiniteCanvasDocument, getInfiniteCanvasDocumentChangeRect } from "./history";
import type { InfiniteCanvasRect } from "./types";

const rect = (x: number, y: number): InfiniteCanvasRect => ({ height: 100, width: 200, x, y });

const doc = (windows: readonly Readonly<{ id: string; rect: InfiniteCanvasRect }>[]) =>
  getInfiniteCanvasDocument(
    createInfiniteCanvasState<"note">({
      windows: windows.map((window) =>
        createInfiniteCanvasWindow<"note", undefined>({
          data: undefined,
          id: window.id,
          kind: "note",
          rect: window.rect,
          title: window.id,
        }),
      ),
    }),
  );

test("a document that did not change has no region", () => {
  const only = [{ id: "a", rect: rect(0, 0) }];

  expect(getInfiniteCanvasDocumentChangeRect(doc(only), doc(only))).toBeNull();
});

test("a moved window frames where it left and where it arrived", () => {
  /*
   * Both rectangles, not just the destination. Undo answers "what just happened", and a frame that
   * shows only the new position hides the motion that is the actual change.
   */
  const before = doc([{ id: "a", rect: rect(0, 0) }]);
  const after = doc([{ id: "a", rect: rect(600, 400) }]);

  expect(getInfiniteCanvasDocumentChangeRect(before, after)).toStrictEqual({
    height: 500,
    width: 800,
    x: 0,
    y: 0,
  });
});

test("a window that only one document holds contributes its one rectangle", () => {
  const before = doc([{ id: "a", rect: rect(0, 0) }]);
  const after = doc([
    { id: "a", rect: rect(0, 0) },
    { id: "b", rect: rect(600, 0) },
  ]);

  // The unchanged window is not part of the region, so opening one does not frame the whole canvas.
  expect(getInfiniteCanvasDocumentChangeRect(before, after)).toStrictEqual(rect(600, 0));
  expect(getInfiniteCanvasDocumentChangeRect(after, before)).toStrictEqual(rect(600, 0));
});

test("a batch across several windows frames all of them", () => {
  const before = doc([
    { id: "a", rect: rect(0, 0) },
    { id: "b", rect: rect(500, 500) },
  ]);
  const after = doc([
    { id: "a", rect: rect(0, 200) },
    { id: "b", rect: rect(500, 700) },
  ]);

  expect(getInfiniteCanvasDocumentChangeRect(before, after)).toStrictEqual({
    height: 800,
    width: 700,
    x: 0,
    y: 0,
  });
});

test("a resize counts, not only a move", () => {
  const before = doc([{ id: "a", rect: { height: 100, width: 200, x: 0, y: 0 } }]);
  const after = doc([{ id: "a", rect: { height: 300, width: 200, x: 0, y: 0 } }]);

  expect(getInfiniteCanvasDocumentChangeRect(before, after)).toStrictEqual({
    height: 300,
    width: 200,
    x: 0,
    y: 0,
  });
});

test("an untouched window never widens the region", () => {
  /*
   * The guard against framing the whole canvas on every undo: a far-away window that did not move
   * must contribute nothing, or the region is always the content bounds and the answer is useless.
   */
  const far = { id: "far", rect: rect(9000, 9000) };
  const before = doc([{ id: "a", rect: rect(0, 0) }, far]);
  const after = doc([{ id: "a", rect: rect(10, 0) }, far]);

  expect(getInfiniteCanvasDocumentChangeRect(before, after)).toStrictEqual({
    height: 100,
    width: 210,
    x: 0,
    y: 0,
  });
});
