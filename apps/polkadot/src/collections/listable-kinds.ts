import { FileText, Image, Layers, Link2, type LucideIcon } from "lucide-react";

// This list contains content kinds, not all window kinds.
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
