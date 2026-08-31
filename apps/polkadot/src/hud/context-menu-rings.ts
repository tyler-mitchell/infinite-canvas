import type { InfiniteCanvasCommandId } from "@hyphened/infinite-canvas";
import {
  AlignHorizontalSpaceAround,
  FlipHorizontal,
  Grip,
  Maximize,
  Maximize2,
  Minus,
  MousePointerSquareDashed,
  Pin,
  Scan,
  Undo2,
  Ungroup,
  X,
} from "lucide-react";
import type { ComponentType } from "react";

import { GROUP_LAYOUTS } from "./group-layouts";

type CanvasRingEntry = Readonly<{
  icon: ComponentType<Readonly<{ className?: string }>>;
  id: InfiniteCanvasCommandId;
  label: string;
  source: "canvas";
}>;

type AppRingEntry = Readonly<{ id: string; source: "app" }>;

type RingEntry = AppRingEntry | CanvasRingEntry;

const CANVAS_RING: readonly RingEntry[] = [
  { id: "note.create", source: "app" },
  { id: "group.createFromSelection", source: "app" },
  { icon: Scan, id: "view.fitSelection", label: "Fit selection", source: "canvas" },
  { icon: Maximize, id: "view.fitAll", label: "Fit all", source: "canvas" },
  {
    icon: MousePointerSquareDashed,
    id: "selection.selectAllVisible",
    label: "Select all",
    source: "canvas",
  },
  { icon: Undo2, id: "history.undo", label: "Undo", source: "canvas" },
];

const WINDOW_RING: readonly RingEntry[] = [
  { icon: Maximize2, id: "activeWindow.toggleMaximized", label: "Maximize", source: "canvas" },
  { icon: Pin, id: "activeWindow.togglePinned", label: "Pin", source: "canvas" },
  { icon: Grip, id: "window.undock", label: "Undock", source: "canvas" },
  { icon: X, id: "activeWindow.close", label: "Close", source: "canvas" },
  { icon: Minus, id: "activeWindow.minimize", label: "Minimize", source: "canvas" },
  { icon: Scan, id: "view.fitSelection", label: "Fit", source: "canvas" },
];

const GROUP_RING: readonly RingEntry[] = [
  ...GROUP_LAYOUTS.map((entry): CanvasRingEntry => ({
    icon: entry.icon,
    id: `group.setLayout.${entry.layout}`,
    label: entry.label,
    source: "canvas",
  })),
  { icon: FlipHorizontal, id: "group.flipAxis", label: "Flip axis", source: "canvas" },
  {
    icon: AlignHorizontalSpaceAround,
    id: "group.equalizeChildren",
    label: "Equalize",
    source: "canvas",
  },
  { icon: Ungroup, id: "group.dissolve", label: "Ungroup", source: "canvas" },
];

const CONTEXT_MENU_RINGS = { canvas: CANVAS_RING, group: GROUP_RING, window: WINDOW_RING };

function getRing(press: Readonly<{ groupId: string | null; windowId: string | null }>) {
  if (press.windowId !== null) {
    return WINDOW_RING;
  }

  if (press.groupId !== null) {
    return GROUP_RING;
  }

  return CANVAS_RING;
}

export { CONTEXT_MENU_RINGS, getRing };
export type { CanvasRingEntry, RingEntry };
