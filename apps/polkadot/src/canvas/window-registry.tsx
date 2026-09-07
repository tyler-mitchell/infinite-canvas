import { defineInfiniteCanvasWindowRegistry } from "@hyphened/infinite-canvas";
import { tv } from "ui/tv";

import { ContentWindowData, getContentWindowItemId } from "./content-window-data";

import { CollectionSummary } from "../collections/collection-summary";
import { CollectionWindowBody } from "../collections/collection-window";
import { ImageWindowBody } from "../images/image-window";
import { LinkWindowBody } from "../links/link-window";
import { noteGateway } from "../notes/note-gateway";
import { NoteSummary } from "../notes/note-summary";
import { NoteWindowBody } from "../notes/note-window";

type WindowKind = "collection" | "image" | "link" | "note";

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
  },
});

const windowDefinitions = defineInfiniteCanvasWindowRegistry<WindowKind, WindowData>({
  collection: {
    kind: "collection",
    overflowY: "auto",
    renderBody: ({ window }) => {
      const itemId = getContentWindowItemId(window);

      return itemId === null ? (
        <div className={noteWindow().summary()}>This window is not bound to a collection.</div>
      ) : (
        <CollectionWindowBody collectionId={itemId} />
      );
    },
    renderSummary: ({ bodySize, window }) => {
      const itemId = getContentWindowItemId(window);

      return itemId === null ? null : (
        <CollectionSummary bodySize={bodySize} collectionId={itemId} title={window.title} />
      );
    },
    textSelection: "none",
    wheelBehavior: "native-scroll",
  },
  image: {
    bodyPointerBehavior: "canvas-pan",
    kind: "image",
    overflowY: "hidden",
    renderBody: ({ window }) => {
      const itemId = getContentWindowItemId(window);

      return itemId === null ? (
        <div className={noteWindow().summary()}>This window is not bound to an image.</div>
      ) : (
        <ImageWindowBody imageId={itemId} />
      );
    },
    textSelection: "none",
    wheelBehavior: "canvas-pan",
  },
  // A summary unmounts and reloads the iframe.
  link: {
    kind: "link",
    overflowY: "hidden",
    renderBody: ({ window }) => {
      const itemId = getContentWindowItemId(window);

      return itemId === null ? (
        <div className={noteWindow().summary()}>This window is not bound to a link.</div>
      ) : (
        <LinkWindowBody linkId={itemId} />
      );
    },
    textSelection: "native",
    wheelBehavior: "native-scroll",
  },
  note: {
    kind: "note",
    overflowY: "auto",
    renderBody: ({ window }) => {
      const itemId = getContentWindowItemId(window);

      return itemId === null ? (
        <div className={noteWindow().summary()}>This window is not bound to a note.</div>
      ) : (
        <NoteWindowBody
          gateway={noteGateway}
          noteId={itemId}
          windowId={window.id}
          windowTitle={window.title}
        />
      );
    },
    renderSummary: ({ bodySize, window }) => {
      const itemId = getContentWindowItemId(window);

      return itemId === null ? null : (
        <NoteSummary
          bodySize={bodySize}
          gateway={noteGateway}
          noteId={itemId}
          title={window.title}
        />
      );
    },
    textSelection: "native",
    wheelBehavior: "native-scroll",
  },
});

export { ContentWindowData, getContentWindowItemId, windowDefinitions };
export type { WindowData, WindowKind };
