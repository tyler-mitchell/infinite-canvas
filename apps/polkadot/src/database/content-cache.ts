import { observable } from "@legendapp/state";

/**
 * Reading a content item once, however many windows are showing it.
 *
 * A window carries only `{ itemId }` — the layout stays a layout, and for a picture that matters
 * more than tidiness, since a data URL in the saved layout would write the bytes into every canvas
 * save. So a body has an id and needs a record, and the same item open in two windows must not be
 * two reads or two copies that can disagree.
 *
 * `image-window.tsx` wrote this first and left a note saying the next kind that needed the same
 * shape should be what pulls it out. That kind is `link`, and its needs are identical: read once by
 * id, no writer at all. So this is that extraction rather than a second copy — a cache that drifts
 * is worse than either, because the fix to one of them looks complete.
 *
 * **Read-only on purpose, and that is the boundary.** `note-store` and `collection-store` also hold
 * records, and neither belongs here: they have debounced revision-guarded writers, and folding a
 * writer in would make this the shape of the hardest consumer rather than the common one. A kind
 * whose content never changes after creation is a different thing from one being edited, and only
 * the first is this.
 */

type ContentEntry<Item> = Readonly<{
  error: string | null;
  record: Item | null;
  status: "error" | "loading" | "ready";
}>;

function createContentCache<Item>(
  input: Readonly<{
    /** Shown when the read throws — a broken engine or a malformed record, not an absence. */
    failedMessage: string;
    /** Shown when the item is simply not there: archived, or removed in another tab. */
    missingMessage: string;
    read: (itemId: string) => Promise<Item | null>;
  }>,
) {
  const entries$ = observable<Record<string, ContentEntry<Item>>>({});
  /*
   * One cast, at the one place the generic meets the proxy.
   *
   * Legend State computes an observable's type by walking its value type, and it cannot walk
   * through an unresolved type parameter: every `entries$[itemId].set(…)` in here reports "no
   * overload matches" while being exactly right at runtime, and asserting the observable type does
   * not help because that type contains `Item` too. So the assertion is on the one method actually
   * called, written out in full — which is both the narrowest form and the one that would stop
   * compiling if the entry shape changed.
   *
   * Callers never touch this. `Item` is concrete at every call site, so `entries$[itemId]` types
   * itself normally for the components reading it.
   */
  const setEntry = (itemId: string, entry: ContentEntry<Item>) => {
    (entries$[itemId] as unknown as Readonly<{ set: (value: ContentEntry<Item>) => void }>).set(
      entry,
    );
  };
  /*
   * A separate set rather than reading the observable, because "already asked" is not "has a
   * value": two windows mounting in the same tick would both see `undefined` and both fetch.
   *
   * A failed read is removed from it, so opening the window again retries. A successful one is not,
   * which is what makes this read-*once*.
   */
  const requested = new Set<string>();

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
          requested.delete(itemId);
          setEntry(itemId, {
            error: error instanceof Error ? error.message : input.failedMessage,
            record: null,
            status: "error",
          });
        });
    },
    /** For a body that discovers its record is unusable only when it tries to draw it. */
    fail: (itemId: string, message: string) => {
      setEntry(itemId, { error: message, record: null, status: "error" });
    },
  };
}

export { createContentCache };
export type { ContentEntry };
