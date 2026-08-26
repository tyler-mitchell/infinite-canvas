import type {
  InfiniteCanvasDropTargetContext,
  InfiniteCanvasNativeDropPayload,
} from "@hyphened/infinite-canvas";
import { expect, test } from "vite-plus/test";

import { createCanvasDropPolicy, DROPPED_IMAGE_SIZE, type CanvasDropPayload } from "./drop-policy";
import type { WindowKind } from "./window-registry";

/**
 * What the canvas accepts, judged while the drag is still in flight.
 *
 * This is the half a browser makes hard to get right and easy to get wrong quietly. Contents are
 * withheld until the drop — no file bytes, no address — so `types` is the entire basis for the
 * decision, and a policy that waited for the payload could never refuse anything before the user
 * let go. Every refusal below therefore has to work from a payload with nothing in it.
 */

const policy = createCanvasDropPolicy("project:one");

/** Only `payload` is read by `canDrop` and `placement`; the rest of the context is never touched. */
const ask = (payload: InfiniteCanvasNativeDropPayload) =>
  ({ payload }) as unknown as InfiniteCanvasDropTargetContext<WindowKind, CanvasDropPayload>;

const inFlightFiles = (types: readonly string[]) => ({ files: [], type: "files", types }) as const;
const inFlightText = (types: readonly string[]) =>
  ({ text: "", type: "text", types, uris: [] }) as const;

test("an image is accepted before its bytes exist", () => {
  expect(policy.canDrop?.(ask(inFlightFiles(["image/png"])))).toMatchObject({ accepted: true });
});

test("a drag of several files is accepted when any one is an image", () => {
  // `some`, not `every`: dragging three files where one is a picture should light the canvas up for
  // that one rather than refusing the gesture. The drop handler filters again.
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
  /*
   * `text/plain` with no `text/uri-list` is a selection someone was dragging, not an address. This
   * is the one refusal a user is most likely to trip by accident, and accepting it would create a
   * record from something they never asked to save.
   */
  expect(policy.canDrop?.(ask(inFlightText(["text/plain"])))).toMatchObject({ accepted: false });
});

test("placement offers a size per kind, and nothing for what is refused", () => {
  // The preview rectangle and the snap guides are drawn from this, so a refused payload must not
  // get one — a guide for a drop that cannot happen is the canvas promising something.
  expect(policy.placement?.(ask(inFlightFiles(["image/png"])))).toEqual({
    size: DROPPED_IMAGE_SIZE,
  });
  expect(policy.placement?.(ask(inFlightText(["text/uri-list"])))).not.toBeNull();
  expect(policy.placement?.(ask(inFlightFiles(["application/zip"])))).toBeNull();
  expect(policy.placement?.(ask(inFlightText(["text/plain"])))).toBeNull();
});

test("a link's placement is exact where an image's is a guess", () => {
  /*
   * Nothing about a link is decoded on landing, so where the preview sits is where the card sits.
   * An image's is replaced the moment its bytes decode, which is why the two differ at all.
   */
  const link = policy.placement?.(ask(inFlightText(["text/uri-list"])));

  expect(link?.size).not.toEqual(DROPPED_IMAGE_SIZE);
});
