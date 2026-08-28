import { observable } from "@legendapp/state";

/**
 * Read a content item once, however many windows show it.
 *
 * Read-only on purpose: `note-store` holds records too, but it has a debounced revision-guarded
 * writer. This is for kinds whose content never changes after creation.
 *
 * **Read `content` from here. Never read `title`.** The record this caches carries a title, and that
 * title *does* change: a rename writes storage, folds `projectContent$` and sets the window chrome,
 * and nothing tells this cache — it is read-once by design. `link-window` drew its name from here
 * and, once renamed, showed the old one in its own bar while the chrome directly above it showed the
 * new one. Driven 2026-08-28: storage and chrome said "Third Name", the bar said "New Link Name".
 *
 * The listing is where a title has its single owner, which `renameProjectItem` states and this is
 * the fourth place that quietly held one anyway.
 */

type ContentEntry<Item> = Readonly<{
  error: string | null;
  record: Item | null;
  status: "error" | "loading" | "ready";
}>;

function createContentCache<Item>(
  input: Readonly<{
    failedMessage: string;
    missingMessage: string;
    read: (itemId: string) => Promise<Item | null>;
  }>,
) {
  const entries$ = observable<Record<string, ContentEntry<Item>>>({});
  // "Already asked" is not "has a value" — two windows mounting in one tick would both fetch.
  const requested = new Set<string>();
  // Legend State cannot compute an observable type through an unresolved type parameter, so the
  // one method actually called is asserted. Callers pass a concrete `Item` and type normally.
  const setEntry = (itemId: string, entry: ContentEntry<Item>) => {
    (entries$[itemId] as unknown as Readonly<{ set: (value: ContentEntry<Item>) => void }>).set(
      entry,
    );
  };

  return {
    entries$,
    ensureLoaded: (itemId: string) => {
      if (requested.has(itemId)) {
        return;
      }

      requested.add(itemId);
      setEntry(itemId, { error: null, record: null, status: "loading" });

      void input
        .read(itemId)
        .then((record) => {
          setEntry(
            itemId,
            record === null
              ? { error: input.missingMessage, record: null, status: "error" }
              : { error: null, record, status: "ready" },
          );
        })
        .catch((error: unknown) => {
          // Dropped from `requested` so reopening retries. A success is not, which makes it
          // read-once.
          requested.delete(itemId);
          setEntry(itemId, {
            error: error instanceof Error ? error.message : input.failedMessage,
            record: null,
            status: "error",
          });
        });
    },
    /** For a body that finds its record unusable only when it tries to draw it. */
    fail: (itemId: string, message: string) => {
      setEntry(itemId, { error: message, record: null, status: "error" });
    },
  };
}

export { createContentCache };
export type { ContentEntry };
