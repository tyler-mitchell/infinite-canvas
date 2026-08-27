import type { InfiniteCanvasGroupLayoutMode } from "@hyphened/infinite-canvas";
import { Columns2, Rows3, SquareSplitHorizontal } from "lucide-react";
import type { ComponentType } from "react";

/**
 * How a container's three shapes are shown, wherever they are offered.
 *
 * The framework owns the shapes themselves and the verbs that switch between them; what it cannot
 * own is which glyph and which word stand for `tabs` in *this* app. That is presentation, and two
 * controls need it: the group rail and the right-click wheel.
 *
 * It lives in neither of them. Either one importing from the other closes a cycle — the rail's file
 * renders the wheel — and past that, a list two controls read is not the property of whichever
 * happened to be written first.
 *
 * The order is part of what is shared, not incidental to it. A container's states escalate: apart,
 * stacked, one at a time. Reading left to right on the rail and clockwise on the wheel, they should
 * escalate the same way, because they are the same three things.
 */
export const GROUP_LAYOUTS = [
  { icon: SquareSplitHorizontal, label: "Side by side", layout: "split" },
  { icon: Rows3, label: "Folded", layout: "accordion" },
  { icon: Columns2, label: "Tabbed", layout: "tabs" },
] as const satisfies readonly Readonly<{
  icon: ComponentType<Readonly<{ className?: string }>>;
  label: string;
  layout: InfiniteCanvasGroupLayoutMode;
}>[];
