import { useObservable, useValue } from "@legendapp/state/react";
import { useEffect } from "react";
import {
  Button,
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "ui";
import { tv } from "ui/tv";

import type { CanvasRemovalSummary } from "../database/database.client";

/**
 * Confirming a permanent removal by saying what it costs.
 *
 * "This cannot be undone" is a warning; it is not information. What a person needs in order to
 * decide is what is actually about to be destroyed and what is not — and here the honest answer
 * is unusually reassuring, because a canvas is an arrangement and the notes on it are separate
 * records that survive it. Saying so is the difference between a decision and a gamble.
 *
 * The counts are read when the dialog opens rather than carried in, so the number shown is the
 * canvas as it stands and not as it was when a menu was last populated.
 */

const removalDialog = tv({
  slots: {
    count: "font-medium text-[var(--ink)] tabular-nums",
    name: "font-medium text-[var(--ink)]",
  },
});

const canvasGateway = {
  remove: async (canvasId: string) =>
    (await import("../database/database.client")).deleteCanvas(canvasId),
  summarize: async (canvasId: string) =>
    (await import("../database/database.client")).readCanvasRemovalSummary(canvasId),
};

export function CanvasRemovalDialog({
  canvasId,
  onOpenChange,
  onRemoved,
  open,
}: Readonly<{
  canvasId: string;
  onOpenChange: (open: boolean) => void;
  onRemoved: () => void;
  open: boolean;
}>) {
  const summary$ = useObservable<CanvasRemovalSummary | null>(null);
  const summary = useValue(summary$);
  const styles = removalDialog();

  useEffect(() => {
    if (!open) {
      summary$.set(null);

      return;
    }

    void canvasGateway.summarize(canvasId).then((record) => {
      summary$.set(record);
    });
  }, [canvasId, open, summary$]);

  return (
    <Dialog onOpenChange={onOpenChange} open={open}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Delete this canvas?</DialogTitle>
          <DialogDescription>
            {summary === null ? (
              "Checking what this canvas holds…"
            ) : (
              <>
                <span className={styles.name()}>{summary.title}</span> and its{" "}
                <span className={styles.count()}>{summary.windows}</span>{" "}
                {summary.windows === 1 ? "window" : "windows"} will be removed. The notes they show
                are separate records and stay in your library — this deletes an arrangement, not the
                writing.
              </>
            )}
          </DialogDescription>
        </DialogHeader>
        <DialogFooter>
          <DialogClose render={<Button variant="ghost" />}>Cancel</DialogClose>
          <Button
            disabled={summary === null}
            onClick={() => {
              void canvasGateway.remove(canvasId).then(() => {
                onOpenChange(false);
                onRemoved();
              });
            }}
            variant="destructive"
          >
            Delete canvas
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
