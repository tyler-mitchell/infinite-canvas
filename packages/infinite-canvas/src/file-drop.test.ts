/**
 * Reading a native file drag.
 *
 * The viewport's bridge around these is not covered here — it needs real `DragEvent`s against a
 * mounted element, and this package's tests have no DOM. What is covered is the part that decides
 * whether a drag is a file drag at all, and what a policy gets to judge it by, which is where the
 * browser's rules are easy to get wrong.
 */
import { expect, test } from "vite-plus/test";

import { getInfiniteCanvasFileDropPayload, isInfiniteCanvasFileDrag } from "./file-drop";

const pngFile = new File([new Uint8Array([1, 2, 3])], "swatch.png", { type: "image/png" });

test("a drag carrying files is recognised while it is still in flight", () => {
  expect(isInfiniteCanvasFileDrag({ types: ["Files"] })).toBe(true);
});

test("a text or link drag is not a file drag", () => {
  // Turned away at the door rather than accepted and rejected on drop, so a drag the canvas cannot
  // use never lights it up.
  expect(isInfiniteCanvasFileDrag({ types: ["text/plain"] })).toBe(false);
  expect(isInfiniteCanvasFileDrag({ types: ["text/uri-list"] })).toBe(false);
  expect(isInfiniteCanvasFileDrag(null)).toBe(false);
  expect(isInfiniteCanvasFileDrag(undefined)).toBe(false);
});

test("types are readable during the drag, when files are not", () => {
  // This is the browser's rule and the reason `canDrop` is given types rather than files: the
  // contents of a dragged file are withheld until the drop, so a policy that waited for `files` to
  // decide could never refuse anything before the user let go.
  const payload = getInfiniteCanvasFileDropPayload({
    files: [],
    items: [{ kind: "file", type: "image/png" }],
    types: ["Files"],
  });

  expect(payload.type).toBe("files");
  expect(payload.types).toEqual(["image/png"]);
  expect(payload.files).toEqual([]);
});

test("the drop carries the files themselves", () => {
  const payload = getInfiniteCanvasFileDropPayload({
    files: [pngFile],
    items: [{ kind: "file", type: "image/png" }],
    types: ["Files"],
  });

  expect(payload.files).toHaveLength(1);
  expect(payload.files[0]?.name).toBe("swatch.png");
});

test("a dragged string is not counted among the files", () => {
  // Dragging selected text out of another app puts a `kind: "string"` item alongside any files.
  // Counting it would tell a policy an image drag also carried a `text/plain`.
  const payload = getInfiniteCanvasFileDropPayload({
    files: [pngFile],
    items: [
      { kind: "string", type: "text/plain" },
      { kind: "file", type: "image/png" },
    ],
    types: ["Files"],
  });

  expect(payload.types).toEqual(["image/png"]);
});

test("a transfer with nothing on it reads as an empty file drop rather than throwing", () => {
  const payload = getInfiniteCanvasFileDropPayload(null);

  expect(payload).toEqual({ files: [], type: "files", types: [] });
});
