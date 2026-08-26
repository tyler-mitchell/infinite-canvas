/**
 * Reading a drag that started outside the page.
 *
 * The viewport's bridge around this is not covered here — it needs real `DragEvent`s against a
 * mounted element, and this package's tests have no DOM. What is covered is what a drag is turned
 * into and what a policy gets to judge it by, which is where the browser's rules are easy to get
 * wrong.
 */
import { expect, test } from "vite-plus/test";

import { getInfiniteCanvasNativeDropPayload } from "./native-drop";

const pngFile = new File([new Uint8Array([1, 2, 3])], "swatch.png", { type: "image/png" });

const transferOf = (data: Readonly<Record<string, string>>) => ({
  getData: (format: string) => data[format] ?? "",
  types: Object.keys(data),
});

test("types are readable during the drag, when files are not", () => {
  // The browser's rule and the reason `canDrop` is given types rather than files: the contents of a
  // dragged file are withheld until the drop, so a policy that waited for `files` to decide could
  // never refuse anything before the user let go.
  const payload = getInfiniteCanvasNativeDropPayload({
    files: [],
    items: [{ kind: "file", type: "image/png" }],
    types: ["Files"],
  });

  expect(payload?.type).toBe("files");
  expect(payload).toEqual({ files: [], type: "files", types: ["image/png"] });
});

test("the drop carries the files themselves", () => {
  const payload = getInfiniteCanvasNativeDropPayload({
    files: [pngFile],
    items: [{ kind: "file", type: "image/png" }],
    types: ["Files"],
  });

  expect(payload?.type === "files" && payload.files[0]?.name).toBe("swatch.png");
});

test("a dragged string is not counted among the files", () => {
  // Dragging selected text out of another app puts a `kind: "string"` item alongside any files.
  // Counting it would tell a policy an image drag also carried a `text/plain`.
  const payload = getInfiniteCanvasNativeDropPayload({
    files: [pngFile],
    items: [
      { kind: "string", type: "text/plain" },
      { kind: "file", type: "image/png" },
    ],
    types: ["Files"],
  });

  expect(payload?.types).toEqual(["image/png"]);
});

test("a link drag reaches the policy instead of being turned away at the door", () => {
  /*
   * The behaviour this module was rewritten for. A drag carrying `text/uri-list` — a browser tab, an
   * address bar, a search result — used to be dropped before any policy saw it, so no consumer could
   * accept a dragged link at all. The stated reason was that a canvas should not light up for a drag
   * it cannot use, which is `canDrop`'s job and always was: an unwanted *file* type is refused in
   * flight from `types` alone, and a link is no different.
   */
  const payload = getInfiniteCanvasNativeDropPayload(
    transferOf({ "text/plain": "https://example.com", "text/uri-list": "https://example.com" }),
  );

  expect(payload?.type).toBe("text");
  expect(payload?.types).toEqual(["text/plain", "text/uri-list"]);
});

test("a dragged tab's title is not mistaken for its address", () => {
  /*
   * `text/uri-list` is RFC 2483 — line-oriented, and a line beginning with `#` is a comment. Chrome
   * puts the page title in one when a tab is dragged, so a naive split gives a "URL" that is a
   * sentence, and a consumer opening it would navigate somewhere that does not exist.
   */
  const payload = getInfiniteCanvasNativeDropPayload(
    transferOf({ "text/uri-list": "# Example Domain\r\nhttps://example.com/a\r\n" }),
  );

  expect(payload?.type === "text" && payload.uris).toEqual(["https://example.com/a"]);
});

test("a multi-line uri list keeps every address", () => {
  const payload = getInfiniteCanvasNativeDropPayload(
    transferOf({ "text/uri-list": "https://one.example\nhttps://two.example\n" }),
  );

  expect(payload?.type === "text" && payload.uris).toEqual([
    "https://one.example",
    "https://two.example",
  ]);
});

test("dragged prose is text with no addresses in it", () => {
  const payload = getInfiniteCanvasNativeDropPayload(transferOf({ "text/plain": "just words" }));

  expect(payload?.type === "text" && payload.text).toBe("just words");
  expect(payload?.type === "text" && payload.uris).toEqual([]);
});

test("in flight a link drag says its types and withholds the address", () => {
  // The same protected-mode rule the file lane lives under: `getData` returns "" for every event
  // before the drop. A policy that waited for `uris` could never refuse anything in time.
  const payload = getInfiniteCanvasNativeDropPayload({ types: ["text/uri-list"] });

  expect(payload?.types).toEqual(["text/uri-list"]);
  expect(payload?.type === "text" && payload.text).toBe("");
  expect(payload?.type === "text" && payload.uris).toEqual([]);
});

test("a drag carrying both files and text is a file drag", () => {
  /*
   * Dragging a file out of a file manager puts a `text/plain` of its path alongside it. Reading that
   * as a text drop would turn every image drag into a dropped filename, so files win.
   */
  const payload = getInfiniteCanvasNativeDropPayload({
    files: [pngFile],
    items: [{ kind: "file", type: "image/png" }],
    types: ["Files", "text/plain"],
  });

  expect(payload?.type).toBe("files");
});

test("a drag carrying neither is nothing at all, and the bridge lets the browser have it", () => {
  // `null` is the ignore signal. A canvas must not call `preventDefault` on a drag it cannot
  // describe, because that silently takes the browser's own handling away from the page.
  expect(getInfiniteCanvasNativeDropPayload({ types: ["application/x-vendor"] })).toBeNull();
  expect(getInfiniteCanvasNativeDropPayload({ types: [] })).toBeNull();
  expect(getInfiniteCanvasNativeDropPayload(null)).toBeNull();
  expect(getInfiniteCanvasNativeDropPayload(undefined)).toBeNull();
});
