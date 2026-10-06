import type {
  InfiniteCanvasDropTargetContext,
  InfiniteCanvasNativeDropPayload,
} from "@hyphened/infinite-canvas/legacy";
import { expect, test } from "vite-plus/test";

import { createCanvasDropPolicy, DROPPED_IMAGE_SIZE, type CanvasDropPayload } from "./drop-policy";
import type { WindowKind } from "./window-registry";

const policy = createCanvasDropPolicy("project:one");

const ask = (payload: InfiniteCanvasNativeDropPayload) =>
  ({ payload }) as unknown as InfiniteCanvasDropTargetContext<WindowKind, CanvasDropPayload>;

const inFlightFiles = (types: readonly string[]) => ({ files: [], type: "files", types }) as const;
const inFlightText = (types: readonly string[]) =>
  ({ text: "", type: "text", types, uris: [] }) as const;

test("an image is accepted before its bytes exist", () => {
  expect(policy.canDrop?.(ask(inFlightFiles(["image/png"])))).toMatchObject({ accepted: true });
});

test("a drag of several files is accepted when any one is an image", () => {
  const verdict = policy.canDrop?.(ask(inFlightFiles(["application/zip", "image/jpeg"])));

  expect(verdict).toMatchObject({ accepted: true });
});

test("an archive is refused at the edge, with a reason", () => {
  const verdict = policy.canDrop?.(ask(inFlightFiles(["application/zip"])));

  expect(verdict).toMatchObject({ accepted: false });
  expect(verdict).toHaveProperty("reason");
});

test("a link is accepted before its address is readable", () => {
  expect(policy.canDrop?.(ask(inFlightText(["text/uri-list", "text/plain"])))).toMatchObject({
    accepted: true,
  });
});

test("dragged prose is refused, because a note made from it would be a guess", () => {
  expect(policy.canDrop?.(ask(inFlightText(["text/plain"])))).toMatchObject({ accepted: false });
});

test("placement offers a size per kind, and nothing for what is refused", () => {
  expect(policy.placement?.(ask(inFlightFiles(["image/png"])))).toEqual({
    size: DROPPED_IMAGE_SIZE,
  });
  expect(policy.placement?.(ask(inFlightText(["text/uri-list"])))).not.toBeNull();
  expect(policy.placement?.(ask(inFlightFiles(["application/zip"])))).toBeNull();
  expect(policy.placement?.(ask(inFlightText(["text/plain"])))).toBeNull();
});

test("a link's placement is exact where an image's is a guess", () => {
  const link = policy.placement?.(ask(inFlightText(["text/uri-list"])));

  expect(link?.size).not.toEqual(DROPPED_IMAGE_SIZE);
});
