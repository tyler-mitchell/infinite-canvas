import { useObservable, useValue } from "@legendapp/state/react";
import { getHotkeyManager } from "@tanstack/hotkeys";
import { useEffect, useRef } from "react";
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

import type { ProjectRemovalSummary } from "../database/database.client";

/**
 * The one confirmation in the app that asks for typing rather than a click.
 *
 * Deleting a canvas removes an arrangement and its notes survive, so a button is proportionate.
 * Deleting a project destroys the writing itself, and this is a local-first application — there
 * is no server-side trash to recover from and no undo that reaches across it. When the cost is
 * unrecoverable the friction belongs at the moment of destruction, not in an apology afterwards.
 *
 * Typing the name is also the only gate that cannot be passed by a misclick, which is the failure
 * this exists to prevent.
 */

const removalDialog = tv({
  slots: {
    count: "font-medium text-[var(--ink)] tabular-nums",
    hint: "text-[12px] text-[var(--ink-faint)]",
    input:
      "w-full rounded-md bg-[var(--ground-sunken)] px-2.5 py-1.5 text-[13px] text-[var(--ink)] outline-none inset-ring-1 inset-ring-[var(--border)] focus:inset-ring-[var(--danger)]",
    name: "font-medium text-[var(--ink)]",
    prompt: "flex flex-col gap-1.5",
  },
});

const projectGateway = {
  remove: async (projectId: string) =>
    (await import("../database/database.client")).deleteProject(projectId),
  summarize: async (projectId: string) =>
    (await import("../database/database.client")).readProjectRemovalSummary(projectId),
};

export function ProjectRemovalDialog({
  onOpenChange,
  onRemoved,
  open,
  projectId,
}: Readonly<{
  onOpenChange: (open: boolean) => void;
  onRemoved: () => void;
  open: boolean;
  projectId: string;
}>) {
  const summary$ = useObservable<ProjectRemovalSummary | null>(null);
  const typed$ = useObservable("");
  const summary = useValue(summary$);
  const typed = useValue(typed$);
  const inputRef = useRef<HTMLInputElement>(null);
  const styles = removalDialog();
  const isConfirmed = summary !== null && typed.trim() === summary.title;

  useEffect(() => {
    typed$.set("");

    if (!open) {
      summary$.set(null);

      return;
    }

    void projectGateway.summarize(projectId).then((record) => {
      summary$.set(record);
    });
  }, [open, projectId, summary$, typed$]);

  const remove = () => {
    void projectGateway.remove(projectId).then(() => {
      onOpenChange(false);
      onRemoved();
    });
  };

  useEffect(() => {
    const node = inputRef.current;

    if (node === null) {
      return;
    }

    const manager = getHotkeyManager();
    // Enter only does anything once the name matches, so the shortcut cannot outrun the gate.
    const handle = manager.register(
      "Enter",
      () => {
        const current = summary$.peek();

        if (current !== null && typed$.peek().trim() === current.title) {
          remove();
        }
      },
      { ignoreInputs: false, target: node },
    );

    return () => {
      if (handle.isActive) {
        handle.unregister();
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, projectId, summary !== null, summary$, typed$]);

  return (
    <Dialog onOpenChange={onOpenChange} open={open}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Delete this project?</DialogTitle>
          <DialogDescription>
            {summary === null ? (
              "Checking what this project holds…"
            ) : (
              <>
                <span className={styles.name()}>{summary.title}</span>, its{" "}
                <span className={styles.count()}>{summary.canvases}</span>{" "}
                {summary.canvases === 1 ? "canvas" : "canvases"}, and{" "}
                <span className={styles.count()}>{summary.notes}</span>{" "}
                {summary.notes === 1 ? "note" : "notes"} will be permanently destroyed. Unlike
                deleting a canvas, this removes the writing itself, and nothing here can bring it
                back.
              </>
            )}
          </DialogDescription>
        </DialogHeader>
        {summary === null ? null : (
          <div className={styles.prompt()}>
            <label className={styles.hint()} htmlFor="project-removal-confirmation">
              Type <span className={styles.name()}>{summary.title}</span> to confirm.
            </label>
            <input
              autoComplete="off"
              className={styles.input()}
              id="project-removal-confirmation"
              onChange={(event) => {
                typed$.set(event.target.value);
              }}
              ref={inputRef}
              value={typed}
            />
          </div>
        )}
        <DialogFooter>
          <DialogClose render={<Button variant="ghost" />}>Cancel</DialogClose>
          <Button disabled={!isConfirmed} onClick={remove} variant="destructive">
            Delete project
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
