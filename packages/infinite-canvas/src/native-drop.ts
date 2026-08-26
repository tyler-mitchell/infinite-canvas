import type { InfiniteCanvasNativeDropPayload } from "./types";

/**
 * Reading a drag that started outside the page, without owning the drag.
 *
 * The drop system was built for drags a consumer starts: a pointerdown on a palette row, pointer
 * capture, escape to cancel. A drag arriving from the operating system or another tab is the same
 * *concept* through a different event system — `dragover` and `drop` carry a `DataTransfer`, no
 * pointer is captured, and cancelling belongs to the browser. Everything downstream is identical,
 * so the viewport translates one into the other rather than growing a second pipeline with its own
 * placement, snapping and preview.
 *
 * **This module used to answer "is this a file drag" and nothing else.** A drag carrying
 * `text/uri-list` — a link dragged from a browser's address bar, a tab, or a search result — was
 * turned away before any policy saw it, on the stated grounds that a canvas should not light up for
 * a drag it cannot use. That reasoning does not survive contact with `canDrop`, which runs during
 * the drag and already refuses unwanted *files* in flight: an unsupported type gets
 * `dropEffect: "none"` and a cursor that says so, from `types` alone. The bridge was answering a
 * policy question the consumer had already been given, and answering it the same way for everyone.
 *
 * So the decision is gone rather than duplicated. What arrives is described, and `canDrop` decides.
 * A consumer who wants links and not files says so in one predicate; one who wants neither passes
 * no `dropPolicy` and the browser keeps its default handling, exactly as before.
 *
 * Typed structurally rather than against `DataTransfer`. These are the properties that matter, and
 * stating them makes the function testable in a package whose tests have no DOM to build a real
 * transfer with.
 */

type NativeDragTransfer = Readonly<{
  files?: ArrayLike<File> | null;
  getData?: ((format: string) => string) | null;
  items?: ArrayLike<Readonly<{ kind: string; type: string }>> | null;
  types?: readonly string[] | null;
}>;

/** What a browser puts on the transfer when the thing being dragged is a link. */
const URI_LIST_TYPE = "text/uri-list";

/**
 * The lines of a `text/uri-list` that are actually URIs.
 *
 * RFC 2483 is a line-oriented format and permits comments: a line beginning with `#` is annotation,
 * not an address. Chrome puts the page title in one when you drag a tab, so a naive split gives a
 * "URL" that is a sentence.
 */
function getUriListEntries(text: string): readonly string[] {
  return text
    .split(/\r\n|\r|\n/)
    .map((line) => line.trim())
    .filter((line) => line.length > 0 && !line.startsWith("#"));
}

/**
 * Whatever the drag is carrying, as far as the browser will say — or `null` for a drag this
 * understands nothing of.
 *
 * `null` is the bridge's ignore signal, and having one function rather than a predicate beside a
 * builder is deliberate: two functions can disagree about whether a drag counts, and the one that
 * ran first would decide while the second silently produced an empty payload.
 *
 * **Files win over text when a drag carries both**, because dragging a file out of a file manager
 * puts a `text/plain` of its path alongside it, and reading that as a text drop would turn every
 * image drag into a dropped filename.
 *
 * **Contents are withheld until the drop, and that is the browser's rule rather than an omission.**
 * `files` is empty and `getData` returns `""` for every event before the drop — the protected mode
 * of the drag-and-drop spec. `types` reads throughout, which is what lets `canDrop` answer "is this
 * a link" before the user lets go: the difference between a canvas that refuses at the door and one
 * that accepts and then explains.
 */
function getInfiniteCanvasNativeDropPayload(
  transfer: NativeDragTransfer | null | undefined,
): InfiniteCanvasNativeDropPayload | null {
  const types = transfer?.types ?? [];

  if (types.includes("Files")) {
    const items = transfer?.items == null ? [] : Array.from(transfer.items);

    return {
      files: transfer?.files == null ? [] : Array.from(transfer.files),
      type: "files",
      // A dragged string sits in `items` beside the files. Counting it would tell a policy that an
      // image drag also carried a `text/plain`.
      types: items.filter((item) => item.kind === "file").map((item) => item.type),
    };
  }

  const textTypes = types.filter((type) => type.startsWith("text/"));

  if (textTypes.length === 0) {
    return null;
  }

  const read = (format: string) => (transfer?.getData == null ? "" : transfer.getData(format));
  const uriList = read(URI_LIST_TYPE);

  return {
    text: uriList === "" ? read("text/plain") : uriList,
    type: "text",
    types: textTypes,
    uris: getUriListEntries(uriList),
  };
}

export { getInfiniteCanvasNativeDropPayload, URI_LIST_TYPE };
export type { NativeDragTransfer };
