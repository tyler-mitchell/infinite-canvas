import type { InfiniteCanvasNativeDropPayload } from "./types";

/**
 * Reading a drag that started outside the page. Typed structurally rather than against
 * `DataTransfer` so it is testable without a DOM — and so `ClipboardEvent.clipboardData` fits too.
 */

type NativeDragTransfer = Readonly<{
  files?: ArrayLike<File> | null;
  getData?: ((format: string) => string) | null;
  items?: ArrayLike<Readonly<{ kind: string; type: string }>> | null;
  types?: readonly string[] | null;
}>;

const URI_LIST_TYPE = "text/uri-list";

/** RFC 2483 permits `#` comment lines, and a dragged tab's title arrives in one. */
function getUriListEntries(text: string): readonly string[] {
  return text
    .split(/\r\n|\r|\n/)
    .map((line) => line.trim())
    .filter((line) => line.length > 0 && !line.startsWith("#"));
}

/**
 * What the drag carries, or `null` for one this understands nothing of — which is the caller's
 * signal to leave the browser alone.
 *
 * Files win over text: a file dragged from a file manager carries a `text/plain` of its path.
 * Contents are withheld until the drop, so `text` and `uris` are empty in flight; `types` reads
 * throughout, which is what `canDrop` judges by.
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
