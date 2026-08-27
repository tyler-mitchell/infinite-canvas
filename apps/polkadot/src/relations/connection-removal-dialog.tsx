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
 * **The premise this was built on has since changed, and that is worth deciding rather than
 * inheriting.** `fn::unrelate_content_items` still deletes the row, but `disconnectItems` now
 * remembers its own inverse and offers it through the palette's undo — driven, a cut `supports`
 * edge labelled "load-bearing evidence" came back with both. So the loss is recoverable for one
 * step, where it previously was not by any route.
 *
 * By this app's own doctrine that is an argument for removing this dialog: archiving needs no
 * confirmation precisely because it is reversible. The counter-argument is that undo is one step
 * and expires when the next reversible act replaces it, whereas the archive list is permanent — so
 * a cut is *briefly* recoverable rather than reversible the way archiving is. That is a real
 * difference and a judgement call about a control someone else designed, so it is named here rather
 * than settled unilaterally. What is fixed below is only the sentence that had become false.
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
