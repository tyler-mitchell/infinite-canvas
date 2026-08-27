import type { InfiniteCanvasHandle } from "@hyphened/infinite-canvas";
import { useNavigate } from "@tanstack/react-router";
import { useObservable, useValue } from "@legendapp/state/react";
import { CopyPlus, RotateCcw, TriangleAlert } from "lucide-react";
import { Button } from "ui";
import { tv } from "ui/tv";

import { forkCanvas } from "../workspace/fork-canvas";
import type { WindowKind } from "./window-registry";

/**
 * The canvas moved underneath this tab, and nothing is being written down any more.
 *
 * Shown only for a revision conflict, which is a different animal from a failed write. A failed
 * write is transient and heals on the next edit. A conflict means the document on disk advanced
 * past the revision this tab holds — another tab, or another window on the same canvas — so every
 * later save carries a permanently stale number. The write loop stops rather than churning, and
 * this is the surface that stops it being a silent stop.
 *
 * **Both offers are honest, and neither is hidden.** The layout is one blob, so there is no merge
 * to perform: someone's arrangement wins. Forking is first because it is the only option that
 * destroys nothing — this tab's arrangement becomes a new canvas, and whatever the other writer
 * saved stays exactly as it is. Reloading is the other honest answer and it is destructive, so it
 * says so rather than reading as a refresh.
 *
 * Not dismissible, deliberately. Every other notice here can be waved away because the thing it
 * reports is already over; this one reports a state that is still true, and a dismissed banner
 * over an app that has quietly stopped saving is worse than no banner at all.
 */

const conflictNotice = tv({
  slots: {
    actions: "flex shrink-0 items-center gap-1",
    body: "min-w-0",
    detail: "text-[11px] text-[var(--ink-faint)]",
    icon: "size-4 shrink-0 text-[var(--danger)]",
    rail: "flex max-w-[26rem] items-center gap-2.5 rounded-[var(--radius-lg)] bg-[var(--surface)] py-2 pr-2 pl-3 shadow-[var(--lift-3)] inset-ring-1 inset-ring-[var(--edge-light)] backdrop-blur-2xl",
    title: "text-[12.5px] font-medium text-[var(--ink)]",
  },
});

export function CanvasConflictNotice({
  canvasTitle,
  handle,
  projectId,
}: Readonly<{
  canvasTitle: string;
  handle: InfiniteCanvasHandle<WindowKind>;
  projectId: string;
}>) {
  const navigate = useNavigate();
  const busy$ = useObservable(false);
  const busy = useValue(busy$);
  const styles = conflictNotice();

  /**
   * Keep this arrangement by giving it a canvas of its own.
   *
   * `snapshot()` is the same serializer the write loop uses, so what lands in the new document is
   * exactly what would have been saved had the revision still been good — not a re-derivation that
   * could disagree with it.
   */
  const fork = async () => {
    busy$.set(true);

    try {
      // Naming is `forkCanvas`'s, not this button's — it was `${canvasTitle} (recovered)` here, so
      // a second conflict made a second canvas with the same name and forking a fork compounded
      // the mark. Creating and navigating stay apart, the same split `createCanvas` keeps.
      const created = await forkCanvas({ canvasTitle, layout: handle.snapshot(), projectId });

      await navigate({ params: { canvasId: created.id }, to: "/canvas/$canvasId" });
    } finally {
      busy$.set(false);
    }
  };

  return (
    <div className={styles.rail()} role="alert">
      <TriangleAlert className={styles.icon()} />
      <div className={styles.body()}>
        <p className={styles.title()}>This canvas changed somewhere else</p>
        <p className={styles.detail()}>
          Nothing you do here is being saved. Keep this arrangement as its own canvas, or reload to
          take the other version and lose what you have done since.
        </p>
      </div>
      <div className={styles.actions()}>
        <Button
          disabled={busy}
          onClick={() => {
            void fork();
          }}
          size="sm"
          variant="ghost"
        >
          <CopyPlus />
          Keep mine
        </Button>
        <Button
          aria-label="Reload this canvas and discard changes since the conflict"
          disabled={busy}
          onClick={() => {
            globalThis.location.reload();
          }}
          size="icon-sm"
          title="Reload and discard"
          variant="ghost"
        >
          <RotateCcw />
        </Button>
      </div>
    </div>
  );
}
