import { getInfiniteCanvasWindowData } from "@hyphened/infinite-canvas/legacy";
import { type } from "arktype";

// Keep this schema in a leaf module to prevent an import cycle.
const ContentWindowData = type({ itemId: "string" });
type ContentWindowData = typeof ContentWindowData.infer;

/** Absent window, absent data and invalid data are one answer: this window shows no item. */
const getContentWindowItemId = (window: Readonly<{ data?: unknown }> | null | undefined) =>
  getInfiniteCanvasWindowData(window, ContentWindowData.allows)?.itemId ?? null;

const showsContentItem = (
  window: Readonly<{ data?: unknown }> | null | undefined,
  itemId: string,
) => getContentWindowItemId(window) === itemId;

export { ContentWindowData, getContentWindowItemId, showsContentItem };
