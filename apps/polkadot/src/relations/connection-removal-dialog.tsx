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

/**
 * Confirming the one removal in this app that destroys something.
 *
 * Every other removal here is reversible, and each says so in its own words. Archiving needs no
 * confirmation because "nothing is destroyed, so nothing has to be weighed". Removing a saved view
 * needs none because "nothing is destroyed but the name and four numbers". A canvas gets a dialog
 * and a project gets a typed confirmation. The doctrine is that confirmation is proportional to
 * what is lost — and disconnecting had none at all while destroying a sentence someone wrote.
 *
 * `fn::unrelate_content_items` deletes the row, and the canvas's `history.undo` does not reach the
 * database. Driven on 2026-08-27: undo answers "not available right now", and reconnecting gives
 * back a bare `relates`. So the kind and the label do not come back by any route.
 *
 * **Only for an edge that says something.** `getRelationLabel` is the test, and it is the same one
 * the connector draws by: an edge with the default kind and no label asserts nothing beyond the
 * pairing, which the row already says by existing. Confirming that would be a dialog for nothing,
 * and it would train the answer "yes" for the case that matters.
 *
 * The claim is quoted rather than summarised, following `CanvasRemovalDialog`: what a person needs
 * in order to decide is what is actually about to be destroyed, and here that is one line of their
 * own writing. "This cannot be undone" alone is a warning, not information.
 */

const connectionRemoval = tv({
  slots: {
    claim: "font-medium text-[var(--ink)]",
  },
});

export function ConnectionRemovalDialog({
  claim,
  onConfirm,
  onOpenChange,
  open,
  title,
}: Readonly<{
  /** What the connection says — a written label, or the kind when it is not the default. */
  claim: string;
  onConfirm: () => void;
  onOpenChange: (open: boolean) => void;
  open: boolean;
  /** The note at the other end, so the sentence names the pair rather than "this connection". */
  title: string;
}>) {
  const styles = connectionRemoval();

  return (
    <Dialog onOpenChange={onOpenChange} open={open}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Cut this connection?</DialogTitle>
          <DialogDescription>
            The connection to <span className={styles.claim()}>{title}</span> says{" "}
            <span className={styles.claim()}>{claim}</span>. Both notes stay exactly as they are —
            this removes what the connection claimed, and that cannot be brought back.
          </DialogDescription>
        </DialogHeader>
        <DialogFooter>
          <DialogClose render={<Button variant="ghost" />}>Cancel</DialogClose>
          <Button
            onClick={() => {
              onConfirm();
              onOpenChange(false);
            }}
            variant="destructive"
          >
            Cut connection
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
