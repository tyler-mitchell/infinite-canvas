import {
  defineInfiniteCanvasWindowRegistry,
  getInfiniteCanvasWindowData,
} from "@hyphened/infinite-canvas";
import { tv } from "ui/tv";

/*
 * The payload schema is a leaf module rather than a definition here, and the reason is structural.
 *
 * This file imports every kind's body and those bodies import `open-window`, so the opener could
 * never import a *value* from here — it kept a hand-rolled structural cast instead, the only one
 * left in the app. Moving the schema somewhere that imports nothing lets the opener reach it.
 */
import { ContentWindowData, getContentWindowItemId } from "./content-window-data";

/*
 * Imported rather than wrapped in a lazy `await import`, which is what used to sit here.
 *
 * The wrapper existed to keep an 11 MB WebAssembly engine off the first frame, and that concern is
 * real — but `database/operations` already holds the only static reference to the engine behind a
 * `() => import(...)`, so this module reaches the gateway without pulling any of it. The wrapper
 * was deferring something already deferred, and cost a second place the note's read and save were
 * named.
 */
import { CollectionSummary } from "../collections/collection-summary";
import { CollectionWindowBody } from "../collections/collection-window";
import { ImageWindowBody } from "../images/image-window";
import { LinkWindowBody } from "../links/link-window";
import { noteGateway } from "../notes/note-gateway";
import { NoteSummary } from "../notes/note-summary";
import { NoteWindowBody } from "../notes/note-window";

/**
 * What can live on a canvas.
 *
 * This is separate from the workspace component because the route loader hydrates a saved layout
 * *before* anything mounts, and hydration has to know which kinds are registered in order to tell
 * a readable canvas from one referencing a window kind this build no longer has.
 *
 * Composition only. Each kind's schema, its content shape, and how it draws live with that kind —
 * `notes/`, `images/` — and this file wires them to the framework. A registry that grew the bodies
 * inline would put an image decoder and a rich-text editor in one module because they happen to
 * share a canvas.
 */

type WindowKind = "collection" | "image" | "link" | "note";

type WindowData = Readonly<{
  collection: ContentWindowData;
  image: ContentWindowData;
  link: ContentWindowData;
  note: ContentWindowData;
}>;

/** The notice a window shows when it is bound to nothing. Each kind's own body lives with the kind. */
const noteWindow = tv({
  slots: {
    summary:
      "grid h-full place-items-center px-4 text-center leading-[1.5] text-[var(--ink-faint)]",
  },
});

