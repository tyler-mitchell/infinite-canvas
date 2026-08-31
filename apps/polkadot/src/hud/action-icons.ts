import { FilePlus2, FileText, Frame, Link2, SquareStack, Columns3 } from "lucide-react";
import type { ComponentType } from "react";

const ACTION_ICON: Readonly<Record<string, ComponentType<Readonly<{ className?: string }>>>> = {
  "collection.create.collection": SquareStack,
  "collection.create.image": Frame,
  "collection.create.link": Link2,
  "collection.create.note": FileText,
  "group.createFromSelection": Columns3,
  "note.create": FilePlus2,
};

export const getActionIcon = (id: string): ComponentType<Readonly<{ className?: string }>> =>
  ACTION_ICON[id] ?? FilePlus2;
