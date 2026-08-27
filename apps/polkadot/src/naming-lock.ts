/**
 * Choosing a default name and claiming it, without a second creation slipping between.
 *
 * Every default-named thing in this app is named by reading what exists and going one past the
 * highest — `getNextNumberedTitle` for notes and canvases, `getNextRepeatTitle` for collections.
 * That read and the write that claims the name are separate awaits, so two creations that overlap
 * both read the same list and both pick the same name.
 *
 * **Observed, not theorised.** Two notes made in quick succession produced a library listing
 * "Untitled 2", "Untitled 2", "Untitled 1" on 2026-08-27. It is the same duplicate the note
 * numbering was already fixed once to prevent; that fix corrected *what* was counted — notes rather
 * than open windows — and left the interleaving alone. `getNextNumberedTitle` is pure and right.
 * The defect is the gap between calling it and writing the answer down.
 *
 * A person clicking twice can do this. An agent calling `note.create` twice does it reliably, which
 * is how it was found.
 *
 * **Hand-rolled after checking, not instead of checking.** `@tanstack/pacer` is a dependency and
 * `AGENTS.md` names it, but its `AsyncQueuer` is a background concurrency controller: its own docs
 * state that `addItem` returns a boolean and "does not return a Promise for that item's result".
 * Every caller here awaits creation — the rail awaits it to know when to refocus, the palette to
 * close — so a queue that cannot hand back the caller's promise would break awaiting silently while
 * looking correct. The deficit is Pacer's shape, not a missing feature; this is four lines.
 *
 * One chain rather than one per project. Two projects creating at the same instant is not a thing a
 * single-tab local-first app does, and a keyed map would be machinery bought for that case alone.
 * The cost of over-serializing is that a creation waits for an unrelated one to finish, which is a
 * database round trip nobody is watching.
 *
 * **The honest limit: this is per-tab.** Two tabs open on one project can still collide, because
 * nothing here is a lock the database holds. Fixing that means the name being assigned where the
 * write happens, which is a schema change and a different piece of work. What this ends is the
 * collision one person, or one agent, can cause on their own — which is the one that happens.
 */

/**
 * The tail of the chain. Rejections are swallowed *for the chain only*, so one failed creation does
 * not poison every later one; the original promise still rejects for its own caller.
 */
let tail: Promise<unknown> = Promise.resolve();

/** Run `work` once everything already claimed has finished, and hand back its own promise. */
const withNamingLock = <T>(work: () => Promise<T>): Promise<T> => {
  const next = tail.then(work, work);

  tail = next.catch(() => undefined);

  return next;
};

export { withNamingLock };
