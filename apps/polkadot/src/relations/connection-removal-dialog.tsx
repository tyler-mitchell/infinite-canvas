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

// This dialog quotes a custom relation claim before removal.
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
  claim: string;
  onConfirm: () => void;
  onOpenChange: (open: boolean) => void;
  open: boolean;
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
