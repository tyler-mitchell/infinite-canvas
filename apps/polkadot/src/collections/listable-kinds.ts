import { FileText, Image, Layers, Link2, type LucideIcon } from "lucide-react";

/**
 * What a collection can be a collection of.
 *
 * Not derived from the window registry: that is the set of kinds with a window, this is the set of
 * content kinds. They agree today and need not.
 */

type ListableKind = Readonly<{
  icon: LucideIcon;
  kind: string;
  label: string;
}>;

const LISTABLE_KINDS: readonly ListableKind[] = [
  { icon: FileText, kind: "note", label: "Notes" },
  { icon: Image, kind: "image", label: "Images" },
  { icon: Link2, kind: "link", label: "Links" },
  { icon: Layers, kind: "collection", label: "Collections" },
];

const getListableKind = (kind: string) => LISTABLE_KINDS.find((entry) => entry.kind === kind);

export { getListableKind, LISTABLE_KINDS };
export type { ListableKind };
