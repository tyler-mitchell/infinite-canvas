import type { InfiniteCanvasFileDropPayload } from "./types";

/**
 * Reading a native file drag, without owning the drag.
 *
 * The framework's drop system was built for drags a consumer starts: a pointerdown on a palette
 * row, pointer capture, escape to cancel. A file dragged in from the operating system is the same
 * *concept* arriving through a different event system — `dragover` and `drop` carry a
 * `DataTransfer`, no pointer is captured, and cancelling belongs to the OS. Everything downstream
 * is identical, so the viewport translates one into the other rather than growing a second pipeline
 * with its own placement, snapping, and preview.
 *
 * Typed structurally rather than against `DataTransfer`. These are the three properties that
 * matter, and stating them makes the functions testable in a package whose tests have no DOM to
 * construct a real transfer with.
 */

type FileDragTransfer = Readonly<{
  files?: ArrayLike<File> | null;
  items?: ArrayLike<Readonly<{ kind: string; type: string }>> | null;
  types?: readonly string[] | null;
}>;

/**
 * Whether a drag is carrying files at all.
 *
 * `types` includes the literal `"Files"` for an OS file drag, and it is the only signal available
 * while the drag is still in flight — which is exactly when a canvas has to decide whether to show
 * itself as a target. Text and link drags are excluded here rather than accepted and then rejected
 * on drop, so a drag the canvas cannot use never lights it up.
 */
function isInfiniteCanvasFileDrag(transfer: FileDragTransfer | null | undefined): boolean {
  return transfer?.types?.includes("Files") ?? false;
}

/**
 * What the drag is carrying, as far as the browser will say.
 *
 * `files` is empty until the drop, and that is a browser rule rather than an omission: the contents
 * of a dragged file are withheld while it is in flight, so nothing can read them during `dragover`.
 * `types` is available throughout, which is what makes `canDrop` able to answer "is this an image"
 * before the user lets go — the difference between a canvas that refuses a `.zip` at the door and
 * one that accepts it and then explains.
 */
function getInfiniteCanvasFileDropPayload(
  transfer: FileDragTransfer | null | undefined,
): InfiniteCanvasFileDropPayload {
  const items = transfer?.items == null ? [] : Array.from(transfer.items);

  return {
    files: transfer?.files == null ? [] : Array.from(transfer.files),
    type: "files",
    types: items.filter((item) => item.kind === "file").map((item) => item.type),
  };
}

export { getInfiniteCanvasFileDropPayload, isInfiniteCanvasFileDrag };
export type { FileDragTransfer };
