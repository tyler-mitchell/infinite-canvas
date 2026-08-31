import { observable } from "@legendapp/state";

// This cache stores read-once content. Titles come from the project listing.
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
  // requested prevents duplicate reads before the first read returns.
  const requested = new Set<string>();
  // Legend State cannot infer an observable through the unresolved Item type.
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
          // Remove failed reads so the next open can retry.
          requested.delete(itemId);
          setEntry(itemId, {
            error: error instanceof Error ? error.message : input.failedMessage,
            record: null,
            status: "error",
          });
        });
    },
    fail: (itemId: string, message: string) => {
      setEntry(itemId, { error: message, record: null, status: "error" });
    },
  };
}

export { createContentCache };
export type { ContentEntry };