const windowDefinitions = defineInfiniteCanvasWindowRegistry<WindowKind, WindowData>({
  /*
   * A collection scrolls like a note and selects like neither.
   *
   * `textSelection: "none"` because its rows are buttons rather than prose — a drag across a list
   * of destinations should not paint a text highlight over them. `native-scroll` because the list
   * is genuinely taller than the frame and the wheel belongs to it, which is the note's answer and
   * the opposite of the image's.
   *
   * Its summary is a name and a number, which is the *different* thing the lane asks for. Shrinking
   * a list of titles produces grey stripes where every stripe was a word; "Images · 6" still answers
   * what the window is and how much is in it at a zoom where none of the rows can be read. The count
   * is the part a list cannot say at any size without being read, so far zoom is where it earns its
   * place rather than a consolation for losing the rows.
   */
  collection: {
    kind: "collection",
    overflowY: "auto",
    renderBody: ({ window }) => {
      const data = getInfiniteCanvasWindowData(window, ContentWindowData.allows);

      return data == null ? (
        <div className={noteWindow().summary()}>This window is not bound to a collection.</div>
      ) : (
        <CollectionWindowBody collectionId={data.itemId} />
      );
    },
    renderSummary: ({ window }) => {
      const data = getInfiniteCanvasWindowData(window, ContentWindowData.allows);

      return data == null ? null : (
        <CollectionSummary collectionId={data.itemId} title={window.title} />
      );
    },
    textSelection: "none",
    wheelBehavior: "native-scroll",
  },
  /*
   * An image's physics are the opposite of a note's on every axis the framework offers, which is
   * the point of it being a separate kind rather than a note that happens to hold a picture.
   *
   * `wheelBehavior: "canvas-pan"` — there is nothing to scroll. A note is a column of text taller
   * than its frame; a picture is letterboxed to fit, so a wheel over one has no local meaning and
   * belongs to the camera. The framework's default is already this, but a kind whose whole identity
   * is *not scrolling* should say so where the other kind says the reverse.
   *
   * `bodyPointerBehavior: "canvas-pan"` — a drag across a picture is a drag across the canvas.
   * There is no caret to place and no words to select, so the alternative is a body that swallows
   * drags and does nothing with them.
   *
   * `textSelection: "none"` — the same statement for the pointer that is not moving. Without it a
   * double-click on a photo produces a selection highlight over nothing.
   *
   * No `renderSummary`, and that is a decision rather than an omission. The summary lane exists
   * because small text stops being readable, and the framework's own contract says a window must
   * then say something *different* rather than the same thing smaller. A picture at a tenth of the
   * size is still the picture — recognisable by shape and colour when a paragraph has become grey
   * noise — so the honest thing is to keep drawing it. Substituting a filename at far zoom would
   * replace the one kind of content that survives the zoom with words that do not.
   */
  image: {
    bodyPointerBehavior: "canvas-pan",
    kind: "image",
    overflowY: "hidden",
    renderBody: ({ window }) => {
      const data = getInfiniteCanvasWindowData(window, ContentWindowData.allows);

      return data == null ? (
        <div className={noteWindow().summary()}>This window is not bound to an image.</div>
      ) : (
        <ImageWindowBody imageId={data.itemId} />
      );
    },
    textSelection: "none",
    wheelBehavior: "canvas-pan",
  },
  /*
   * The page itself, so the body keeps its own pointer and wheel — the camera cannot have them,
   * and could not take them from a cross-origin frame anyway.
   *
   * **No summary, and that is what keeps the page alive.** The lane swaps body for summary at far
   * zoom, and swapping unmounts the iframe, which reloads the page and loses its scroll and any
   * session. Declining the summary keeps the lane inert, so the frame is never torn down. Measured
   * against the alternative: parking iframes outside the render tree does preserve them, but a
   * single body-level overlay cannot respect per-window stacking, so a page would float above the
   * windows in front of it.
   */
  link: {
    kind: "link",
    overflowY: "hidden",
    renderBody: ({ window }) => {
      const data = getInfiniteCanvasWindowData(window, ContentWindowData.allows);

      return data == null ? (
        <div className={noteWindow().summary()}>This window is not bound to a link.</div>
      ) : (
        <LinkWindowBody linkId={data.itemId} />
      );
    },
    textSelection: "native",
    wheelBehavior: "native-scroll",
  },
  note: {
    kind: "note",
    overflowY: "auto",
    renderBody: ({ window }) => {
      const data = getInfiniteCanvasWindowData(window, ContentWindowData.allows);

      return data == null ? (
        <div className={noteWindow().summary()}>This window is not bound to a note.</div>
      ) : (
        <NoteWindowBody
          gateway={noteGateway}
          noteId={data.itemId}
          windowId={window.id}
          windowTitle={window.title}
        />
      );
    },
    renderSummary: ({ window }) => {
      const data = getInfiniteCanvasWindowData(window, ContentWindowData.allows);

      return data == null ? null : (
        <NoteSummary gateway={noteGateway} noteId={data.itemId} title={window.title} />
      );
    },
    textSelection: "native",
    wheelBehavior: "native-scroll",
  },
});

export { ContentWindowData, getContentWindowItemId, windowDefinitions };
export type { WindowData, WindowKind };
