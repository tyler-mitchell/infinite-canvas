import { useValue } from "@legendapp/state/react";
import { proxy, syncState } from "@legendapp/state";
import { synced } from "@legendapp/state/sync";
import { useEffect } from "react";
import { Button } from "ui";
import { tv } from "ui/tv";

import { imageGateway, type ImageRecord } from "./image-gateway";

const images$ = proxy<ImageRecord | null>((imageId) =>
  synced({
    initial: null,
    get: () => imageGateway.read(imageId),
    onError: (error) => console.warn("Could not read image", { imageId, error }),
  }),
);

const imageWindow = tv({
  slots: {
    // A definite box lets object-contain constrain both image dimensions.
    image: "h-full w-full bg-[var(--ground-sunken)] object-contain",
    notice: "grid h-full place-items-center px-6 text-center text-[12.5px] text-[var(--ink-faint)]",
  },
});

export function ImageWindowBody({ imageId }: Readonly<{ imageId: string }>) {
  const image$ = images$[imageId];
  const image = useValue(image$);
  const status$ = syncState(image$);
  const isLoaded = useValue(status$.isLoaded);
  const isGetting = useValue(status$.isGetting);
  const error = useValue(status$.error);
  const styles = imageWindow();

  useEffect(() => {
    if (!status$.isLoaded.peek() && !status$.isGetting.peek() && status$.error.peek() !== undefined)
      void status$.sync();
  }, [status$]);

  if (error !== undefined) {
    return (
      <div className={styles.notice()}>
        <div>
          <p role="alert">{error?.message ?? "Could not open this image."}</p>
          <Button
            disabled={isGetting}
            onClick={() => {
              if (!status$.isGetting.peek()) void status$.sync();
            }}
            size="sm"
            variant="ghost"
          >
            Retry
          </Button>
        </div>
      </div>
    );
  }
  if (!isLoaded) {
    return <div className={styles.notice()}>Loading…</div>;
  }

  if (image == null) {
    return <div className={styles.notice()}>This image no longer exists.</div>;
  }

  return (
    <img
      // The description is alt text. The title can change independently.
      alt={image.content.description}
      className={styles.image()}
      onError={() => {
        const error = new Error("This image could not be decoded.");
        status$.error.set(error);
        console.warn(error.message, { imageId });
      }}
      src={image.content.source}
    />
  );
}
