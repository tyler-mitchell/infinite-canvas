import { AsyncQueuer, Debouncer } from "@tanstack/pacer";

/**
 * A debounced write that never overtakes the write before it.
 *
 * Two shapes needed this and each had built it by hand: the canvas layout, saved as the document
 * changes, and a note's text, saved as it is typed. Both compose the same three parts, and the
 * middle one is the part that is easy to leave out and expensive to get wrong.
 *
 * - **Debounce** collapses a burst — a drag, a sentence — into one write.
 * - **A queue at concurrency one** keeps writes *ordered*. Both stores guard their writes with a
 *   revision, so two saves in flight together will race: the second reads the revision the first
 *   has not yet incremented, and the database rejects it as a conflict on a change the same user
 *   just made. Ordering is what makes optimistic concurrency usable rather than a source of
 *   spurious conflicts.
 * - **Errors surface**, because a silent failed write on a local-first app is the worst possible
 *   outcome: the user believes their work is saved.
 *
 * Reading and folding the revision stays with the caller, inside `save`. That is the one part
 * genuinely different between the two — the canvas holds its revision in a closure, a note reads
 * its own from the store — and pulling it in here would mean an abstraction over the difference
 * rather than over the shared mechanism.
 */

type OrderedWriter<Draft> = Readonly<{
  /** Cancels anything pending and stops the queue. Safe to call twice. */
  stop: () => void;
  /** Schedules a write. Later calls within `wait` replace earlier ones. */
  write: (draft: Draft) => void;
}>;

function createOrderedWriter<Draft>(
  input: Readonly<{
    onError: (error: unknown) => void;
    /** Fires when the queue drains, so a caller can report "saved" rather than "saving". */
    onSettled?: () => void;
    onStarted?: () => void;
    save: (draft: Draft) => Promise<void>;
    wait: number;
  }>,
): OrderedWriter<Draft> {
  const queue = new AsyncQueuer<Draft>(
    async (draft) => {
      input.onStarted?.();
      await input.save(draft);
    },
    {
      onError: input.onError,
      onSuccess: (_result, _draft, self) => {
        if (self.store.state.size === 0) {
          input.onSettled?.();
        }
      },
    },
  );
  const debouncer = new Debouncer(
    (draft: Draft) => {
      queue.addItem(draft);
    },
    { wait: input.wait },
  );

  return {
    stop: () => {
      debouncer.cancel();
      queue.stop();
      queue.clear();
    },
    write: (draft) => {
      debouncer.maybeExecute(draft);
    },
  };
}

export { createOrderedWriter };
export type { OrderedWriter };
