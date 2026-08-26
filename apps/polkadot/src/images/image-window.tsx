import { observable } from "@legendapp/state";
import { useValue } from "@legendapp/state/react";
import { useEffect } from "react";
import { tv } from "ui/tv";

import { imageGateway, type ImageRecord } from "./image-gateway";

/**
 * A window body bound to an image record.
 *
 * The window carries only `{ imageId }`, for the same reason a note window carries only its id: the
 * canvas layout stays a layout, and here it matters more than it does for text — a data URL in the
 * saved layout would put the picture's bytes into every canvas write.
 *
 * There is no writer half. An image's content never changes after it is created; its title does,
 * and that lives on the window where the chrome already edits it. So this is a read-once cache and
 * nothing else, kept keyed by id rather than by window so the same picture opened twice is fetched
 * once and both windows show it.
 *
 * Deliberately not extracted into a shared store yet. It is the read half of what `note-store`
 * does, but that module's entry shape and its debounced writer are entangled, so a common store
 * built from these two would have exactly one honest consumer. The third kind that needs it is what
 * should shape it.
 */

type ImageEntry = Readonly<{
  error: string | null;
  image: ImageRecord | null;
  status: "error" | "loading" | "ready";
}>;

const images$ = observable<Record<string, ImageEntry>>({});
const loaded = new Set<string>();

function ensureImageLoaded(imageId: string) {
  if (loaded.has(imageId)) {
    return;
  }

  loaded.add(imageId);
  images$[imageId].set({ error: null, image: null, status: "loading" });

  void imageGateway
    .read(imageId)
    .then((image) => {
      images$[imageId].set(
        image === null
          ? { error: "This image no longer exists.", image: null, status: "error" }
          : { error: null, image, status: "ready" },
      );
    })
    .catch((error: unknown) => {
      loaded.delete(imageId);
      images$[imageId].set({
        error: error instanceof Error ? error.message : "Could not open this image.",
        image: null,
        status: "error",
      });
    });
}

const imageWindow = tv({
  slots: {
    /*
     * The picture fills the body and `object-contain` fits the pixels inside it.
     *
     * The obvious spelling — centring a naturally-sized image under `max-h-full max-w-full` — does
     * not work, and the reason is worth writing down. A percentage `max-height` resolves against
     * the containing block, and for a grid item that is the grid *area*; with no explicit rows the
     * track is `auto`, sized from the item, so the constraint is cyclic and the browser drops it.
     * The picture then obeyed `max-w-full` alone and was clipped a few pixels short at the bottom —
     * visible only as a hairline of missing image.
     *
     * Filling the box has no such cycle: the box is the parent's definite height, and `object-fit`
     * fits the content inside a box that is already decided. It is also what `object-contain` is
     * for, which is the usual sign the fighting version was wrong.
     *
     * The bed shows through the letterbox bars because they are this element's own background. A
     * photo sitting on the window's light surface reads as a photo lying on a card; sinking it to
     * the ground colour makes the frame a window onto the picture, which is what it is. At the
     * size a window opens there are no bars at all — it appears when the user resizes away from
     * the picture's proportions, which is exactly when something should say the two disagree.
     */
    image: "h-full w-full bg-[var(--ground-sunken)] object-contain",
    notice: "grid h-full place-items-center px-6 text-center text-[12.5px] text-[var(--ink-faint)]",
  },
});

export function ImageWindowBody({ imageId }: Readonly<{ imageId: string }>) {
  const entry = useValue(images$[imageId]);
  const styles = imageWindow();

  useEffect(() => {
    ensureImageLoaded(imageId);
  }, [imageId]);

  if (entry === undefined || entry.status === "loading") {
    return <div className={styles.notice()}>Loading…</div>;
  }

  if (entry.status === "error" || entry.image === null) {
    return <div className={styles.notice()}>{entry.error ?? "Could not open this image."}</div>;
  }

  return (
    <img
      /*
       * The description, not the title. They start equal and diverge: renaming the window to
       * "Reference" must not tell a screen reader the picture depicts the word Reference.
       */
      alt={entry.image.content.description}
      className={styles.image()}
      /*
       * A data URL that fails to decode is a corrupt record, not a network problem — so this says
       * the picture is unreadable rather than offering a retry that would decode the same bytes to
       * the same failure.
       */
      onError={() => {
        images$[imageId].set({
          error: "This image could not be decoded.",
          image: null,
          status: "error",
        });
      }}
      src={entry.image.content.source}
    />
  );
}
