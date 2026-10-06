import { expect, test } from "vite-plus/test";

import { getInfiniteCanvasNativeDropPayload } from "./native-drop";

const pngFile = new File([new Uint8Array([1, 2, 3])], "swatch.png", { type: "image/png" });

const transferOf = (data: Readonly<Record<string, string>>) => ({
  getData: (format: string) => data[format] ?? "",
  types: Object.keys(data),
});

test("types are readable during the drag, when files are not", () => {
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
  const payload = getInfiniteCanvasNativeDropPayload(
    transferOf({ "text/plain": "https://example.com", "text/uri-list": "https://example.com" }),
  );

  expect(payload?.type).toBe("text");
  expect(payload?.types).toEqual(["text/plain", "text/uri-list"]);
});

test("a dragged tab's title is not mistaken for its address", () => {
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
  const payload = getInfiniteCanvasNativeDropPayload({ types: ["text/uri-list"] });

  expect(payload?.types).toEqual(["text/uri-list"]);
  expect(payload?.type === "text" && payload.text).toBe("");
  expect(payload?.type === "text" && payload.uris).toEqual([]);
});

test("a drag carrying both files and text is a file drag", () => {
  const payload = getInfiniteCanvasNativeDropPayload({
    files: [pngFile],
    items: [{ kind: "file", type: "image/png" }],
    types: ["Files", "text/plain"],
  });

  expect(payload?.type).toBe("files");
});

test("a drag carrying neither is nothing at all, and the bridge lets the browser have it", () => {
  expect(getInfiniteCanvasNativeDropPayload({ types: ["application/x-vendor"] })).toBeNull();
  expect(getInfiniteCanvasNativeDropPayload({ types: [] })).toBeNull();
  expect(getInfiniteCanvasNativeDropPayload(null)).toBeNull();
  expect(getInfiniteCanvasNativeDropPayload(undefined)).toBeNull();
});
