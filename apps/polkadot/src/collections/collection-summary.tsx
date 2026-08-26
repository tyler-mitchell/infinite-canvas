import { useInfiniteCanvasSelector } from "@hyphened/infinite-canvas";
import { useValue } from "@legendapp/state/react";
import { useEffect } from "react";
import { tv } from "ui/tv";

import type { WindowKind } from "../canvas/window-registry";
import { openProject$ } from "../projects/open-project";
import { ensureCollectionLoaded, resolved$ } from "./collection-store";

/**
 * What a collection says when it is too small to read.
 *
 * The framework's contract is explicit that a summary must say something *different* rather than
 * the same thing smaller, and a collection is the kind where that is easiest to get wrong: shrinking
 * a list of titles produces grey stripes, and every one of them was a word.
 *
 * A name and a number is the different thing. At a zoom where eight filenames are illegible, "Images
 * · 6" still answers what this window is and how much is in it — which is most of what you pan
 * across a canvas looking for. The count is the part a list cannot say at any size without being
 * read, so far zoom is where it earns its place rather than a consolation for losing the rows.
 *
 * This was deliberately left undone when the kind shipped, on the grounds that inventing an answer
 * to satisfy the field would be worse than letting the body shrink. It is done now because the kind
 * existed long enough to say what it is for.
 */

const collectionSummary = tv({
  slots: {
    count: "tabular-nums text-[var(--ink-faint)]",
    root: "grid h-full place-items-center gap-[0.35em] px-4 text-center leading-[1.4] text-[var(--ink-muted)]",
    /** One line, clipped by the window rather than shrunk to fit it. */
    title: "max-w-full truncate font-medium text-[var(--ink)]",
  },
});

/**
 * Screen pixels, divided by zoom.
 *
 * The same correction the note summary carries, for the same reason: a size in world units shrinks
 * along with the window, so a summary written at `text-[12px]` renders at three screen pixels
 * exactly where the lane engaged — the body's problem restated one element up. Holding the size in
 * screen pixels is what makes the words legible at the zoom that demoted them.
 */
const SUMMARY_SCREEN_PX = 11;

export function CollectionSummary({
  collectionId,
  title,
}: Readonly<{ collectionId: string; title: string }>) {
  const zoom = useInfiniteCanvasSelector<WindowKind, number>((state) => state.camera.zoom);
  const projectId = useValue(openProject$);
  const items = useValue(resolved$[collectionId]);
  const styles = collectionSummary();

  /*
   * The summary loads, and the first version of this deliberately did not.
   *
   * The argument against was "a query behind every thumbnail", which sounded right and was wrong in
   * a way only driving it showed: the framework mounts the body *or* the summary, so a canvas
   * reloaded while zoomed out never mounts the body, nothing ever resolves, and the card renders
   * its title with no number — which is the window's own chrome header, said twice. A summary that
   * says only what the title bar says is not a summary.
   *
   * The cost is bounded rather than absent: `ensureCollectionLoaded` is guarded by a set, so this
   * is one indexed query per distinct collection per session, not one per render and not one per
   * frame. Both halves of the lane share `resolved$`, so zooming in after this costs nothing.
   */
  useEffect(() => {
    if (projectId !== null) {
      ensureCollectionLoaded(collectionId, projectId);
    }
  }, [collectionId, projectId]);

  return (
    <div className={styles.root()} style={{ fontSize: SUMMARY_SCREEN_PX / zoom }}>
      <span className={styles.title()}>{title}</span>
      {items === undefined ? null : <span className={styles.count()}>{items.length}</span>}
    </div>
  );
}
