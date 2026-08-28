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
 * **Settled 2026-08-28: it stays, and the recoverability argument is not why.**
 *
 * The premise did change. `disconnectItems` remembers its own inverse, `UndoNotice` now offers that
 * inverse on screen at the moment of the cut rather than only as a palette row, and by this app's
 * doctrine — archiving needs no confirmation *precisely because* it is reversible — that is a good
 * argument for deleting this file. Whether one undo step is "reversible enough" against a permanent
 * archive list is genuinely arguable, and it is not the deciding question.
 *
 * The deciding question is what the dialog carries. It is not friction in front of a known act: it
 * quotes the claim, and the claim is the thing being destroyed. A connector on a canvas draws its
 * label at some zooms and not others, the Backspace gesture works on a selected edge with no label
 * in view, and the palette row says "Disconnect the two selected notes" without saying what they
 * assert. So a person can reach this act without the sentence they are about to lose being anywhere
 * on screen — and an undo cannot give that back, because it restores the edge only if you already
 * knew there was something worth restoring.
 *
 * Confirmation proportional to what is lost is the doctrine. Here what is lost is a line of the
 * person's own writing, and this is the only surface that shows it to them first.
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
            this removes what the connection claimed. Undo will bring it back, until the next thing
            you undo takes its place.
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
