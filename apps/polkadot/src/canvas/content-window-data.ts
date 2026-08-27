import { getInfiniteCanvasWindowData } from "@hyphened/infinite-canvas";
import { type } from "arktype";

/**
 * What every window on this canvas carries: the id of the content item it shows.
 *
 * One schema for every kind, and the second kind is what proved it had to be. These were
 * `{ noteId }` and `{ imageId }` — the same fact under two names, since `window.kind` already says
 * which sort of item it is. Two names cost more than tidiness: nothing could ask a window what it
 * was bound to without knowing its kind first, so the connector layer resolved notes and only
 * notes, and an image could not be connected to anything even though `relates_to` has admitted any
 * content item to any other since the first migration.
 *
 * A canvas saved before this reads `{ noteId }`, which no longer validates — those windows say they
 * are unbound and the note is reopened from the library. The records themselves are untouched; only
 * the binding is, and the repo keeps no compatibility path for a shape it has replaced.
 *
 * **A leaf module, and that is the whole reason this is not in `window-registry`.** The registry
 * imports every kind's body and those bodies import `open-window`, so anything reaching back for the
 * registry as a *value* closes a cycle. `open-window` therefore could not use this schema and kept a
 * structural cast instead — the only one left in the app, exempted by name in
 * `window-data-reads.test.ts` on exactly that ground. This file imports nothing from the app, so
 * every consumer including the opener can reach it and the exemption is gone.
 */

const ContentWindowData = type({ itemId: "string" });
type ContentWindowData = typeof ContentWindowData.infer;

/**
 * The content item a window shows, or `null` when it is bound to none.
 *
 * One expression, in one place, because the field name has moved once and every surface that had
 * spelled it out for itself kept compiling and stopped working. Through the schema rather than a
 * cast: an assertion about `unknown` cannot fail at runtime, it just yields `undefined` forever.
 * `window-data-reads.test.ts` holds the line.
 */
const getContentWindowItemId = (window: Readonly<{ data?: unknown }>) =>
  getInfiniteCanvasWindowData(window, ContentWindowData.allows)?.itemId ?? null;

/**
 * Whether a window is showing this content item.
 *
 * Here rather than in `open-window`, where it was a hand-rolled structural check for want of being
 * able to import the schema. It reads `data` directly rather than composing
 * `getContentWindowItemId`, only because the comparison is the whole of the question.
 */
const showsContentItem = (window: Readonly<{ data?: unknown }>, itemId: string) =>
  getContentWindowItemId(window) === itemId;

export { ContentWindowData, getContentWindowItemId, showsContentItem };
