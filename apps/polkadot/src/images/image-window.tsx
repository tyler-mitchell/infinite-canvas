import { useValue } from "@legendapp/state/react";
import { useEffect } from "react";
import { tv } from "ui/tv";

import { createContentCache } from "../database/content-cache";
import { imageGateway, type ImageRecord } from "./image-gateway";

const images = createContentCache<ImageRecord>({
  failedMessage: "Could not open this image.",
  missingMessage: "This image no longer exists.",
  read: (imageId) => imageGateway.read(imageId),
});

const imageWindow = tv({
  slots: {
    // A definite box lets object-contain constrain both image dimensions.
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
      // The description is alt text. The title can change independently.
      alt={entry.record.content.description}
      className={styles.image()}
      onError={() => {
        images.fail(imageId, "This image could not be decoded.");
      }}
      src={entry.record.content.source}
    />
  );
}
