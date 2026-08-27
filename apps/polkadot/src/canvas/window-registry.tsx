import {
  defineInfiniteCanvasWindowRegistry,
  getInfiniteCanvasWindowData,
  useInfiniteCanvasSelector,
} from "@hyphened/infinite-canvas";
import { type } from "arktype";
import { tv } from "ui/tv";

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

type WindowData = Readonly<{
  collection: ContentWindowData;
  image: ContentWindowData;
  link: ContentWindowData;
  note: ContentWindowData;
}>;

const noteWindow = tv({
  slots: {
    summary:
      "grid h-full place-items-center px-4 text-center leading-[1.5] text-[var(--ink-faint)]",
    /** One line, clipped by the window rather than shrunk to fit it. */
    summaryTitle: "max-w-full truncate",
  },
});

/**
 * Screen pixels, which is the point.
 *
 * The summary lane exists because the body is too small to read, and its own docstring is explicit
 * that a window must then say something *different* rather than the same thing smaller. This
 * summary was the title at `text-[12px]` in **world** units — so it shrank along with everything
 * else and rendered at 3 to 6 screen pixels exactly where the lane had engaged. A summary nobody
 * can read is the body's problem restated.
 *
 * Holding the size in screen pixels and dividing by zoom keeps the words legible and lets the
 * window decide how many of them survive: at half zoom a 360-wide note still shows the whole title,
 * and by the time it is a thumbnail two letters and an ellipsis is all there is room for, which is
 * honest about how much a thumbnail can say.
 */
const SUMMARY_TITLE_SCREEN_PX = 11;

/**
 * Subscribed here rather than passed in, which is what the framework asks for: body content that
 * needs live state reads it with `useInfiniteCanvasSelector` inside its own component, so a camera
 * tick invalidates this and not every window on the canvas. Zoom also only changes on zoom — a pan
 * recomputes the same number and re-renders nothing.
 */
function NoteSummary({ title }: Readonly<{ title: string }>) {
  const zoom = useInfiniteCanvasSelector<WindowKind, number>((state) => state.camera.zoom);
  const styles = noteWindow();

  return (
    <div className={styles.summary()}>
      <span className={styles.summaryTitle()} style={{ fontSize: SUMMARY_TITLE_SCREEN_PX / zoom }}>
        {title}
      </span>
    </div>
  );
}

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
    renderSummary: ({ window }) => <NoteSummary title={window.title} />,
    textSelection: "native",
    wheelBehavior: "native-scroll",
  },
});

export { ContentWindowData, getContentWindowItemId, windowDefinitions };
export type { WindowData, WindowKind };
