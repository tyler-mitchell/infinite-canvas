import { getInfiniteCanvasWindowData } from "@hyphened/infinite-canvas";
import { type } from "arktype";

// Keep this schema in a leaf module to prevent an import cycle.
const ContentWindowData = type({ itemId: "string" });
type ContentWindowData = typeof ContentWindowData.infer;

const getContentWindowItemId = (window: Readonly<{ data?: unknown }>) =>
  getInfiniteCanvasWindowData(window, ContentWindowData.allows)?.itemId ?? null;

const showsContentItem = (window: Readonly<{ data?: unknown }>, itemId: string) =>
  getContentWindowItemId(window) === itemId;

export { ContentWindowData, getContentWindowItemId, showsContentItem };
