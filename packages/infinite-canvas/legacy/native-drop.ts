import type { InfiniteCanvasNativeDropPayload } from "./types";

/** Reads external drag data without a DOM dependency. */
type NativeDragTransfer = Readonly<{
  files?: ArrayLike<File> | null;
  getData?: ((format: string) => string) | null;
  items?: ArrayLike<Readonly<{ kind: string; type: string }>> | null;
  types?: readonly string[] | null;
}>;

const URI_LIST_TYPE = "text/uri-list";

/** RFC 2483 permits comment lines that start with `#`. */
function getUriListEntries(text: string): readonly string[] {
  return text
    .split(/\r\n|\r|\n/)
    .map((line) => line.trim())
    .filter((line) => line.length > 0 && !line.startsWith("#"));
}

/** Returns supported drag data or null. Files take priority over text. */
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
