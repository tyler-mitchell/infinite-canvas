import type { InfiniteCanvasGroupLayoutMode } from "@hyphened/infinite-canvas";
import { Columns2, Rows3, SquareSplitHorizontal } from "lucide-react";
import type { ComponentType } from "react";

import { GROUP_LAYOUT_MODES } from "../canvas/group-layout-modes";

const FACE: Readonly<
  Record<
    InfiniteCanvasGroupLayoutMode,
    Readonly<{ icon: ComponentType<Readonly<{ className?: string }>>; label: string }>
  >
> = {
  accordion: { icon: Rows3, label: "Folded" },
  split: { icon: SquareSplitHorizontal, label: "Side by side" },
  tabs: { icon: Columns2, label: "Tabbed" },
};

export const GROUP_LAYOUTS = GROUP_LAYOUT_MODES.map((layout) => ({ ...FACE[layout], layout }));
