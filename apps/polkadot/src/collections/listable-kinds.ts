import { FileText, Image, Layers, Link2, type LucideIcon } from "lucide-react";

/**
 * What a collection can be a collection *of*.
 *
 * **Deliberately not derived from the window registry**, which is the reasoning this was written
 * with and it still holds: a collection lists *content kinds*, and the registry is the set of kinds
 * that happen to have a window today. They agree right now and there is no reason they must — a
 * kind could be listable before anything draws it, and the collection would honestly say it has no
 * way to open its rows rather than being unable to name the kind at all.
 *
 * What was wrong was not the separation but the *location*: this list lived inside
 * `collection-window.tsx` while the command palette hard-coded its own copy of two entries, so the
 * app had two answers to one question and adding a kind meant finding both. It listed `note` and
 * `image`; `link` and `collection` had been openable and unlistable, which is the shape of a
 * primitive that exists in the type system and not in the product.
 *
 * The order is the order they are offered in, and it is not alphabetical — it runs from the kind
 * that holds the most of its own content to the kind that holds the least, ending with the one that
 * holds only other things.
 */

type ListableKind = Readonly<{
  icon: LucideIcon;
  kind: string;
  /** Plural, because it names a set rather than a member: a collection *of notes*. */
  label: string;
}>;

const LISTABLE_KINDS: readonly ListableKind[] = [
  { icon: FileText, kind: "note", label: "Notes" },
  { icon: Image, kind: "image", label: "Images" },
  { icon: Link2, kind: "link", label: "Links" },
  /*
   * A collection of collections is an index, and it is the one entry that could read as a mistake.
   * `listsKind` has always permitted it and nothing ever prevented it — what was missing was a way
   * to open the rows, so the question could be asked and its answers went nowhere.
   */
  { icon: Layers, kind: "collection", label: "Collections" },
];

const getListableKind = (kind: string) => LISTABLE_KINDS.find((entry) => entry.kind === kind);

export { getListableKind, LISTABLE_KINDS };
export type { ListableKind };
