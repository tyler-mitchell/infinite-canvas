import { FilePlus2, FileText, Frame, Link2, SquareStack, Columns3 } from "lucide-react";
import type { ComponentType } from "react";

/**
 * A glyph per app action.
 *
 * Off the action itself, deliberately: `app-actions.ts` is a vocabulary meant to be driven by a
 * palette, a rail, a wheel, or a tool caller that draws nothing at all, and none of those should
 * pay for an icon the last one will never read.
 *
 * But off any single control too. This map used to live inside the command palette, which meant the
 * selection rail and the right-click wheel could not reach it and each spelled its own glyph inline.
 * They disagreed: `group.createFromSelection` was `Columns3` in the palette and on the wheel, and
 * `Columns2` on the rail — which is also the layouts' glyph for "Tabbed", so one picture meant two
 * things and one verb wore two faces. Neither was noticeable without opening all three at once.
 */
const ACTION_ICON: Readonly<Record<string, ComponentType<Readonly<{ className?: string }>>>> = {
  "collection.create.collection": SquareStack,
  "collection.create.image": Frame,
  "collection.create.link": Link2,
  "collection.create.note": FileText,
  "group.createFromSelection": Columns3,
  "note.create": FilePlus2,
};

/**
 * The glyph to draw for an action, always answering.
 *
 * The fallback lives here rather than at each call site so a verb added without an icon looks the
 * same everywhere it appears, instead of taking whichever default the nearest control happened to
 * pick.
 */
export const getActionIcon = (id: string): ComponentType<Readonly<{ className?: string }>> =>
  ACTION_ICON[id] ?? FilePlus2;
