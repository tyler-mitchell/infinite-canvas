import { useValue } from "@legendapp/state/react";
import { useEffect } from "react";
import { tv } from "ui/tv";

import { createContentCache } from "../database/content-cache";
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
 * That cache used to be written out here, with a note saying the next kind needing the same shape
 * should be what pulls it out. `link` was that kind, so it lives in `database/content-cache` now
 * and this declares one — the same reads, one implementation, and no second copy to drift.
 */

const images = createContentCache<ImageRecord>({
  failedMessage: "Could not open this image.",
  missingMessage: "This image no longer exists.",
  read: (imageId) => imageGateway.read(imageId),
});

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
  const entry = useValue(images.entries$[imageId]);
  const styles = imageWindow();

  useEffect(() => {
    images.ensureLoaded(imageId);
  }, [imageId]);

  if (entry === undefined || entry.status === "loading") {
    return <div className={styles.notice()}>Loading…</div>;
  }

  if (entry.status === "error" || entry.record === null) {
    return <div className={styles.notice()}>{entry.error ?? "Could not open this image."}</div>;
  }

  return (
    <img
      /*
       * The description, not the title. They start equal and diverge: renaming the window to
       * "Reference" must not tell a screen reader the picture depicts the word Reference.
       */
      alt={entry.record.content.description}
      className={styles.image()}
      /*
       * A data URL that fails to decode is a corrupt record, not a network problem — so this says
       * the picture is unreadable rather than offering a retry that would decode the same bytes to
       * the same failure.
       */
      onError={() => {
        images.fail(imageId, "This image could not be decoded.");
      }}
      src={entry.record.content.source}
    />
  );
}
