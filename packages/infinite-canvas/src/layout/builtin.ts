import { bindLayout } from "./arrange";
import { grid } from "./grid";
import { accordion, split, tabs, type DockEdge } from "./kinds";
import { lanes } from "./lanes";
import type { LayoutNode } from "./arrange";

export const builtinLayouts = {
  split: bindLayout(split),
  tabs: bindLayout(tabs),
  accordion: bindLayout(accordion),
  grid: bindLayout(grid),
  lanes: bindLayout(lanes),
};

export const defaultWrappers: Record<DockEdge, NonNullable<LayoutNode["layout"]>> = {
  north: { type: "split", axis: "vertical" },
  south: { type: "split", axis: "vertical" },
  east: { type: "split", axis: "horizontal" },
  west: { type: "split", axis: "horizontal" },
  center: { type: "tabs" },
};

export const defaultGrouping: NonNullable<LayoutNode["layout"]> = { type: "split" };
